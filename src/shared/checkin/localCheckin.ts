// A station check-in kept on the phone (UX2; the cloud check-in is G1). Pure: time is passed in.
// Only the expiry time is stored, so the countdown is right after a restart and a check-in left
// alone for a long time is simply expired.

import { CHECKIN_LIFETIME_S } from '../config';

const MS_PER_S = 1000;
const S_PER_MIN = 60;
const PAD = 2;

export type LocalCheckIn = {
  routeCode: string;
  stationCode: string;
  // Milliseconds since 1970
  createdAtMs: number;
  expiresAtMs: number;
};

export function startCheckIn(routeCode: string, stationCode: string, nowMs: number): LocalCheckIn {
  return { routeCode, stationCode, createdAtMs: nowMs, expiresAtMs: nowMs + CHECKIN_LIFETIME_S * MS_PER_S };
}

export function remainingMs(checkIn: LocalCheckIn, nowMs: number): number {
  return Math.max(0, checkIn.expiresAtMs - nowMs);
}

// Active until the expiry time; afterwards the check-in counts as gone, whether or not it was cleared
export function isActive(checkIn: LocalCheckIn | null, nowMs: number): checkIn is LocalCheckIn {
  return checkIn !== null && remainingMs(checkIn, nowMs) > 0;
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
  return { routeCode, stationCode, createdAtMs, expiresAtMs };
}
