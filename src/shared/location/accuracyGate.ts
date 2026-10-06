// G0: which GPS fixes are good enough for a feature that needs precision (PRD 7.5, 8.4, 10.3).
// Check-in uses GPS_ACCURACY_GATE_CHECKIN_M and a relay with GPS uses GPS_ACCURACY_GATE_RELAY_M.
// A mock fix and a stale one are refused whatever their accuracy. The blue dot still shows every
// fix, with its accuracy ring. Pure: the age is passed in.

import { FAKE_FIX_STALE_AGE_S, LOCATION_FIX_MAX_AGE_S } from '../config';
import type { LatLon } from '../geo/haversine';

const MS_PER_S = 1000;

export type FixQuality = {
  accuracyM: number | null;
  mocked: boolean;
  // Seconds since the fix was taken; null when unknown
  ageS: number | null;
};

export type FixRejection = 'mocked' | 'stale' | 'poor_accuracy';

export type GateResult = { ok: true } | { ok: false; reason: FixRejection };

export function fixAgeS(timestampMs: number, nowMs: number): number {
  return Math.max(0, (nowMs - timestampMs) / MS_PER_S);
}

// A fix passes when it is not mocked, at most maxAgeS old, and accurate to gateM or better
export function acceptFix(fix: FixQuality, gateM: number, maxAgeS = LOCATION_FIX_MAX_AGE_S): GateResult {
  if (fix.mocked) return { ok: false, reason: 'mocked' };
  if (fix.ageS === null || fix.ageS > maxAgeS) return { ok: false, reason: 'stale' };
  if (fix.accuracyM === null || fix.accuracyM > gateM) return { ok: false, reason: 'poor_accuracy' };
  return { ok: true };
}

export type FakeFixOptions = { accuracyM: number; mocked: boolean; stale: boolean };

// The development fake source (emulator only): a fix at a chosen point with a chosen accuracy,
// mock flag and age, so the gates can be tried without going outdoors
export function fakeFix(point: LatLon, options: FakeFixOptions, nowMs: number) {
  return {
    lat: point.lat,
    lon: point.lon,
    accuracyM: options.accuracyM,
    headingDeg: null,
    speedMps: null,
    timestampMs: options.stale ? nowMs - FAKE_FIX_STALE_AGE_S * MS_PER_S : nowMs,
    mocked: options.mocked,
  };
}
