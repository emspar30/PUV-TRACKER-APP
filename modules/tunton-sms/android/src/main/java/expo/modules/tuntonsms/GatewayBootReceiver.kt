package expo.modules.tuntonsms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Starts the gateway service again after a reboot or an app update, if it was on (DR7, DR7-M6).
// Declared in the gateway app's manifest only (plugins/withGatewayAndroid.js). A specialUse service
// may start from BOOT_COMPLETED (Android 15 forbids it for dataSync and a few other types only).
class GatewayBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    val store = GatewayStore(context)
    if (store.enabled && store.isSetUp && store.settings != null) GatewayService.start(context)
  }
}
