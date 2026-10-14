package expo.modules.tuntonbeacon

import android.bluetooth.BluetoothManager
import android.content.Context
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class BeaconOptions : Record {
  @Field val serviceUuid: String = ""
  @Field val version: Int = 1
  @Field val slotSeconds: Int = 60
  @Field val mode: String = "balanced"
  @Field val txPower: String = "medium"
  @Field val notificationTitle: String = ""
  @Field val notificationText: String = ""
}

class ScanOptions : Record {
  @Field val serviceUuid: String = ""
  @Field val mode: String = "balanced"
  @Field val durationMs: Double = 0.0
}

class InvalidInputException(message: String) : CodedException("ERR_TUNTON_BEACON_INPUT", message, null)

// JavaScript side of the driver beacon (DR4): set up the phone's secrets, start and stop the beacon
// service, read its status. The beacon secret can be written but never read back; the SMS key can be
// read back, because the heatmap is validated in TypeScript (DR5).
// DR8: the commuter app's scan for beacons (BeaconScanner): startScan, stopScan, and the events
// onBeacon (one per result) and onScanStopped (timeout or failure).
class TuntonBeaconModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private val statusListener: () -> Unit = { sendEvent(STATUS_EVENT, status()) }

  private var scanner: BeaconScanner? = null

  override fun definition() = ModuleDefinition {
    Name("TuntonBeacon")

    Events(STATUS_EVENT, BEACON_EVENT, SCAN_STOPPED_EVENT)

    OnStartObserving(STATUS_EVENT) { BeaconState.addListener(statusListener) }
    OnStopObserving(STATUS_EVENT) { BeaconState.removeListener(statusListener) }

    // The app is closing: never leave a scan running
    OnDestroy { scanner?.stop() }

    Function("getSupport") {
      val adapter = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
      val on = adapter?.isEnabled == true
      mapOf(
        "bluetooth" to (adapter != null),
        "bluetoothOn" to on,
        // Known only while Bluetooth is on
        "advertising" to if (on) adapter?.isMultipleAdvertisementSupported else null,
      )
    }

    AsyncFunction("provision") { shortId: Int, beaconSecretHex: String, smsKeyHex: String ->
      if (shortId !in 1..0xFFFF) throw InvalidInputException("shortId must be 1 to 65535")
      if (!HEX64.matches(beaconSecretHex) || !HEX64.matches(smsKeyHex)) throw InvalidInputException("secrets must be 64 hex characters")
      val store = SecretStore(context)
      store.put(SecretStore.BEACON_SECRET, beaconSecretHex.lowercase())
      store.put(SecretStore.SMS_KEY, smsKeyHex.lowercase())
      store.shortId = shortId
    }

    Function("isProvisioned") {
      val store = SecretStore(context)
      store.shortId != 0 && store.get(SecretStore.BEACON_SECRET) != null
    }

    AsyncFunction("getSmsKey") { SecretStore(context).get(SecretStore.SMS_KEY) }

    AsyncFunction("clearProvisioning") {
      BeaconAdvertiserService.stop(context)
      SecretStore(context).clearAll()
      BeaconState.update(advertising = false, lastSlot = null, lastPayloadHex = null, lastError = null)
    }

    AsyncFunction("startAdvertising") { options: BeaconOptions ->
      if (!UUID_RE.matches(options.serviceUuid)) throw InvalidInputException("serviceUuid is not a UUID")
      if (options.slotSeconds < 1) throw InvalidInputException("slotSeconds must be positive")
      val store = SecretStore(context)
      store.settings = BeaconSettings(
        serviceUuid = options.serviceUuid,
        version = options.version,
        slotSeconds = options.slotSeconds,
        mode = options.mode,
        txPower = options.txPower,
        notificationTitle = options.notificationTitle,
        notificationText = options.notificationText,
      )
      store.enabled = true
      BeaconAdvertiserService.start(context)
    }

    AsyncFunction("stopAdvertising") {
      SecretStore(context).enabled = false
      BeaconAdvertiserService.stop(context)
    }

    Function("getStatus") { status() }

    AsyncFunction("startScan") { options: ScanOptions ->
      if (!UUID_RE.matches(options.serviceUuid)) throw InvalidInputException("serviceUuid is not a UUID")
      if (options.durationMs < 1) throw InvalidInputException("durationMs must be positive")
      val active = scanner ?: BeaconScanner(
        context,
        onBeacon = { payloadHex, rssi, atMs ->
          sendEvent(BEACON_EVENT, mapOf("payloadHex" to payloadHex, "rssi" to rssi, "atMs" to atMs.toDouble()))
        },
        onStopped = { reason -> sendEvent(SCAN_STOPPED_EVENT, mapOf("reason" to reason)) },
      ).also { scanner = it }
      active.start(options.serviceUuid, options.mode, options.durationMs.toLong())
    }

    // False when no scan was ever started
    AsyncFunction("stopScan") {
      val active = scanner ?: return@AsyncFunction false
      active.stop()
      true
    }
  }

  private fun status(): Map<String, Any?> {
    val store = SecretStore(context)
    val adapter = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
    return mapOf(
      "provisioned" to (store.shortId != 0),
      "enabled" to store.enabled,
      "bluetoothOn" to (adapter?.isEnabled == true),
      "advertising" to BeaconState.advertising,
      "running" to BeaconAdvertiserService.running,
      "lastSlot" to BeaconState.lastSlot?.toDouble(),
      "lastPayloadHex" to BeaconState.lastPayloadHex,
      "lastError" to BeaconState.lastError,
    )
  }

  companion object {
    private const val STATUS_EVENT = "onStatus"
    private const val BEACON_EVENT = "onBeacon"
    private const val SCAN_STOPPED_EVENT = "onScanStopped"
    private val HEX64 = Regex("^[0-9a-fA-F]{64}$")
    private val UUID_RE = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
  }
}
