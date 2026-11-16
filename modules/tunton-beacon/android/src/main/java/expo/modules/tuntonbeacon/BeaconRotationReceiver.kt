package expo.modules.tuntonbeacon

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// The beacon's wake-up at each slot boundary (2026-11-16). The service's own timer counts only awake
// time, so with the screen off and the processor asleep the code stopped changing, and after about two
// minutes commuters would refuse it as too old. An exact wall-clock alarm wakes the phone for this
// receiver, which changes the code in the running service. Declared not exported in the driver app's
// manifest only (plugins/withDriverAndroid.js): only this app's alarm reaches it.
class BeaconRotationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    BeaconAdvertiserService.rotateFromAlarm()
  }
}
