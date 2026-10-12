package expo.modules.tuntonsms

// How long the gateway waits before trying the worker again after failures in a row (DR7): the steps
// come from JavaScript (GATEWAY_BACKOFF_S, 10, 30, 60, 120 s); past the last step it stays there.
object Backoff {
  fun delayS(failuresInARow: Int, steps: List<Int>): Int {
    if (steps.isEmpty() || failuresInARow < 1) return 0
    return steps[(failuresInARow - 1).coerceAtMost(steps.size - 1)]
  }
}
