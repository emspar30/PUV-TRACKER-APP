package expo.modules.tuntonsms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

// The driver phone's heatmap receiver (PRD 9.3; DR5). Declared in the driver app's manifest only
// (plugins/withDriverAndroid.js), with android:permission="android.permission.BROADCAST_SMS" so only
// the system can call it, and two filters:
// - DATA_SMS_RECEIVED on DATA_SMS_PORT: the primary path. Every message on that port is stored.
// - SMS_RECEIVED: the text fallback. Only a text that starts with the heatmap prefix is stored;
//   any other text (a personal message) is left alone here, never read further or kept (DR5-M6).
// The phone's own Messages app still gets every text: since Android 4.4 an app that is not the
// default SMS app cannot stop that.
class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val kind = when (intent.action) {
      Telephony.Sms.Intents.DATA_SMS_RECEIVED_ACTION -> "data"
      Telephony.Sms.Intents.SMS_RECEIVED_ACTION -> "text"
      else -> return
    }
    val store = InboxStore(context)
    if (!store.enabled) return
    val parts = try {
      Telephony.Sms.Intents.getMessagesFromIntent(intent)?.filterNotNull()
    } catch (error: Exception) {
      null
    }
    if (parts.isNullOrEmpty()) return
    val first = parts[0]
    val body = if (kind == "data") {
      // A data message is a single part
      toHex(first.userData ?: return)
    } else {
      // A long text arrives as its parts, already put together by the system
      val text = parts.joinToString("") { it.messageBody ?: "" }
      val prefix = store.textPrefix ?: return
      if (!text.trimStart().startsWith(prefix)) return
      text
    }
    store.add(
      InboxEntry(
        kind = kind,
        sender = first.originatingAddress ?: "",
        body = body,
        smscMs = first.timestampMillis,
        receivedMs = System.currentTimeMillis(),
      )
    )
  }

  private fun toHex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
}
