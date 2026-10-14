import { SMS_DISPATCH_INTERVAL_MIN, SMS_DISPATCH_MIN_CHANGE, SMS_OPERATING_END_MIN, SMS_OPERATING_START_MIN } from '../config';
import { manilaDay } from '../backend/rules';
import { manilaMinuteOfDay } from './protocol';

// When the SMS worker texts a route's drivers (PRD 9.6; DR6). Per route, each worker cycle:
//   first     the first send of the Manila day, once anyone is waiting
//   cleared   everyone has gone and the last message still showed someone (sent once)
//   change    a stop's count moved by SMS_DISPATCH_MIN_CHANGE or more since the last message
//   new_stop  a stop the last message showed empty now has someone (owner, 2026-10-15: a lone
//             commuter at an empty stop reaches the driver at once, not after up to 5 minutes)
//   interval  SMS_DISPATCH_INTERVAL_MIN since the last message while anyone is waiting
// Nothing outside the operating hours (Q6: 05:00 to 21:00 Asia/Manila).

const MS_PER_MIN = 60_000;

// Waiting count per stop code
export type StopCounts = Readonly<Record<string, number>>;

export type DispatchState = {
  counts: StopCounts;
  sentAtMs: number;
};

export type DispatchReason = 'first' | 'cleared' | 'change' | 'new_stop' | 'interval';
export type DispatchDecision = { send: false } | { send: true; reason: DispatchReason };

const anyWaiting = (counts: StopCounts) => Object.values(counts).some((count) => count > 0);

export function inOperatingHours(nowMs: number): boolean {
  const minute = manilaMinuteOfDay(new Date(nowMs));
  return minute >= SMS_OPERATING_START_MIN && minute < SMS_OPERATING_END_MIN;
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
export function dispatchDecision(last: DispatchState | null, counts: StopCounts, nowMs: number): DispatchDecision {
  if (!inOperatingHours(nowMs)) return { send: false };
  const waiting = anyWaiting(counts);

  if (!last || manilaDay(last.sentAtMs) !== manilaDay(nowMs)) {
    return waiting ? { send: true, reason: 'first' } : { send: false };
  }
  if (!waiting) return anyWaiting(last.counts) ? { send: true, reason: 'cleared' } : { send: false };
  if (largestChange(last.counts, counts) >= SMS_DISPATCH_MIN_CHANGE) return { send: true, reason: 'change' };
  if (stopFilled(last.counts, counts)) return { send: true, reason: 'new_stop' };
  if (nowMs - last.sentAtMs >= SMS_DISPATCH_INTERVAL_MIN * MS_PER_MIN) return { send: true, reason: 'interval' };
  return { send: false };
}
