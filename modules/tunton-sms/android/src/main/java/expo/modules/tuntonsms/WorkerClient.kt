package expo.modules.tuntonsms

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

// The gateway's side of the worker API (docs/IMPLEMENTATION_PLAN_DRIVER.md 6.4; DR6 http.ts), with
// Android's own HttpURLConnection: no extra library. HTTPS in preview and release builds (Android
// refuses plain HTTP there); development builds may use http://localhost through `adb reverse`.
class WorkerClient(private val baseUrl: String, private val token: String) {
  class HttpError(val status: Int) : IOException("worker answered HTTP $status")

  data class Pulled(val id: Long, val to: String, val encoding: String, val text: String?, val dataB64: String?, val port: Int?)

  fun pull(max: Int): List<Pulled> {
    val body = post("/v1/pull", JSONObject().put("max", max)) ?: return emptyList()
    val messages = body.optJSONArray("messages") ?: return emptyList()
    return List(messages.length()) {
      val m = messages.getJSONObject(it)
      Pulled(
        id = m.getLong("id"),
        to = m.getString("to"),
        encoding = m.getString("encoding"),
        text = if (m.has("text")) m.getString("text") else null,
        dataB64 = if (m.has("dataB64")) m.getString("dataB64") else null,
        port = if (m.has("port")) m.getInt("port") else null,
      )
    }
  }

  // True if the worker took it; false when the message was not this gateway's to report (409)
  fun result(id: Long, status: String, errorCode: String?): Boolean {
    val body = JSONObject().put("id", id).put("status", status).put("atMs", System.currentTimeMillis())
    if (errorCode != null) body.put("errorCode", errorCode)
    return try {
      post("/v1/result", body)
      true
    } catch (error: HttpError) {
      if (error.status == HTTP_CONFLICT) false else throw error
    }
  }

  // The pull interval the worker asks for, in seconds
  fun heartbeat(status: JSONObject): Int? = post("/v1/heartbeat", status)?.optInt("pullEveryS")

  private fun post(path: String, body: JSONObject): JSONObject? {
    val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
    try {
      connection.requestMethod = "POST"
      connection.connectTimeout = TIMEOUT_MS
      connection.readTimeout = TIMEOUT_MS
      connection.doOutput = true
      connection.setRequestProperty("Authorization", "Bearer $token")
      connection.setRequestProperty("Content-Type", "application/json")
      connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
      val status = connection.responseCode
      if (status == HTTP_NO_CONTENT) return null
      if (status !in HTTP_OK_RANGE) throw HttpError(status)
      val text = connection.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
      return if (text.isBlank()) null else JSONObject(text)
    } finally {
      connection.disconnect()
    }
  }

  companion object {
    private const val TIMEOUT_MS = 15_000
    private const val HTTP_NO_CONTENT = 204
    private const val HTTP_CONFLICT = 409
    private val HTTP_OK_RANGE = 200..299
  }
}
