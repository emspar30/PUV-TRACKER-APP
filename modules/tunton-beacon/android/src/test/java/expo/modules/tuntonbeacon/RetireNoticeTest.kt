package expo.modules.tuntonbeacon

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Backlog 134: the Kotlin reader of the retire notice agrees with the TypeScript one. The vector was
// made by src/shared/sms/protocol.ts signRetiredNotice('DRV-0011', 'a' x 64) and binary.ts
// encodeRetiredNoticeBinary (driverInbox.test.ts and smsPacking.test.ts check the same rules).
// Run after a prebuild: cd android; .\gradlew.bat :tunton-beacon:testDebugUnitTest
class RetireNoticeTest {
  private val key = "a".repeat(64)
  private val notice = "HM2|RETIRED|DRV-0011|3F062847"
  private val dataHex = "480200084452562D303031313F062847"

  private fun bytes(hex: String) = ByteArray(hex.length / 2) { hex.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

  @Test
  fun readsTheDataFormAsTheSameText() {
    assertEquals(notice, RetireNotice.fromData(bytes(dataHex)))
  }

  @Test
  fun acceptsOnlyThisKeysSignature() {
    assertTrue(RetireNotice.isSignedWith(notice, key))
    assertFalse(RetireNotice.isSignedWith(notice, "b".repeat(64)))
    assertFalse(RetireNotice.isSignedWith(notice.replace("DRV-0011", "DRV-0099"), key))
    assertFalse(RetireNotice.isSignedWith("HM2|R4|0001|1200|SMB:3|00000000", key))
  }

  @Test
  fun readsTheTextFormTrimmed() {
    assertEquals(notice, RetireNotice.fromText("  $notice\n"))
    assertNull(RetireNotice.fromText("hello"))
  }

  @Test
  fun refusesCutPaddedOrHeatmapBytes() {
    val all = bytes(dataHex)
    assertNull(RetireNotice.fromData(all.copyOfRange(0, all.size - 1)))
    assertNull(RetireNotice.fromData(all + byteArrayOf(0)))
    val heatmapRoute = all.copyOf().also { it[2] = 4 }
    assertNull(RetireNotice.fromData(heatmapRoute))
    val lowerCase = all.copyOf().also { it[4] = 'd'.code.toByte() }
    assertNull(RetireNotice.fromData(lowerCase))
  }
}
