// RK1 (PRD 10.3): a position too far from the vehicle's last one for the time between them. More than
// IMPOSSIBLE_SPEED_KMH is a forged or teleporting sender; the ingest function rejects the position and
// books an impossible_speed risk event. GPS wander at a standstill is allowed for: the first
// SPEED_JUMP_ALLOWANCE_M of the distance do not count. Pure TypeScript with only the server config
// imported, shared by the Edge Function (Deno) and the app's tests.

import { IMPOSSIBLE_SPEED_KMH, SPEED_JUMP_ALLOWANCE_M } from './serverConfig.ts';

const EARTH_RADIUS_M = 6371008.8;
const DEG_TO_RAD = Math.PI / 180;
const MS_PER_HOUR = 3_600_000;
const M_PER_KM = 1000;
const HALF = 0.5;

export type TimedPoint = { lat: number; lon: number; atMs: number };

function metresBetween(a: TimedPoint, b: TimedPoint): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const h = Math.sin(dLat * HALF) ** 2 + Math.cos(a.lat * DEG_TO_RAD) * Math.cos(b.lat * DEG_TO_RAD) * Math.sin(dLon * HALF) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// The speed `next` implies from `previous`, in km/h, after the allowance; 0 when not later
export function impliedSpeedKmh(previous: TimedPoint, next: TimedPoint): number {
  const hours = (next.atMs - previous.atMs) / MS_PER_HOUR;
  if (hours <= 0) return 0;
  const metres = Math.max(0, metresBetween(previous, next) - SPEED_JUMP_ALLOWANCE_M);
  return metres / M_PER_KM / hours;
}

export function isImpossibleJump(previous: TimedPoint | null, next: TimedPoint): boolean {
  return previous !== null && impliedSpeedKmh(previous, next) > IMPOSSIBLE_SPEED_KMH;
}
