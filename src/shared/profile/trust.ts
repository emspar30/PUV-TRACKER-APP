// B6/B7: trust points and the Trusted badge, as the server keeps them (migration 20261009000001):
// a point per check-in and per relay, at most TRUST_DAILY_MAX a Manila day; Trusted at
// TRUST_BADGE_POINTS. The demo counts the phone's own check-ins and relays the same way.

import { manilaDay } from '../backend/rules';
import { TRUST_BADGE_POINTS, TRUST_DAILY_MAX } from '../config';

// Points earned by check-ins and relays at these times, with the daily cap
export function trustPoints(eventsMs: readonly number[]): number {
  const perDay = new Map<string, number>();
  for (const atMs of eventsMs) {
    const day = manilaDay(atMs);
    perDay.set(day, Math.min((perDay.get(day) ?? 0) + 1, TRUST_DAILY_MAX));
  }
  return [...perDay.values()].reduce((sum, points) => sum + points, 0);
}

// Unknown points (signed out on live data) are not Trusted
export function isTrusted(points: number | null): boolean {
  return points !== null && points >= TRUST_BADGE_POINTS;
}
