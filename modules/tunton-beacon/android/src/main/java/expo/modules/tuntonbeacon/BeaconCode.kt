package expo.modules.tuntonbeacon

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

// The driver beacon's rotating code (PRD 8.2; docs/IMPLEMENTATION_PLAN_DRIVER.md 6.1). The same rule
// as src/shared/beacon/code.ts, checked against the same vectors (BeaconCodeTest):
//   payload = version (1) | shortId (2) | slot & 0xFFFF (2) | mac (4), big-endian
//   mac     = first 4 bytes of HMAC-SHA256(secret, version | shortId | slot as uint32)
object BeaconCode {
  const val PAYLOAD_BYTES = 9
  private const val SIGNED_BYTES = 7
  private const val MAC_BYTES = 4

  fun slotOf(epochMs: Long, slotSeconds: Int): Long = epochMs / 1000L / slotSeconds

  fun payload(version: Int, shortId: Int, slot: Long, secret: ByteArray): ByteArray {
    require(shortId in 1..0xFFFF) { "shortId must be 1 to 65535" }
    require(slot in 0..0xFFFFFFFFL) { "slot must fit 32 bits" }
    val signed = ByteArray(SIGNED_BYTES)
    signed[0] = version.toByte()
    signed[1] = (shortId ushr 8).toByte()
    signed[2] = shortId.toByte()
    signed[3] = (slot ushr 24).toByte()
    signed[4] = (slot ushr 16).toByte()
    signed[5] = (slot ushr 8).toByte()
    signed[6] = slot.toByte()

    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(secret, "HmacSHA256"))
    val digest = mac.doFinal(signed)

    val out = ByteArray(PAYLOAD_BYTES)
    out[0] = signed[0]
    out[1] = signed[1]
    out[2] = signed[2]
    out[3] = (slot ushr 8).toByte()
    out[4] = slot.toByte()
    System.arraycopy(digest, 0, out, 5, MAC_BYTES)
    return out
  }

  fun hexToBytes(hex: String): ByteArray {
    require(hex.length % 2 == 0 && hex.all { it in "0123456789abcdefABCDEF" }) { "not hex" }
    return ByteArray(hex.length / 2) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
  }

  fun toHex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
}
