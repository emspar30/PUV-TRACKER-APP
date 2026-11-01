package expo.modules.tuntonmotion

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// V1b (PRD 10.2, D6): the phone's activity recognition during a relay. Google Play services reports
// the most likely activity every few seconds; each report is kept here (at most MAX_SAMPLES) as
// "in a vehicle or not" with its confidence, and the app's verification window reads them. Started
// and stopped by the relay; nothing is stored on disk or sent anywhere.
class TuntonMotionModule : Module() {
  private data class Sample(val atMs: Long, val inVehicle: Boolean, val confidence: Int)

  private val samples = ArrayDeque<Sample>()
  private var receiver: BroadcastReceiver? = null
  private var pending: PendingIntent? = null

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No React context")

  override fun definition() = ModuleDefinition {
    Name("TuntonMotion")

    // Play services present and the permission granted
    Function("available") {
      val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
      granted
    }

    // Starts the reports every intervalMs; true when they were asked for
    Function("start") { intervalMs: Double ->
      startUpdates(intervalMs.toLong())
    }

    Function("stop") {
      stopUpdates()
    }

    // The reports since sinceMs, oldest first
    Function("samples") { sinceMs: Double ->
      synchronized(samples) {
        samples.filter { it.atMs >= sinceMs.toLong() }.map {
          mapOf("atMs" to it.atMs.toDouble(), "inVehicle" to it.inVehicle, "confidence" to it.confidence)
        }
      }
    }

    OnDestroy {
      stopUpdates()
    }
  }

  private fun startUpdates(intervalMs: Long): Boolean {
    stopUpdates()
    val ctx = context
    val action = "${ctx.packageName}.TUNTON_MOTION"
    val rx = object : BroadcastReceiver() {
      override fun onReceive(c: Context, intent: Intent) {
        if (!ActivityRecognitionResult.hasResult(intent)) return
        val result = ActivityRecognitionResult.extractResult(intent) ?: return
        val activity = result.mostProbableActivity
        val sample = Sample(result.time, activity.type == DetectedActivity.IN_VEHICLE, activity.confidence)
        synchronized(samples) {
          samples.addLast(sample)
          while (samples.size > MAX_SAMPLES) samples.removeFirst()
        }
      }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ctx.registerReceiver(rx, IntentFilter(action), Context.RECEIVER_NOT_EXPORTED)
    } else {
      ctx.registerReceiver(rx, IntentFilter(action))
    }
    receiver = rx
    // Activity recognition fills in the intent, so the pending intent must be mutable (Android 12+)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
    val intent = PendingIntent.getBroadcast(ctx, REQUEST_CODE, Intent(action).setPackage(ctx.packageName), flags)
    pending = intent
    return try {
      ActivityRecognition.getClient(ctx).requestActivityUpdates(intervalMs, intent)
      true
    } catch (error: SecurityException) {
      stopUpdates()
      false
    }
  }

  private fun stopUpdates() {
    val ctx = appContext.reactContext ?: return
    pending?.let {
      try {
        ActivityRecognition.getClient(ctx).removeActivityUpdates(it)
      } catch (error: SecurityException) {
        // Permission withdrawn meanwhile: nothing to remove
      }
      it.cancel()
    }
    pending = null
    receiver?.let {
      try {
        ctx.unregisterReceiver(it)
      } catch (error: IllegalArgumentException) {
        // Not registered
      }
    }
    receiver = null
  }

  companion object {
    private const val MAX_SAMPLES = 500
    private const val REQUEST_CODE = 4107
  }
}
