import { RSSI_SMOOTHING_ALPHA } from '../config';

// PRD 12.4: RSSI_t = alpha x RSSI_raw + (1 - alpha) x RSSI_(t-1).
// The first reading (previous === null) initializes the average.
export function smoothRssi(previous: number | null, raw: number, alpha: number = RSSI_SMOOTHING_ALPHA): number {
  if (previous === null) return raw;
  return alpha * raw + (1 - alpha) * previous;
}
