package expo.modules.tuntonsms

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// The gateway phone's setup and running record (DR7), in this app's private preferences:
// - the worker address, the gateway id and its access token (encrypted with an AES-GCM key that lives
//   in the Android Keystore; the token is never given back to JavaScript);
// - the chosen SIM and the service settings JavaScript passed in (shared/config), so the service can
//   start again after a reboot without JavaScript;
// - today's sent, delivered and failed counts, and the last events (phone numbers masked).
class GatewayStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun setUp(gatewayId: String, workerUrl: String, token: String) {
    prefs.edit()
      .putString(KEY_GATEWAY, gatewayId)
      .putString(KEY_URL, workerUrl)
      .putString(KEY_TOKEN, seal(token))
      .apply()
  }

  val isSetUp: Boolean
    get() = gatewayId != null && workerUrl != null && token() != null

  val gatewayId: String?
    get() = prefs.getString(KEY_GATEWAY, null)

  val workerUrl: String?
    get() = prefs.getString(KEY_URL, null)

  // Null when the Keystore key was lost (a restored backup): the phone must be set up again
  fun token(): String? = prefs.getString(KEY_TOKEN, null)?.let { open(it) }

  var subscriptionId: Int?
    get() = prefs.getInt(KEY_SIM, NO_SIM).takeIf { it != NO_SIM }
    set(value) = prefs.edit().putInt(KEY_SIM, value ?: NO_SIM).apply()

  var enabled: Boolean
    get() = prefs.getBoolean(KEY_ENABLED, false)
    set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

  var settings: GatewaySettings?
    get() = prefs.getString(KEY_SETTINGS, null)?.let { GatewaySettings.fromJson(JSONObject(it)) }
    set(value) = prefs.edit().putString(KEY_SETTINGS, value?.toJson()?.toString()).apply()

  fun clearAll() {
    synchronized(LOCK) { prefs.edit().clear().commit() }
  }

  // --- Today's counts (the phone's own date) ---

  fun count(outcome: String) {
    synchronized(LOCK) {
      val today = today()
      val edit = prefs.edit()
      if (prefs.getString(KEY_DAY, null) != today) {
        edit.putString(KEY_DAY, today).putInt(KEY_SENT, 0).putInt(KEY_DELIVERED, 0).putInt(KEY_FAILED, 0)
      }
      val key = when (outcome) {
        "sent" -> KEY_SENT
        "delivered" -> KEY_DELIVERED
        else -> KEY_FAILED
      }
      val current = if (prefs.getString(KEY_DAY, null) == today) prefs.getInt(key, 0) else 0
      edit.putInt(key, current + 1).apply()
    }
  }

  fun counts(): Map<String, Int> = synchronized(LOCK) {
    if (prefs.getString(KEY_DAY, null) != today()) {
      mapOf("sent" to 0, "delivered" to 0, "failed" to 0)
    } else {
      mapOf("sent" to prefs.getInt(KEY_SENT, 0), "delivered" to prefs.getInt(KEY_DELIVERED, 0), "failed" to prefs.getInt(KEY_FAILED, 0))
    }
  }

  // --- Events, newest last in storage ---

  fun addEvent(kind: String, text: String, max: Int) {
    synchronized(LOCK) {
      val array = events()
      array.put(JSONObject().put("atMs", System.currentTimeMillis()).put("kind", kind).put("text", Mask.phonesIn(text)))
      val start = (array.length() - max.coerceAtLeast(1)).coerceAtLeast(0)
      val kept = JSONArray()
      for (i in start until array.length()) kept.put(array.getJSONObject(i))
      prefs.edit().putString(KEY_EVENTS, kept.toString()).apply()
    }
  }

  // Newest first
  fun eventList(): List<Map<String, Any>> = synchronized(LOCK) {
    val array = events()
    (array.length() - 1 downTo 0).map {
      val event = array.getJSONObject(it)
      mapOf("atMs" to event.getLong("atMs").toDouble(), "kind" to event.getString("kind"), "text" to event.getString("text"))
    }
  }

  private fun events(): JSONArray = try {
    JSONArray(prefs.getString(KEY_EVENTS, "[]"))
  } catch (error: Exception) {
    JSONArray()
  }

  private fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  // --- Encryption ---

  private fun seal(value: String): String {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, key())
    return Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
  }

  private fun open(stored: String): String? = try {
    val sealed = Base64.decode(stored, Base64.NO_WRAP)
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, sealed, 0, IV_BYTES))
    String(cipher.doFinal(sealed, IV_BYTES, sealed.size - IV_BYTES), Charsets.UTF_8)
  } catch (error: Exception) {
    null
  }

  private fun key(): SecretKey {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (keyStore.getKey(ALIAS, null) as? SecretKey)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build()
    )
    return generator.generateKey()
  }

  companion object {
    private val LOCK = Any()
    private const val PREFS = "tunton_gateway"
    private const val KEYSTORE = "AndroidKeyStore"
    private const val ALIAS = "tunton_gateway_secrets"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_BYTES = 12
    private const val TAG_BITS = 128
    private const val NO_SIM = -1
    private const val KEY_GATEWAY = "gatewayId"
    private const val KEY_URL = "workerUrl"
    private const val KEY_TOKEN = "token"
    private const val KEY_SIM = "subscriptionId"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_SETTINGS = "settings"
    private const val KEY_DAY = "day"
    private const val KEY_SENT = "sent"
    private const val KEY_DELIVERED = "delivered"
    private const val KEY_FAILED = "failed"
    private const val KEY_EVENTS = "events"
  }
}

// What JavaScript passes when it starts the service (from shared/config); stored for reboots
data class GatewaySettings(
  val pullS: Int,
  val heartbeatS: Int,
  val sendGapMs: Int,
  val sentTimeoutS: Int,
  val pullMax: Int,
  val backoffS: List<Int>,
  val eventsMax: Int,
  val notificationTitle: String,
  val notificationText: String,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("pullS", pullS)
    .put("heartbeatS", heartbeatS)
    .put("sendGapMs", sendGapMs)
    .put("sentTimeoutS", sentTimeoutS)
    .put("pullMax", pullMax)
    .put("backoffS", JSONArray(backoffS))
    .put("eventsMax", eventsMax)
    .put("notificationTitle", notificationTitle)
    .put("notificationText", notificationText)

  companion object {
    fun fromJson(json: JSONObject): GatewaySettings {
      val backoff = json.getJSONArray("backoffS")
      return GatewaySettings(
        pullS = json.getInt("pullS"),
        heartbeatS = json.getInt("heartbeatS"),
        sendGapMs = json.getInt("sendGapMs"),
        sentTimeoutS = json.getInt("sentTimeoutS"),
        pullMax = json.getInt("pullMax"),
        backoffS = List(backoff.length()) { backoff.getInt(it) },
        eventsMax = json.getInt("eventsMax"),
        notificationTitle = json.getString("notificationTitle"),
        notificationText = json.getString("notificationText"),
      )
    }
  }
}

// Phone numbers in event texts and logs: +639171234567 -> +63917•••4567 (the worker's mask.ts)
object Mask {
  private val PHONE = Regex("""\+63(\d{3})\d{3}(\d{4})""")

  fun phonesIn(text: String): String = PHONE.replace(text) { "+63${it.groupValues[1]}•••${it.groupValues[2]}" }
}
