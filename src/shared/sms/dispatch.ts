import {
  MANILA_UTC_OFFSET_MIN,
  SMS_DISPATCH_INTERVAL_MIN,
  SMS_DISPATCH_MIN_CHANGE,
  SMS_DISPATCH_MIN_GAP_S,
  SMS_GATEWAY_CAP_NEAR_SHARE,
  SMS_GATEWAY_DAILY_CAP,
  SMS_OPERATING_END_MIN,
  SMS_OPERATING_START_MIN,
} from '../config';
import { manilaDay } from '../backend/rules';
import { manilaMinuteOfDay } from './protocol';

// When the SMS worker texts a route's drivers (PRD 9.6; DR6). Per route, each worker cycle:
//   first     the first send of the Manila day, once anyone is waiting
//   cleared   everyone has gone and the last message still showed someone (sent once)
//   change    a stop's count moved by SMS_DISPATCH_MIN_CHANGE or more since the last message
//   new_stop  a stop the last message showed empty now has someone (owner, 2026-10-15: a lone
//             commuter at an empty stop reaches the driver at once, not after up to 5 minutes)
//   interval  SMS_DISPATCH_INTERVAL_MIN since the last message while anyone is waiting
// Nothing outside the operating hours: all day since 2026-10-18 (owner; Q6 was 05:00 to 21:00 Asia/Manila).
// The window stays, so the pilot can narrow it again in shared/config.
// CA2c: cleared, change and new_stop wait for SMS_DISPATCH_MIN_GAP_S after the last message; what
// changed meanwhile is compared with the last message, so it goes in the next one. `level` is the
// gateways' daily cap (capLevel): near it only the interval and the day's first message go; at it
// nothing does.

const MS_PER_MIN = 60_000;
const MS_PER_S = 1000;
const MIN_PER_DAY = 1440;

// Waiting count per stop code
export type StopCounts = Readonly<Record<string, number>>;

export type DispatchState = {
  counts: StopCounts;
  sentAtMs: number;
};

export type DispatchReason = 'first' | 'cleared' | 'change' | 'new_stop' | 'interval';
export type DispatchDecision = { send: false } | { send: true; reason: DispatchReason };

const anyWaiting = (counts: StopCounts) => Object.values(counts).some((count) => count > 0);

export function inOperatingHours(nowMs: number, startMin = SMS_OPERATING_START_MIN, endMin = SMS_OPERATING_END_MIN): boolean {
  const minute = manilaMinuteOfDay(new Date(nowMs));
  return minute >= startMin && minute < endMin;
}

function largestChange(previous: StopCounts, current: StopCounts): number {
  const codes = new Set([...Object.keys(previous), ...Object.keys(current)]);
  let largest = 0;
  for (const code of codes) largest = Math.max(largest, Math.abs((current[code] ?? 0) - (previous[code] ?? 0)));
  return largest;
}

// A stop with nobody in the last message that has someone now (a stop missing from the counts had nobody)
function stopFilled(previous: StopCounts, current: StopCounts): boolean {
  return Object.entries(current).some(([code, count]) => count > 0 && (previous[code] ?? 0) === 0);
}

// last: what the drivers were last sent (null when nothing has been sent)
export function dispatchDecision(last: DispatchState | null, counts: StopCounts, nowMs: number, level: CapLevel = 'ok'): DispatchDecision {
  if (!inOperatingHours(nowMs) || level === 'full') return { send: false };
  const waiting = anyWaiting(counts);

  if (!last || manilaDay(last.sentAtMs) !== manilaDay(nowMs)) {
    return waiting ? { send: true, reason: 'first' } : { send: false };
  }
  const intervalDue = waiting && nowMs - last.sentAtMs >= SMS_DISPATCH_INTERVAL_MIN * MS_PER_MIN;
  if (level === 'near') return intervalDue ? { send: true, reason: 'interval' } : { send: false };
  if (nowMs - last.sentAtMs < SMS_DISPATCH_MIN_GAP_S * MS_PER_S) return { send: false };
  if (!waiting) return anyWaiting(last.counts) ? { send: true, reason: 'cleared' } : { send: false };
  if (largestChange(last.counts, counts) >= SMS_DISPATCH_MIN_CHANGE) return { send: true, reason: 'change' };
  if (stopFilled(last.counts, counts)) return { send: true, reason: 'new_stop' };
  if (intervalDue) return { send: true, reason: 'interval' };
  return { send: false };
}

// CA2c: how close today's messages are to the gateways' daily cap (each active gateway SIM sends
// up to SMS_GATEWAY_DAILY_CAP; at least one is assumed)
export type CapLevel = 'ok' | 'near' | 'full';

export function capLevel(usedToday: number, gateways: number, cap = SMS_GATEWAY_DAILY_CAP): CapLevel {
  const limit = cap * Math.max(1, gateways);
  if (usedToday >= limit) return 'full';
  return usedToday >= limit * SMS_GATEWAY_CAP_NEAR_SHARE ? 'near' : 'ok';
}

// The start of the Manila day `atMs` falls in, for counting today's messages
export function manilaDayStartMs(atMs: number): number {
  const dayMs = MIN_PER_DAY * MS_PER_MIN;
  const offsetMs = MANILA_UTC_OFFSET_MIN * MS_PER_MIN;
  return Math.floor((atMs + offsetMs) / dayMs) * dayMs - offsetMs;
}
