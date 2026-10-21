package expo.modules.tuntonsms

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.telephony.SmsManager
import android.telephony.SmsMessage
import java.util.concurrent.atomic.AtomicInteger

// Sends one SMS, text or data, from a chosen SIM and reports what the network says (DR5). Used by
// the gateway's carrier-test screen now and by its sending service in DR7. Needs SEND_SMS, which only
// the gateway app holds (plugins/withGatewayAndroid.js); anywhere else Android refuses the send.
//
// Each message gets two results through onResult: "sent" (the network took it, or why not) and,
// when the network sends a delivery report, "delivered" (the receiving phone got it).
class SmsSender(context: Context, private val onResult: (SendResult) -> Unit) {
  private val context = context.applicationContext
  private var registered = false

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val id = intent.getStringExtra(EXTRA_ID) ?: return
      val atMs = System.currentTimeMillis()
      when (intent.action) {
        ACTION_SENT -> onResult(
          SendResult(
            id = id,
            stage = "sent",
            ok = resultCode == Activity.RESULT_OK,
            resultCode = resultCode,
            errorCode = intent.getIntExtra(EXTRA_ERROR_CODE, NO_CODE).takeIf { it != NO_CODE },
            status = null,
            atMs = atMs,
          )
        )
        ACTION_DELIVERED -> {
          val status = deliveryStatus(intent)
          onResult(
            SendResult(
              id = id,
              stage = "delivered",
              // GSM status report: 0x00 to 0x1F means the message reached the phone
              ok = status != null && status in 0..GSM_STATUS_DELIVERED_MAX,
              resultCode = resultCode,
              errorCode = null,
              status = status,
              atMs = atMs,
            )
          )
        }
      }
    }
  }

  fun start() {
    if (registered) return
    val filter = IntentFilter().apply {
      addAction(ACTION_SENT)
      addAction(ACTION_DELIVERED)
    }
    // The results come back through this app's own PendingIntents, so the receiver is not exported
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      context.registerReceiver(receiver, filter)
    }
    registered = true
  }

  fun stop() {
    if (!registered) return
    try {
      context.unregisterReceiver(receiver)
    } catch (error: IllegalArgumentException) {
      // Already gone
    }
    registered = false
  }

  // Throws if the text needs more than one SMS: the worker packs every message into one (pack.ts)
  fun sendText(id: String, to: String, text: String, subscriptionId: Int?) {
    val manager = manager(subscriptionId)
    if (manager.divideMessage(text).size > 1) throw IllegalArgumentException("The text does not fit one SMS")
    manager.sendTextMessage(to, null, text, pending(ACTION_SENT, id), pending(ACTION_DELIVERED, id))
  }

  fun sendData(id: String, to: String, port: Int, data: ByteArray, subscriptionId: Int?) {
    manager(subscriptionId).sendDataMessage(to, null, port.toShort(), data, pending(ACTION_SENT, id), pending(ACTION_DELIVERED, id))
  }

  @Suppress("DEPRECATION")
  private fun manager(subscriptionId: Int?): SmsManager {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val base = context.getSystemService(SmsManager::class.java)
      return if (subscriptionId == null) base else base.createForSubscriptionId(subscriptionId)
    }
    return if (subscriptionId == null) SmsManager.getDefault() else SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
  }

  // Mutable, because Android adds the error code and the status report to the intent; explicit (this
  // app's package), as Android 14 requires for a mutable PendingIntent
  private fun pending(action: String, id: String): PendingIntent {
    val intent = Intent(action).setPackage(context.packageName).putExtra(EXTRA_ID, id)
    val flags = PendingIntent.FLAG_ONE_SHOT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
    return PendingIntent.getBroadcast(context, REQUEST_CODES.incrementAndGet(), intent, flags)
  }

  private fun deliveryStatus(intent: Intent): Int? {
    val pdu = intent.getByteArrayExtra("pdu") ?: return null
    val format = intent.getStringExtra("format") ?: return null
    return try {
      SmsMessage.createFromPdu(pdu, format)?.status
    } catch (error: Exception) {
      null
    }
  }

  companion object {
    private const val ACTION_SENT = "expo.modules.tuntonsms.SENT"
    private const val ACTION_DELIVERED = "expo.modules.tuntonsms.DELIVERED"
    private const val EXTRA_ID = "id"
    private const val EXTRA_ERROR_CODE = "errorCode"
    private const val NO_CODE = Int.MIN_VALUE
    private const val GSM_STATUS_DELIVERED_MAX = 0x1F
    // Every PendingIntent is distinct, so two messages never share one
    private val REQUEST_CODES = AtomicInteger((System.currentTimeMillis() and 0xFFFFFF).toInt())
  }
}

data class SendResult(
  val id: String,
  // "sent" or "delivered"
  val stage: String,
  val ok: Boolean,
  val resultCode: Int,
  val errorCode: Int?,
  // The delivery report's status (GSM TP-Status), for "delivered" only
  val status: Int?,
  val atMs: Long,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "stage" to stage,
    "ok" to ok,
    "resultCode" to resultCode,
    "errorCode" to errorCode,
    "status" to status,
    "atMs" to atMs.toDouble(),
  )
}
