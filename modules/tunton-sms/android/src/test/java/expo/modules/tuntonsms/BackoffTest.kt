package expo.modules.tuntonsms

import org.junit.Assert.assertEquals
import org.junit.Test

// DR7: the gateway's wait before trying the worker again (plan DR7 tests: BackoffTest.kt)
class BackoffTest {
  private val steps = listOf(10, 30, 60, 120)

  @Test
  fun noWaitBeforeAFailure() {
    assertEquals(0, Backoff.delayS(0, steps))
  }

  @Test
  fun followsTheStepsThenStaysAtTheCap() {
    assertEquals(listOf(10, 30, 60, 120, 120, 120), (1..6).map { Backoff.delayS(it, steps) })
  }

  @Test
  fun noStepsMeansNoWait() {
    assertEquals(0, Backoff.delayS(3, emptyList()))
  }
}
