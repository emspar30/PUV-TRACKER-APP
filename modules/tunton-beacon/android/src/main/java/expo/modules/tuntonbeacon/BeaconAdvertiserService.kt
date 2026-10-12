package expo.modules.tuntonbeacon

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertisingSet
import android.bluetooth.le.AdvertisingSetCallback
import android.bluetooth.le.AdvertisingSetParameters
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.ParcelUuid
import android.os.SystemClock
import java.util.UUID

// The driver phone's beacon (PRD 8.2, 9.2; DR4). A foreground service (type connectedDevice) so it
// keeps advertising with the screen off. It advertises the service UUID, with the 9-byte rotating
// code as service data in the scan response; at each slot boundary (wall clock) the scan response is
// replaced without stopping the advertisement. It restarts when Bluetooth comes back on, and after a
// reboot through BootReceiver. Non-connectable: nobody can connect to the driver phone.
class BeaconAdvertiserService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var advertisingSet: AdvertisingSet? = null
  private var settings: BeaconSettings? = null
  private var secret: ByteArray? = null
  private var shortId: Int = 0
  private var receiverRegistered = false

  private val bluetoothReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      when (intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)) {
        BluetoothAdapter.STATE_ON -> startAdvertising()
        BluetoothAdapter.STATE_TURNING_OFF, BluetoothAdapter.STATE_OFF -> {
          stopAdvertising()
          BeaconState.update(advertising = false, lastError = "bluetooth_off")
        }
      }
    }
  }

  private val rotate = object : Runnable {
    override fun run() {
      updateScanResponse()
      scheduleRotation()
    }
  }

  private val callback = object : AdvertisingSetCallback() {
    override fun onAdvertisingSetStarted(set: AdvertisingSet?, txPower: Int, status: Int) {
      if (status == ADVERTISE_SUCCESS && set != null) {
        advertisingSet = set
        BeaconState.update(advertising = true)
        updateScanResponse()
        scheduleRotation()
      } else {
        BeaconState.update(advertising = false, lastError = "advertise_failed_$status")
      }
    }

    override fun onAdvertisingSetStopped(set: AdvertisingSet?) {
      if (set == advertisingSet) advertisingSet = null
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val store = SecretStore(this)
    val loaded = store.settings
    val secretHex = store.get(SecretStore.BEACON_SECRET)
    if (loaded == null || secretHex == null || store.shortId == 0) {
      BeaconState.update(advertising = false, lastError = "not_provisioned")
      stopSelf()
      return START_NOT_STICKY
    }
    settings = loaded
    secret = BeaconCode.hexToBytes(secretHex)
    shortId = store.shortId

    startInForeground(loaded)
    if (!receiverRegistered) {
      val filter = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
      // A system broadcast; nothing else may send to this receiver
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        registerReceiver(bluetoothReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        registerReceiver(bluetoothReceiver, filter)
      }
      receiverRegistered = true
    }
    startAdvertising()
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(rotate)
    stopAdvertising()
    if (receiverRegistered) {
      unregisterReceiver(bluetoothReceiver)
      receiverRegistered = false
    }
    BeaconState.update(advertising = false, lastError = BeaconState.lastError)
    super.onDestroy()
  }

  private fun startInForeground(settings: BeaconSettings) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, settings.notificationTitle, NotificationManager.IMPORTANCE_LOW))
    val notification = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(settings.notificationTitle)
      .setContentText(settings.notificationText)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setContentIntent(packageManager.getLaunchIntentForPackage(packageName)?.let {
        android.app.PendingIntent.getActivity(this, 0, it, android.app.PendingIntent.FLAG_IMMUTABLE)
      })
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun canAdvertise(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      checkSelfPermission(Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED

  @SuppressLint("MissingPermission")
  private fun startAdvertising() {
    val settings = settings ?: return
    if (advertisingSet != null) return
    if (!canAdvertise()) {
      BeaconState.update(advertising = false, lastError = "no_permission")
      return
    }
    val adapter = (getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
    if (adapter == null || !adapter.isEnabled) {
      BeaconState.update(advertising = false, lastError = "bluetooth_off")
      return
    }
    val advertiser = adapter.bluetoothLeAdvertiser
    if (advertiser == null || !adapter.isMultipleAdvertisementSupported) {
      BeaconState.update(advertising = false, lastError = "not_supported")
      return
    }
    val uuid = ParcelUuid(UUID.fromString(settings.serviceUuid))
    val parameters = AdvertisingSetParameters.Builder()
      .setLegacyMode(true)
      .setConnectable(false)
      .setScannable(true)
      .setInterval(intervalOf(settings.mode))
      .setTxPowerLevel(txPowerOf(settings.txPower))
      .build()
    val data = AdvertiseData.Builder().addServiceUuid(uuid).setIncludeDeviceName(false).setIncludeTxPowerLevel(false).build()
    try {
      advertiser.startAdvertisingSet(parameters, data, scanResponse(), null, null, callback)
    } catch (error: SecurityException) {
      BeaconState.update(advertising = false, lastError = "no_permission")
    }
  }

  @SuppressLint("MissingPermission")
  private fun stopAdvertising() {
    handler.removeCallbacks(rotate)
    val adapter = (getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
    try {
      adapter?.bluetoothLeAdvertiser?.stopAdvertisingSet(callback)
    } catch (error: SecurityException) {
      // Permission withdrawn while advertising; nothing left to stop
    }
    advertisingSet = null
  }

  private fun currentPayload(): Pair<Long, ByteArray>? {
    val settings = settings ?: return null
    val secret = secret ?: return null
    val slot = BeaconCode.slotOf(System.currentTimeMillis(), settings.slotSeconds)
    return slot to BeaconCode.payload(settings.version, shortId, slot, secret)
  }

  private fun scanResponse(): AdvertiseData {
    val settings = settings!!
    val (_, payload) = currentPayload()!!
    return AdvertiseData.Builder()
      .addServiceData(ParcelUuid(UUID.fromString(settings.serviceUuid)), payload)
      .setIncludeDeviceName(false)
      .setIncludeTxPowerLevel(false)
      .build()
  }

  @SuppressLint("MissingPermission")
  private fun updateScanResponse() {
    val set = advertisingSet ?: return
    val (slot, payload) = currentPayload() ?: return
    try {
      set.setScanResponseData(scanResponse())
      BeaconState.update(advertising = true, lastSlot = slot, lastPayloadHex = BeaconCode.toHex(payload))
    } catch (error: SecurityException) {
      BeaconState.update(advertising = false, lastError = "no_permission")
    }
  }

  // Next slot boundary on the wall clock, plus a small margin, so the code changes when the server's slot does
  private fun scheduleRotation() {
    val slotMs = (settings?.slotSeconds ?: return) * 1000L
    val now = System.currentTimeMillis()
    val delay = slotMs - (now % slotMs) + ROTATION_MARGIN_MS
    handler.removeCallbacks(rotate)
    handler.postAtTime(rotate, SystemClock.uptimeMillis() + delay)
  }

  private fun intervalOf(mode: String) = when (mode) {
    "low_latency" -> AdvertisingSetParameters.INTERVAL_LOW
    "low_power" -> AdvertisingSetParameters.INTERVAL_HIGH
    else -> AdvertisingSetParameters.INTERVAL_MEDIUM
  }

  private fun txPowerOf(power: String) = when (power) {
    "ultra_low" -> AdvertisingSetParameters.TX_POWER_ULTRA_LOW
    "low" -> AdvertisingSetParameters.TX_POWER_LOW
    "high" -> AdvertisingSetParameters.TX_POWER_HIGH
    else -> AdvertisingSetParameters.TX_POWER_MEDIUM
  }

  companion object {
    private const val CHANNEL_ID = "tunton_beacon"
    private const val NOTIFICATION_ID = 4101
    private const val ROTATION_MARGIN_MS = 50L

    fun start(context: Context) {
      context.startForegroundService(Intent(context, BeaconAdvertiserService::class.java))
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, BeaconAdvertiserService::class.java))
    }
  }
}
