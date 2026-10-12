package expo.modules.tuntonsms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.telephony.TelephonyManager
import android.util.Base64
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

// The gateway phone's sending service (PRD 9.6; DR7). A foreground service, so it runs for days with
// the screen off; type specialUse, because Android 15 limits dataSync services to about 6 hours a day
// and stops them from starting at boot (the gateway is a sideloaded team phone, PRD 15.2). A partial
// wake lock keeps its loop running while the screen is off (the phone stays on the charger).
//
// Each round, on its own thread: a heartbeat when one is due; a pull of up to pullMax messages; for
// each, send it from the chosen SIM, wait for Android's "sent" result (at most sentTimeoutS), report
// it to the worker, and wait sendGapMs before the next (carrier spam filters, PRD 16 risk 3). Delivery
// reports are posted when they arrive. If the worker cannot be reached, the next try waits longer
// (Backoff, 10 s up to 120 s). All of it is in Kotlin because a JavaScript timer stops with the screen.
class GatewayService : Service() {
  private val loop = Executors.newSingleThreadScheduledExecutor()
  private val reporter = Executors.newSingleThreadExecutor()
  private val waiting = ConcurrentHashMap<String, CompletableFuture<SendResult>>()
  // SMS id -> the worker's message id, until its delivery report comes
  private val inFlight = ConcurrentHashMap<String, Long>()

