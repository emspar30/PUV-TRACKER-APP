package expo.modules.tuntonbeacon

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// The driver phone's secrets (PRD 9.5; DR4): encrypted with an AES-GCM key that lives in the Android
// Keystore and never leaves it; the ciphertext sits in this app's private preferences. Also holds the
// beacon settings JavaScript passed in, so the beacon can restart after a reboot without JavaScript.
class SecretStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun put(name: String, value: String) {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val sealed = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
    prefs.edit().putString(SECRET_PREFIX + name, Base64.encodeToString(sealed, Base64.NO_WRAP)).apply()
  }

  fun get(name: String): String? {
    val stored = prefs.getString(SECRET_PREFIX + name, null) ?: return null
    return try {
      val sealed = Base64.decode(stored, Base64.NO_WRAP)
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, sealed, 0, IV_BYTES))
      String(cipher.doFinal(sealed, IV_BYTES, sealed.size - IV_BYTES), Charsets.UTF_8)
    } catch (error: Exception) {
      // The Keystore key was lost (a restored backup, a reset lock screen): the phone must be set up again
      null
    }
  }

  fun clearAll() {
    prefs.edit().clear().apply()
  }

  var shortId: Int
    get() = prefs.getInt(KEY_SHORT_ID, 0)
    set(value) = prefs.edit().putInt(KEY_SHORT_ID, value).apply()

  var enabled: Boolean
    get() = prefs.getBoolean(KEY_ENABLED, false)
    set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

  var settings: BeaconSettings?
    get() {
      val uuid = prefs.getString(KEY_UUID, null) ?: return null
      return BeaconSettings(
        serviceUuid = uuid,
        version = prefs.getInt(KEY_VERSION, 1),
        slotSeconds = prefs.getInt(KEY_SLOT_S, 60),
        mode = prefs.getString(KEY_MODE, "balanced") ?: "balanced",
        txPower = prefs.getString(KEY_TX, "medium") ?: "medium",
        notificationTitle = prefs.getString(KEY_TITLE, "Tunton beacon on") ?: "Tunton beacon on",
        notificationText = prefs.getString(KEY_TEXT, "") ?: "",
      )
    }
    set(value) {
      val edit = prefs.edit()
      if (value == null) {
        listOf(KEY_UUID, KEY_VERSION, KEY_SLOT_S, KEY_MODE, KEY_TX, KEY_TITLE, KEY_TEXT).forEach { edit.remove(it) }
      } else {
        edit.putString(KEY_UUID, value.serviceUuid)
          .putInt(KEY_VERSION, value.version)
          .putInt(KEY_SLOT_S, value.slotSeconds)
          .putString(KEY_MODE, value.mode)
          .putString(KEY_TX, value.txPower)
          .putString(KEY_TITLE, value.notificationTitle)
          .putString(KEY_TEXT, value.notificationText)
      }
      edit.apply()
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
    private const val PREFS = "tunton_beacon"
    private const val KEYSTORE = "AndroidKeyStore"
    private const val ALIAS = "tunton_driver_secrets"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_BYTES = 12
    private const val TAG_BITS = 128
    private const val SECRET_PREFIX = "secret."
    private const val KEY_SHORT_ID = "shortId"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_UUID = "serviceUuid"
    private const val KEY_VERSION = "version"
    private const val KEY_SLOT_S = "slotSeconds"
    private const val KEY_MODE = "mode"
    private const val KEY_TX = "txPower"
    private const val KEY_TITLE = "notificationTitle"
    private const val KEY_TEXT = "notificationText"

    const val BEACON_SECRET = "beacon_secret"
    const val SMS_KEY = "sms_key"
  }
}

data class BeaconSettings(
  val serviceUuid: String,
  val version: Int,
  val slotSeconds: Int,
  val mode: String,
  val txPower: String,
  val notificationTitle: String,
  val notificationText: String,
)
