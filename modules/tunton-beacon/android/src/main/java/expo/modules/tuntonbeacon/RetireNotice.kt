package expo.modules.tuntonbeacon

import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

// The retire notice, read here too so a phone whose app is closed stops its beacon (backlog 134).
// The same rules as src/shared/sms/protocol.ts (signRetiredNotice) and binary.ts (its data form):
//   HM2|RETIRED|<device id>|<mac>   mac: the first 4 bytes of HMAC-SHA256 over everything before
//                                   the last pipe, upper-case hex, keyed with the SMS key's text
//   data form: 0x48 'H' | 0x02 | 0x00 (route byte 0: a notice) | id length | device id | mac (4)
object RetireNotice {
  private val TEXT = Regex("^HM2\\|RETIRED\\|([A-Z0-9-]{1,24})\\|([0-9A-F]{8})$")
  private val DEVICE_ID = Regex("^[A-Z0-9-]{1,24}$")
  private const val MAGIC = 0x48
  private const val FORMAT_VERSION = 0x02
  private const val NOTICE_ROUTE = 0x00
  private const val HEADER_BYTES = 4
  private const val MAC_BYTES = 4
  private const val ALGORITHM = "HmacSHA256"

  // The notice's text, or null for a text that is not one
  fun fromText(text: String): String? = text.trim().takeIf { TEXT.matches(it) }

  // The notice's text, or null for bytes that are not its data form
  fun fromData(bytes: ByteArray): String? {
    if (bytes.size < HEADER_BYTES + MAC_BYTES) return null
    if (bytes[0].toInt() != MAGIC || bytes[1].toInt() != FORMAT_VERSION || bytes[2].toInt() != NOTICE_ROUTE) return null
    val length = bytes[3].toInt() and 0xFF
    if (bytes.size != HEADER_BYTES + length + MAC_BYTES) return null
    val deviceId = String(bytes, HEADER_BYTES, length, Charsets.US_ASCII)
    if (!DEVICE_ID.matches(deviceId)) return null
    return "HM2|RETIRED|$deviceId|${hex(bytes.copyOfRange(HEADER_BYTES + length, bytes.size))}"
  }

  // Whether this phone's own SMS key signed the notice. Each phone has its own key, so a notice
  // signed with it is for this phone; another phone's notice, or a made-up one, fails here.
  fun isSignedWith(notice: String, key: String): Boolean {
    val match = TEXT.matchEntire(notice) ?: return false
    val mac = Mac.getInstance(ALGORITHM)
    mac.init(SecretKeySpec(key.toByteArray(Charsets.UTF_8), ALGORITHM))
    val digest = mac.doFinal(notice.substring(0, notice.lastIndexOf('|')).toByteArray(Charsets.UTF_8))
    val expected = hex(digest.copyOfRange(0, MAC_BYTES))
    return MessageDigest.isEqual(expected.toByteArray(Charsets.US_ASCII), match.groupValues[2].toByteArray(Charsets.US_ASCII))
  }

  private fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02X".format(it.toInt() and 0xFF) }
}
