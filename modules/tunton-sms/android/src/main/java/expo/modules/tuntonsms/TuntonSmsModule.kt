package expo.modules.tuntonsms

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.telephony.SubscriptionManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

class SmsInputException(message: String) : CodedException("ERR_TUNTON_SMS_INPUT", message, null)

class SmsPermissionException(permission: String) : CodedException("ERR_TUNTON_SMS_PERMISSION", "$permission is not granted", null)

class SmsSendException(message: String) : CodedException("ERR_TUNTON_SMS_SEND", message, null)

// JavaScript side of SMS (DR5). The driver app turns its inbox on with configure() once the phone is
// set up, drains it and validates each message in TypeScript. The gateway app sends text or data
// SMS and gets each one's results as onSendResult events. The settings come from JavaScript
// (shared/config); the module stores them so the receiver works while the app is closed.
class TuntonSmsModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private val arrivedListener: () -> Unit = { sendEvent(ARRIVED_EVENT, emptyMap<String, Any>()) }

  private var sender: SmsSender? = null

  override fun definition() = ModuleDefinition {
    Name("TuntonSms")

    Events(ARRIVED_EVENT, SEND_RESULT_EVENT)

    OnStartObserving { InboxEvents.addListener(arrivedListener) }
    OnStopObserving { InboxEvents.removeListener(arrivedListener) }

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
    private const val MAX_PORT = 65535
    private const val HEX_RADIX = 16
    private val HEX = Regex("^([0-9a-fA-F]{2})+$")
  }
}
