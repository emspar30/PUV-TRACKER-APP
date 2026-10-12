package expo.modules.tuntonsms

// What the gateway service is doing, shared with the module in the same process. The module sends
// each change to JavaScript as an onGatewayStatus event.
object GatewayState {
  @Volatile var running: Boolean = false
  // null until the first request of this run
  @Volatile var workerReachable: Boolean? = null
  @Volatile var lastPullMs: Long? = null
  @Volatile var lastHeartbeatMs: Long? = null
  // unauthorized, worker_unreachable, worker_http_<status>, no_sim, ... (or null)
  @Volatile var lastError: String? = null

  private val listeners = mutableSetOf<() -> Unit>()

  fun changed() {
    val snapshot = synchronized(listeners) { listeners.toList() }
    snapshot.forEach { it() }
  }

  fun reset() {
    running = false
    workerReachable = null
    lastPullMs = null
    lastHeartbeatMs = null
    lastError = null
    changed()
  }

  fun addListener(listener: () -> Unit) = synchronized(listeners) { listeners.add(listener) }

  fun removeListener(listener: () -> Unit) = synchronized(listeners) { listeners.remove(listener) }
}
