// A station check-in as the phone keeps it (UX2), with the expiry from the cloud (C1). Pure: time is passed in.
// Only the expiry time is stored, so the countdown is right after a restart and a check-in left
// alone for a long time is simply expired.

import { CHECKIN_LIFETIME_S } from '../config';
import type { LatLon } from '../geo/haversine';

const MS_PER_S = 1000;
const S_PER_MIN = 60;
const PAD = 2;

const MS_PER_MIN = 60000;

export type LocalCheckIn = {
  // The first of routeCodes, the route the sheet and My Rides show
  routeCode: string;
  // Every route pinged at a shared stop (one or more)
  routeCodes: readonly string[];
  stationCode: string;
  // Milliseconds since 1970
  createdAtMs: number;
  expiresAtMs: number;
  // CA2b: where the commuter stood when checking in, so "Did you board?" looks for a multicab there,
  // and (CA3) a near check-in ends when the commuter walks away from it. Kept on the phone only,
  // never sent. Absent in records from before CA2 and when there was no position; the stop is used then.
  point?: LatLon;
  // CA3: checked in near the route rather than at the stop (counted as "near" the stop)
  near?: boolean;
};

// `expiresAtMs` is the server's expiry when the check-in is in the cloud (C1)
export function startCheckIn(
  routes: string | readonly string[],
  stationCode: string,
  nowMs: number,
  expiresAtMs = nowMs + CHECKIN_LIFETIME_S * MS_PER_S,
  point?: LatLon,
  near = false,
): LocalCheckIn {
  const routeCodes = typeof routes === 'string' ? [routes] : [...routes];
  const at = point ? { point: { lat: point.lat, lon: point.lon } } : {};
  return { routeCode: routeCodes[0] ?? '', routeCodes, stationCode, createdAtMs: nowMs, expiresAtMs, ...at, ...(near ? { near: true } : {}) };
}

export function remainingMs(checkIn: LocalCheckIn, nowMs: number): number {
  return Math.max(0, checkIn.expiresAtMs - nowMs);
}

// Active until the expiry time; afterwards the check-in counts as gone, whether or not it was cleared
export function isActive(checkIn: LocalCheckIn | null, nowMs: number): checkIn is LocalCheckIn {
  return checkIn !== null && remainingMs(checkIn, nowMs) > 0;
}

// DR8, PRD 7.5 auto-cancel: a verified boarding on one of the check-in's routes ends the check-in
export function boardingEndsCheckIn(checkIn: LocalCheckIn | null, boardedRoute: string, nowMs: number): boolean {
  return isActive(checkIn, nowMs) && checkIn.routeCodes.includes(boardedRoute);
}

// "14:59". Whole seconds are rounded up, so the display reads 00:00 only at the very end.
export function formatCountdown(ms: number): string {
  const totalS = Math.ceil(Math.max(0, ms) / MS_PER_S);
  const minutes = Math.floor(totalS / S_PER_MIN);
  const seconds = totalS % S_PER_MIN;
  return `${String(minutes).padStart(PAD, '0')}:${String(seconds).padStart(PAD, '0')}`;
}

// A stored value is used only if it is a well-formed check-in
export function parseStoredCheckIn(value: unknown): LocalCheckIn | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const { routeCode, stationCode, createdAtMs, expiresAtMs } = record;
  if (typeof routeCode !== 'string' || typeof stationCode !== 'string') return null;
  if (typeof createdAtMs !== 'number' || typeof expiresAtMs !== 'number') return null;
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs < createdAtMs) return null;
  // Stored before shared stops: one route
  const stored = Array.isArray(record.routeCodes) ? record.routeCodes.filter((code): code is string => typeof code === 'string') : [];
  const routeCodes = stored.length > 0 ? stored : [routeCode];
  const point = record.point as Record<string, unknown> | undefined;
  const at = point && Number.isFinite(point.lat) && Number.isFinite(point.lon) ? { point: { lat: point.lat as number, lon: point.lon as number } } : {};
  return { routeCode, routeCodes, stationCode, createdAtMs, expiresAtMs, ...at, ...(record.near === true ? { near: true } : {}) };
}

// B3: when to remind the commuter of a running check-in, `minutes` after it started; null when the
// check-in ends first
export function reminderAtMs(checkIn: LocalCheckIn, minutes: number): number | null {
  const atMs = checkIn.createdAtMs + minutes * MS_PER_MIN;
  return atMs < checkIn.expiresAtMs ? atMs : null;
}
