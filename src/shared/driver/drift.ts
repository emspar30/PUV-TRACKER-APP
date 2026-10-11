import { CLOCK_DRIFT_SAMPLES, CLOCK_DRIFT_WARN_S } from '../config';

// Is the driver phone's clock right (PRD 8.2, 14)? The phone has no data plan and asks no server, so
// the outside clock is the carrier's: every SMS carries the time the carrier's message centre took it.
// A sample is (phone time on arrival) minus (carrier time). Delivery delay only ever makes a sample
// larger, never smaller, so the estimate is the smallest of the recent samples: the message that
// arrived fastest says the most about the clock. A wrong clock is also when heatmap messages fail
// (stale_time), so samples are taken from rejected messages too.

const MS_PER_S = 1000;

export type DriftStatus = { kind: 'unknown' } | { kind: 'ok' | 'warn'; driftS: number };

// Seconds the phone is ahead of the carrier (negative: behind)
export function driftSample(phoneMs: number, carrierMs: number): number {
  return (phoneMs - carrierMs) / MS_PER_S;
}

// samples: oldest first; only the last CLOCK_DRIFT_SAMPLES count
export function driftStatus(samples: readonly number[]): DriftStatus {
  const recent = samples.slice(-CLOCK_DRIFT_SAMPLES);
  if (recent.length === 0) return { kind: 'unknown' };
  const driftS = Math.min(...recent);
  return { kind: Math.abs(driftS) > CLOCK_DRIFT_WARN_S ? 'warn' : 'ok', driftS };
}
