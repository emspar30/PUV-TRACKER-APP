// The stopped bubble (PRD 7.3): a vehicle is "Stopped" when every speed over the last 45 s is under
// 2 km/h, and the samples reach back that far.

import { STATIONARY_DURATION_S, STATIONARY_SPEED_KMH } from '../config';
import type { SpeedSample } from './vehicle';

const MS_PER_S = 1000;

export function isStopped(samples: readonly SpeedSample[], nowMs: number): boolean {
  const windowStartMs = nowMs - STATIONARY_DURATION_S * MS_PER_S;
  // Without a sample from the start of the window, 45 s of standing still is not shown yet
  if (!samples.some((sample) => sample.atMs <= windowStartMs)) return false;
  const inWindow = samples.filter((sample) => sample.atMs >= windowStartMs && sample.atMs <= nowMs);
  return inWindow.length > 0 && inWindow.every((sample) => sample.speedKmh < STATIONARY_SPEED_KMH);
}
