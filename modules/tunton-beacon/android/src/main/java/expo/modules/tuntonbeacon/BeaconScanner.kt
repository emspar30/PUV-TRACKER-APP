package expo.modules.tuntonbeacon

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import java.util.UUID

// The commuter side of the beacon (PRD 8.1, 8.2; DR8). Scans for Tunton beacons only: the filter on
// the service UUID runs in the Bluetooth stack, so the app hears nothing else. Each result's service
// data (the 9-byte rotating code, from the scan response) goes to JavaScript with its signal
// strength; the presence and margin rules and the server check run there. The scan stops by itself
// after durationMs. Nothing is kept: no address, no name, no history.
class BeaconScanner(
  private val context: Context,
  private val onBeacon: (payloadHex: String, rssi: Int, atMs: Long) -> Unit,
  private val onStopped: (reason: String) -> Unit,
) {
  private val handler = Handler(Looper.getMainLooper())
  private var serviceUuid: ParcelUuid? = null
  private var scanning = false

  private val timeout = Runnable {
    stop()
    onStopped("timeout")
  }

  private val callback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) = deliver(result)

    override fun onBatchScanResults(results: MutableList<ScanResult>) = results.forEach(::deliver)

    override fun onScanFailed(errorCode: Int) {
      scanning = false
      handler.removeCallbacks(timeout)
      onStopped("failed_$errorCode")
    }
  }

  // "scanning", or why not: no_permission, bluetooth_off, not_supported
  @SuppressLint("MissingPermission")
  fun start(uuid: String, mode: String, durationMs: Long): String {
    if (!canScan()) return "no_permission"
    val adapter = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter ?: return "not_supported"
    if (!adapter.isEnabled) return "bluetooth_off"
    val scanner = adapter.bluetoothLeScanner ?: return "bluetooth_off"
    stop()
    val parcel = ParcelUuid(UUID.fromString(uuid))
    val filter = ScanFilter.Builder().setServiceUuid(parcel).build()
    val settings = ScanSettings.Builder().setScanMode(scanModeOf(mode)).build()
    return try {
      scanner.startScan(listOf(filter), settings, callback)
      serviceUuid = parcel
      scanning = true
      handler.postDelayed(timeout, durationMs)
      "scanning"
    } catch (error: SecurityException) {
      "no_permission"
    }
  }

  @SuppressLint("MissingPermission")
  fun stop() {
    handler.removeCallbacks(timeout)
    if (!scanning) return
    scanning = false
    val adapter = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
    try {
      // With Bluetooth already off there is no scanner, and the scan has ended with it
      adapter?.bluetoothLeScanner?.stopScan(callback)
    } catch (error: SecurityException) {
      // Permission withdrawn while scanning; nothing left to stop
    } catch (error: IllegalStateException) {
      // Bluetooth turned off meanwhile
    }
  }

  private fun deliver(result: ScanResult) {
    val uuid = serviceUuid ?: return
    // Until the scan response arrives, a result has the UUID but not the code
    val payload = result.scanRecord?.getServiceData(uuid) ?: return
    if (payload.size != BeaconCode.PAYLOAD_BYTES) return
    onBeacon(BeaconCode.toHex(payload), result.rssi, System.currentTimeMillis())
  }

  // Android 12+: Nearby devices. Older: location, which Bluetooth scanning needed there. Location
  // services and the location permission also gate results on 12+ (no neverForLocation flag, which
  // would filter beacons out); JavaScript checks those before it starts a scan.
  private fun canScan(): Boolean {
    val permission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Manifest.permission.BLUETOOTH_SCAN else Manifest.permission.ACCESS_FINE_LOCATION
    return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
  }

  private fun scanModeOf(mode: String) = when (mode) {
    "low_latency" -> ScanSettings.SCAN_MODE_LOW_LATENCY
    "low_power" -> ScanSettings.SCAN_MODE_LOW_POWER
    else -> ScanSettings.SCAN_MODE_BALANCED
  }
}
