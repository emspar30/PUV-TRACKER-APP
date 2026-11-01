package expo.modules.tuntonbeacon

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

// Backlog 134 (owner, 2026-10-29): a retire notice that arrives while the driver app is closed. The
// SMS receiver in modules/tunton-sms only stores messages for the app to read; this second receiver,
// on the same two filters (plugins/withDriverAndroid.js), reads only a retire notice, checks that this
// phone's key signed it, then turns the beacon off for good and posts a notification. When the app is
// next opened it reads the stored copy and shows its pop-up and red card as before.
class RetireNoticeReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val parts = try {
      Telephony.Sms.Intents.getMessagesFromIntent(intent)?.filterNotNull()
    } catch (error: Exception) {
      null
    }
    if (parts.isNullOrEmpty()) return
    val notice = when (intent.action) {
      // A data message is a single part
      Telephony.Sms.Intents.DATA_SMS_RECEIVED_ACTION -> parts[0].userData?.let { RetireNotice.fromData(it) }
      Telephony.Sms.Intents.SMS_RECEIVED_ACTION -> RetireNotice.fromText(parts.joinToString("") { it.messageBody ?: "" })
      else -> null
    } ?: return

    val store = SecretStore(context)
    val key = store.get(SecretStore.SMS_KEY) ?: return
    if (!RetireNotice.isSignedWith(notice, key)) return

    // Off for good: BootReceiver and the app's restart check both read "enabled"
    store.enabled = false
    BeaconAdvertiserService.stop(context)
    BeaconState.update(advertising = false, lastError = "retired")
    notifyRetired(context, store)
  }

  private fun notifyRetired(context: Context, store: SecretStore) {
    // The words come from the app with the beacon settings (src/strings); none saved, no notification
    val title = store.retiredTitle ?: return
    val text = store.retiredText ?: ""
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, title, NotificationManager.IMPORTANCE_HIGH))
    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
    }
    val notification = Notification.Builder(context, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setSmallIcon(context.applicationInfo.icon)
      .setAutoCancel(true)
      .setContentIntent(open)
      .build()
    // Without the notifications permission Android drops it quietly; the beacon is off either way
    manager.notify(NOTIFICATION_ID, notification)
  }

  companion object {
    private const val CHANNEL_ID = "tunton_retired"
    private const val NOTIFICATION_ID = 4102
  }
}
