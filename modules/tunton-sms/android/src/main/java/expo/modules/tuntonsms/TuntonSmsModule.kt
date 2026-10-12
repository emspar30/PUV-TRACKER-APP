package expo.modules.tuntonsms

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.telephony.SubscriptionManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.UUID

class GatewaySettingsRecord : Record {
  @Field val pullS: Int = 10
  @Field val heartbeatS: Int = 60
  @Field val sendGapMs: Int = 1500
  @Field val sentTimeoutS: Int = 30
  @Field val pullMax: Int = 10
  @Field val backoffS: List<Int> = emptyList()
  @Field val eventsMax: Int = 100
  @Field val notificationTitle: String = ""
  @Field val notificationText: String = ""
}

class SmsInputException(message: String) : CodedException("ERR_TUNTON_SMS_INPUT", message, null)

class SmsPermissionException(permission: String) : CodedException("ERR_TUNTON_SMS_PERMISSION", "$permission is not granted", null)

class SmsSendException(message: String) : CodedException("ERR_TUNTON_SMS_SEND", message, null)

// JavaScript side of SMS (DR5). The driver app turns its inbox on with configure() once the phone is
// set up, drains it and validates each message in TypeScript. The gateway app sends text or data
// SMS and gets each one's results as onSendResult events. The settings come from JavaScript
// (shared/config); the module stores them so the receiver works while the app is closed.
// DR7: the gateway app sets up, starts and stops the sending service (GatewayService) and reads its
// status and events; the access token goes in once and never comes back to JavaScript.
class TuntonSmsModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private val arrivedListener: () -> Unit = { sendEvent(ARRIVED_EVENT, emptyMap<String, Any>()) }
  private val gatewayListener: () -> Unit = { sendEvent(GATEWAY_EVENT, gatewayStatus()) }

  private var sender: SmsSender? = null

  override fun definition() = ModuleDefinition {
    Name("TuntonSms")

    Events(ARRIVED_EVENT, SEND_RESULT_EVENT, GATEWAY_EVENT)

    OnStartObserving {
      InboxEvents.addListener(arrivedListener)
      GatewayState.addListener(gatewayListener)
    }
    OnStopObserving {
      InboxEvents.removeListener(arrivedListener)
      GatewayState.removeListener(gatewayListener)
    }

    OnDestroy {
      sender?.stop()
      sender = null
    }

    // --- Receiving (driver app) ---

    Function("canReceive") { granted(Manifest.permission.RECEIVE_SMS) }

    AsyncFunction("configure") { textPrefix: String, inboxMax: Int ->
      if (textPrefix.isEmpty()) throw SmsInputException("textPrefix must not be empty")
      if (inboxMax < 1) throw SmsInputException("inboxMax must be positive")
      InboxStore(context).configure(textPrefix, inboxMax)
    }

    AsyncFunction("disable") { InboxStore(context).disable() }

    Function("isConfigured") { InboxStore(context).enabled }

    AsyncFunction("drainInbox") { InboxStore(context).drain().map { it.toMap() } }

    Function("inboxSize") { InboxStore(context).size() }

    // --- Sending (gateway app) ---

    Function("canSend") { granted(Manifest.permission.SEND_SMS) }

    AsyncFunction("sendText") { to: String, text: String, subscriptionId: Int? ->
      if (to.isBlank() || text.isEmpty()) throw SmsInputException("to and text are required")
      val id = UUID.randomUUID().toString()
      send { it.sendText(id, to, text, subscriptionId) }
      id
    }

    AsyncFunction("sendData") { to: String, port: Int, dataHex: String, subscriptionId: Int? ->
      if (to.isBlank()) throw SmsInputException("to is required")
      if (port !in 1..MAX_PORT) throw SmsInputException("port must be 1 to $MAX_PORT")
      if (dataHex.isEmpty() || !HEX.matches(dataHex)) throw SmsInputException("dataHex must be an even number of hex characters")
      val id = UUID.randomUUID().toString()
      val data = ByteArray(dataHex.length / 2) { dataHex.substring(it * 2, it * 2 + 2).toInt(HEX_RADIX).toByte() }
      send { it.sendData(id, to, port, data, subscriptionId) }
      id
    }

    // The active SIMs, to choose which one sends; empty without READ_PHONE_STATE
    Function("listSims") { sims() }

    // --- Gateway service (gateway app, DR7) ---

    AsyncFunction("gatewaySetup") { gatewayId: String, workerUrl: String, token: String ->
      if (!GATEWAY_ID.matches(gatewayId)) throw SmsInputException("gatewayId must look like GW-01")
      if (!workerUrl.startsWith("https://") && !LOCALHOST.matches(workerUrl)) throw SmsInputException("the worker URL must be HTTPS (or http://localhost)")
      if (token.length < TOKEN_MIN) throw SmsInputException("token too short")
      GatewayService.stop(context)
      val store = GatewayStore(context)
      store.clearAll()
      store.setUp(gatewayId, workerUrl, token)
      GatewayState.reset()
    }

    Function("gatewayIsSetUp") { GatewayStore(context).isSetUp }

    Function("gatewaySetSim") { subscriptionId: Int? -> GatewayStore(context).subscriptionId = subscriptionId }

    AsyncFunction("gatewayStart") { options: GatewaySettingsRecord ->
      if (options.pullS < 1 || options.heartbeatS < 1 || options.pullMax < 1) throw SmsInputException("bad gateway settings")
      val store = GatewayStore(context)
      if (!store.isSetUp) throw SmsInputException("the gateway is not set up")
      if (!granted(Manifest.permission.SEND_SMS)) throw SmsPermissionException(Manifest.permission.SEND_SMS)
      store.settings = GatewaySettings(
        pullS = options.pullS,
        heartbeatS = options.heartbeatS,
        sendGapMs = options.sendGapMs,
        sentTimeoutS = options.sentTimeoutS,
        pullMax = options.pullMax,
        backoffS = options.backoffS,
        eventsMax = options.eventsMax,
        notificationTitle = options.notificationTitle,
        notificationText = options.notificationText,
      )
      store.enabled = true
      GatewayService.start(context)
    }

    AsyncFunction("gatewayStop") {
      GatewayStore(context).enabled = false
      GatewayService.stop(context)
    }

    // Stop and forget the setup (the phone is being set up again)
    AsyncFunction("gatewayClear") {
      GatewayService.stop(context)
      GatewayStore(context).clearAll()
      GatewayState.reset()
    }

    Function("gatewayStatus") { gatewayStatus() }

    Function("gatewayEvents") { GatewayStore(context).eventList() }

    Function("isIgnoringBatteryOptimizations") {
      (context.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(context.packageName)
    }

    // Opens Android's "let this app run in the background?" prompt (needs REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
    Function("requestIgnoreBatteryOptimizations") {
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  private fun gatewayStatus(): Map<String, Any?> {
    val store = GatewayStore(context)
    val counts = store.counts()
    return mapOf(
      "setUp" to store.isSetUp,
      "enabled" to store.enabled,
      "running" to GatewayState.running,
      "gatewayId" to store.gatewayId,
      "workerUrl" to store.workerUrl,
      "subscriptionId" to store.subscriptionId,
      "workerReachable" to GatewayState.workerReachable,
      "lastPullMs" to GatewayState.lastPullMs?.toDouble(),
      "lastHeartbeatMs" to GatewayState.lastHeartbeatMs?.toDouble(),
      "lastError" to GatewayState.lastError,
      "sentToday" to counts["sent"],
      "deliveredToday" to counts["delivered"],
      "failedToday" to counts["failed"],
    )
  }

  private fun sims(): List<Map<String, Any?>> {
    if (!granted(Manifest.permission.READ_PHONE_STATE)) return emptyList()
    val manager = context.getSystemService(SubscriptionManager::class.java) ?: return emptyList()
    return try {
      manager.activeSubscriptionInfoList.orEmpty().map {
        mapOf(
          "subscriptionId" to it.subscriptionId,
          "slotIndex" to it.simSlotIndex,
          "carrierName" to it.carrierName?.toString(),
          "displayName" to it.displayName?.toString(),
        )
      }
    } catch (error: SecurityException) {
      emptyList()
    }
  }

  private fun send(action: (SmsSender) -> Unit) {
    if (!granted(Manifest.permission.SEND_SMS)) throw SmsPermissionException(Manifest.permission.SEND_SMS)
    val active = sender ?: SmsSender(context) { result -> sendEvent(SEND_RESULT_EVENT, result.toMap()) }.also {
      it.start()
      sender = it
    }
    try {
      action(active)
    } catch (error: IllegalArgumentException) {
      throw SmsInputException(error.message ?: "invalid message")
    } catch (error: Exception) {
      throw SmsSendException(error.message ?: error.javaClass.simpleName)
    }
  }

  private fun granted(permission: String) = context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

  companion object {
    private const val ARRIVED_EVENT = "onHeatmapSms"
    private const val SEND_RESULT_EVENT = "onSendResult"
    private const val GATEWAY_EVENT = "onGatewayStatus"
    private val GATEWAY_ID = Regex("^GW-[0-9]{2}$")
    private val LOCALHOST = Regex("""^http://(localhost|127\.0\.0\.1)(:[0-9]{1,5})?(/.*)?$""")
    private const val TOKEN_MIN = 32
    private const val MAX_PORT = 65535
    private const val HEX_RADIX = 16
    private val HEX = Regex("^([0-9a-fA-F]{2})+$")
  }
}
