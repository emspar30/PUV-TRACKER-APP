package expo.modules.tuntonsms

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

// The driver phone's heatmap inbox (DR5): what SmsReceiver accepted, kept in this app's private
// preferences until JavaScript drains it, so a message that arrives while the app is closed is
// applied when it opens. A ring of `inboxMax` entries: the oldest go first. Only heatmap messages
// are ever stored; JavaScript checks the sender and the signature. Nothing is stored until
// JavaScript has called configure() (the phone is set up), and nothing after disable().
class InboxStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  val enabled: Boolean
    get() = prefs.getBoolean(KEY_ENABLED, false)

  val textPrefix: String?
    get() = prefs.getString(KEY_PREFIX, null)

  fun configure(textPrefix: String, inboxMax: Int) {
    prefs.edit()
      .putBoolean(KEY_ENABLED, true)
      .putString(KEY_PREFIX, textPrefix)
      .putInt(KEY_MAX, inboxMax)
      .apply()
  }

  // Stop receiving and forget everything stored (the phone is being set up again)
  fun disable() {
    synchronized(LOCK) { prefs.edit().clear().commit() }
  }

  fun add(entry: InboxEntry) {
    synchronized(LOCK) {
      if (!enabled) return
      val max = prefs.getInt(KEY_MAX, 0).coerceAtLeast(1)
      val all = read()
      all.add(entry)
      val kept = if (all.size > max) all.subList(all.size - max, all.size) else all
      write(kept)
    }
    InboxEvents.notifyArrived()
  }

  // Everything stored, oldest first, and the inbox emptied
  fun drain(): List<InboxEntry> = synchronized(LOCK) {
    val all = read()
    if (all.isNotEmpty()) write(emptyList())
    all
  }

  fun size(): Int = synchronized(LOCK) { read().size }

  private fun read(): MutableList<InboxEntry> {
    val stored = prefs.getString(KEY_INBOX, null) ?: return mutableListOf()
    return try {
      val array = JSONArray(stored)
      MutableList(array.length()) { InboxEntry.fromJson(array.getJSONObject(it)) }
    } catch (error: Exception) {
      // A damaged inbox is dropped; the next heatmap message replaces what was lost
      mutableListOf()
    }
  }

  private fun write(entries: List<InboxEntry>) {
    val array = JSONArray()
    entries.forEach { array.put(it.toJson()) }
    // commit, not apply: a receiver's process can be killed right after onReceive
    prefs.edit().putString(KEY_INBOX, array.toString()).commit()
  }

  companion object {
    private val LOCK = Any()
    private const val PREFS = "tunton_sms"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_PREFIX = "textPrefix"
    private const val KEY_MAX = "inboxMax"
    private const val KEY_INBOX = "inbox"
  }
}

// kind: "data" (body = the user data as hex) or "text" (body = the message text).
// smscMs: when the carrier's message centre took the message (its clock); receivedMs: this phone's.
data class InboxEntry(
  val kind: String,
  val sender: String,
  val body: String,
  val smscMs: Long,
  val receivedMs: Long,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("kind", kind)
    .put("sender", sender)
    .put("body", body)
    .put("smscMs", smscMs)
    .put("receivedMs", receivedMs)

  fun toMap(): Map<String, Any> = mapOf(
    "kind" to kind,
    "sender" to sender,
    "body" to body,
    "smscMs" to smscMs.toDouble(),
    "receivedMs" to receivedMs.toDouble(),
  )

  companion object {
    fun fromJson(json: JSONObject) = InboxEntry(
      kind = json.getString("kind"),
      sender = json.getString("sender"),
      body = json.getString("body"),
      smscMs = json.getLong("smscMs"),
      receivedMs = json.getLong("receivedMs"),
    )
  }
}

// Tells the module, when JavaScript is listening, that the inbox has something new. The event
// carries nothing: JavaScript drains the inbox, so a missed event loses nothing.
object InboxEvents {
  private val listeners = mutableSetOf<() -> Unit>()

  fun notifyArrived() {
    val snapshot = synchronized(listeners) { listeners.toList() }
    snapshot.forEach { it() }
  }

  fun addListener(listener: () -> Unit) = synchronized(listeners) { listeners.add(listener) }

  fun removeListener(listener: () -> Unit) = synchronized(listeners) { listeners.remove(listener) }
}