  private lateinit var store: GatewayStore
  private var settings: GatewaySettings? = null
  private var client: WorkerClient? = null
  private var sender: SmsSender? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var started = false
  private var failuresInARow = 0
  private var lastHeartbeatAtMs = 0L
  private var pullEveryS = 0

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (started) return START_STICKY
    store = GatewayStore(this)
    val loaded = store.settings
    val url = store.workerUrl
    val token = store.token()
    if (loaded == null || url == null || token == null || !store.enabled) {
      GatewayState.lastError = if (token == null) "not_set_up" else "not_enabled"
      GatewayState.changed()
      stopSelf()
      return START_NOT_STICKY
    }
    started = true
    settings = loaded
    pullEveryS = loaded.pullS
    client = WorkerClient(url, token)
    startInForeground(loaded)

    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tunton:gateway").apply {
      setReferenceCounted(false)
      acquire()
    }
    sender = SmsSender(this) { result -> onSmsResult(result) }.also { it.start() }

    GatewayState.running = true
    GatewayState.lastError = null
    GatewayState.changed()
    event("start", "Gateway started")
    loop.execute { round() }
    return START_STICKY
  }

  override fun onDestroy() {
    loop.shutdownNow()
    reporter.shutdown()
    sender?.stop()
    sender = null
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    if (started) event("stop", "Gateway stopped")
    started = false
    GatewayState.running = false
    GatewayState.changed()
    super.onDestroy()
  }

  private fun round() {
    val settings = settings ?: return
    val client = client ?: return
    var nextMs = pullEveryS * MS_PER_S
    try {
      if (System.currentTimeMillis() - lastHeartbeatAtMs >= settings.heartbeatS * MS_PER_S) heartbeat(client)
      val messages = client.pull(settings.pullMax)
      GatewayState.lastPullMs = System.currentTimeMillis()
      GatewayState.workerReachable = true
      GatewayState.lastError = null
      failuresInARow = 0
      if (messages.isNotEmpty()) event("pull", "${messages.size} to send")
      messages.forEachIndexed { index, message ->
        send(client, message, settings)
        if (index < messages.size - 1) Thread.sleep(settings.sendGapMs.toLong())
      }
      // A full pull: more may be waiting, so take them after the usual gap
      if (messages.size >= settings.pullMax) nextMs = settings.sendGapMs.toLong()
    } catch (error: InterruptedException) {
      return
    } catch (error: WorkerClient.HttpError) {
      failed(if (error.status == HTTP_UNAUTHORIZED) "unauthorized" else "worker_http_${error.status}", reachable = true)
      nextMs = Backoff.delayS(failuresInARow, settings.backoffS) * MS_PER_S
    } catch (error: IOException) {
      failed("worker_unreachable", reachable = false)
      nextMs = Backoff.delayS(failuresInARow, settings.backoffS) * MS_PER_S
    } catch (error: Exception) {
      failed(error.javaClass.simpleName, reachable = GatewayState.workerReachable ?: false)
      nextMs = Backoff.delayS(failuresInARow, settings.backoffS) * MS_PER_S
    }
    GatewayState.changed()
    if (!loop.isShutdown) loop.schedule({ round() }, nextMs, TimeUnit.MILLISECONDS)
  }

  private fun failed(error: String, reachable: Boolean) {
    failuresInARow += 1
    GatewayState.workerReachable = reachable
    // One event when a problem starts, not one per retry
    if (GatewayState.lastError != error) event("error", error)
    GatewayState.lastError = error
  }

  private fun send(client: WorkerClient, message: WorkerClient.Pulled, settings: GatewaySettings) {
    val sender = sender ?: return
    val smsId = "w${message.id}"
    // Some carriers never send delivery reports: forget old ones rather than keep them for ever
    if (inFlight.size > IN_FLIGHT_MAX) inFlight.clear()
    val result = CompletableFuture<SendResult>()
    waiting[smsId] = result
    inFlight[smsId] = message.id
    try {
      if (message.encoding == "data") {
        val bytes = Base64.decode(message.dataB64 ?: "", Base64.NO_WRAP)
        sender.sendData(smsId, message.to, message.port ?: throw IllegalArgumentException("no port"), bytes, store.subscriptionId)
      } else {
        sender.sendText(smsId, message.to, message.text ?: throw IllegalArgumentException("no text"), store.subscriptionId)
      }
    } catch (error: Exception) {
      waiting.remove(smsId)
      inFlight.remove(smsId)
      outcome(client, message, "failed", error.javaClass.simpleName)
      return
    }
    val sent = try {
      result.get(settings.sentTimeoutS.toLong(), TimeUnit.SECONDS)
    } catch (error: TimeoutException) {
      null
    } finally {
      waiting.remove(smsId)
    }
    when {
      sent == null -> {
        inFlight.remove(smsId)
        outcome(client, message, "failed", "sent_timeout")
      }
      sent.ok -> outcome(client, message, "sent", null)
      else -> {
        inFlight.remove(smsId)
        outcome(client, message, "failed", (sent.errorCode ?: sent.resultCode).toString())
      }
    }
  }

  private fun outcome(client: WorkerClient, message: WorkerClient.Pulled, status: String, errorCode: String?) {
    store.count(status)
    event(status, "#${message.id} ${message.encoding} to ${message.to}" + (errorCode?.let { " ($it)" } ?: ""))
    try {
      client.result(message.id, status, errorCode)
    } catch (error: IOException) {
      // The worker gets it back when the claim's lease ends
      event("error", "could not report #${message.id}")
    }
  }

  private fun onSmsResult(result: SendResult) {
    when (result.stage) {
      "sent" -> waiting[result.id]?.complete(result)
      "delivered" -> {
        val workerId = inFlight.remove(result.id) ?: return
        if (!result.ok) {
          event("failed", "#$workerId not delivered (status ${result.status})")
          return
        }
        store.count("delivered")
        event("delivered", "#$workerId delivered")
        val client = client ?: return
        reporter.execute {
          try {
            client.result(workerId, "delivered", null)
          } catch (error: IOException) {
            // A lost delivery report changes nothing that matters: the message was sent
          }
        }
        GatewayState.changed()
      }
    }
  }

  private fun heartbeat(client: WorkerClient) {
    val battery = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    var telephony = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    store.subscriptionId?.let { telephony = telephony.createForSubscriptionId(it) }
    val signal = try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) telephony.signalStrength?.level ?: -1 else -1
    } catch (error: Exception) {
      -1
    }
    val version = try {
      packageManager.getPackageInfo(packageName, 0).versionName ?: ""
    } catch (error: Exception) {
      ""
    }
    val status = JSONObject()
      .put("batteryPct", battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
      .put("charging", battery.isCharging)
      .put("simReady", telephony.simState == TelephonyManager.SIM_STATE_READY)
      .put("signalLevel", signal)
      .put("queueLocal", waiting.size)
      .put("appVersion", version)
    client.heartbeat(status)?.let { if (it in PULL_MIN_S..PULL_MAX_S) pullEveryS = it }
    lastHeartbeatAtMs = System.currentTimeMillis()
    GatewayState.lastHeartbeatMs = lastHeartbeatAtMs
  }

  private fun event(kind: String, text: String) {
    store.addEvent(kind, text, settings?.eventsMax ?: DEFAULT_EVENTS_MAX)
    GatewayState.changed()
  }

  private fun startInForeground(settings: GatewaySettings) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, settings.notificationTitle, NotificationManager.IMPORTANCE_LOW))
    val notification = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(settings.notificationTitle)
      .setContentText(settings.notificationText)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setContentIntent(packageManager.getLaunchIntentForPackage(packageName)?.let {
        PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE)
      })
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  companion object {
    private const val CHANNEL_ID = "tunton_gateway"
    private const val NOTIFICATION_ID = 4201
    private const val MS_PER_S = 1000L
    private const val HTTP_UNAUTHORIZED = 401
    private const val PULL_MIN_S = 5
    private const val PULL_MAX_S = 300
    private const val DEFAULT_EVENTS_MAX = 100
    private const val IN_FLIGHT_MAX = 500

    fun start(context: Context) {
      context.startForegroundService(Intent(context, GatewayService::class.java))
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, GatewayService::class.java))
    }
  }
}
