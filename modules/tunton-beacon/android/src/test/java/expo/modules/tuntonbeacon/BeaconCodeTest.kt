package expo.modules.tuntonbeacon

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// DR4: the Kotlin beacon code gives exactly the payloads of tests/fixtures/beacon-vectors.json, the
// vectors the TypeScript code (and later the SQL check) is tested against. The resource here is a
// copy, kept identical by src/shared/__tests__/beaconVectorsSync.test.ts.
// Run after a prebuild: cd android; .\gradlew.bat :tunton-beacon:testDebugUnitTest
class BeaconCodeTest {
  private data class Vector(val secretHex: String, val shortId: Int, val slot: Long, val payloadHex: String)

  private fun vectors(): List<Vector> {
    val text = javaClass.classLoader!!.getResource("beacon-vectors.json")!!.readText()
    val entry = Regex(
      """\{\s*"secretHex":\s*"([0-9a-f]{64})",\s*"shortId":\s*(\d+),\s*"slot":\s*(\d+),\s*"payloadHex":\s*"([0-9a-f]{18})"\s*\}"""
    )
    return entry.findAll(text).map { Vector(it.groupValues[1], it.groupValues[2].toInt(), it.groupValues[3].toLong(), it.groupValues[4]) }.toList()
  }

  @Test
  fun matchesEverySharedVector() {
    val all = vectors()
    assertEquals(12, all.size)
    for (vector in all) {
      val payload = BeaconCode.payload(1, vector.shortId, vector.slot, BeaconCode.hexToBytes(vector.secretHex))
      assertEquals("shortId ${vector.shortId}, slot ${vector.slot}", vector.payloadHex, BeaconCode.toHex(payload))
    }
  }

  @Test
  fun countsSlotsOfSixtySeconds() {
    assertEquals(29_600_000L, BeaconCode.slotOf(29_600_000L * 60_000L + 30_000L, 60))
    assertEquals(29_599_999L, BeaconCode.slotOf(29_600_000L * 60_000L - 1L, 60))
  }

  @Test
  fun refusesWhatTheFormatCannotCarry() {
    val secret = ByteArray(32)
    for (bad in listOf(0, 65536)) {
      assertTrue(runCatching { BeaconCode.payload(1, bad, 1, secret) }.isFailure)
    }
    assertTrue(runCatching { BeaconCode.payload(1, 1, 0x1_0000_0000L, secret) }.isFailure)
    assertTrue(runCatching { BeaconCode.hexToBytes("abc") }.isFailure)
  }
}
