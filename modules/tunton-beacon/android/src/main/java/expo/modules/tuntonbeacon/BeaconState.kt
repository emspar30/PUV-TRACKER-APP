package expo.modules.tuntonbeacon

// What the beacon service is doing, shared with the module in the same process. The module sends
// each change to JavaScript as an onStatus event.
object BeaconState {
  @Volatile var advertising: Boolean = false
    private set
  @Volatile var lastSlot: Long? = null
    private set
  @Volatile var lastPayloadHex: String? = null
    private set
  @Volatile var lastError: String? = null
    private set

  private val listeners = mutableSetOf<() -> Unit>()

  fun update(advertising: Boolean, lastSlot: Long? = this.lastSlot, lastPayloadHex: String? = this.lastPayloadHex, lastError: String? = null) {
    this.advertising = advertising
    this.lastSlot = lastSlot
    this.lastPayloadHex = lastPayloadHex
    this.lastError = lastError
    val snapshot = synchronized(listeners) { listeners.toList() }
    snapshot.forEach { it() }
  }

  fun addListener(listener: () -> Unit) = synchronized(listeners) { listeners.add(listener) }

  fun removeListener(listener: () -> Unit) = synchronized(listeners) { listeners.remove(listener) }
}
