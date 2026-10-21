// The commuter-side business rules of the SB1 database, as pure functions (Energy caps, feed expiry,
// flags, the Night Mode window). The server enforces them in supabase/migrations; these copies let
// the app show the same answers and are tested on fixtures, without the live project.
// Pure: no React Native or Expo imports.

import {
  ENERGY_CHECKIN_ROUTE_COST,
  ENERGY_GPS_REPORT,
  ENERGY_NO_GPS_REPORT,
  ENERGY_PASSIVE_AMOUNT,
  ENERGY_PASSIVE_DAILY_MAX,
  ENERGY_PASSIVE_INTERVAL_H,
  ENERGY_TRACKING_COST,
  ENERGY_WALLET_CAP,
  FEED_FLAG_HIDE_COUNT,
  FEED_LIFETIME_MIN,
  FEED_PHRASES,
  MANILA_UTC_OFFSET_MIN,
  NIGHT_MODE_END,
  NIGHT_MODE_START,
  USERNAME_BLOCKED_WORDS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_RESERVED,
} from '../config';

const MS_PER_MIN = 60000;
const MIN_PER_HOUR = 60;
const MS_PER_HOUR = MS_PER_MIN * MIN_PER_HOUR;
const MIN_PER_DAY = 1440;
const DATE_CHARS = 10;

// --- Night Mode (PRD 10.4): 21:00 to 04:59 Asia/Manila, wrapping midnight

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * MIN_PER_HOUR + m;
};

function manilaMinuteOfDay(atMs: number): number {
  const minutes = Math.floor(atMs / MS_PER_MIN) + MANILA_UTC_OFFSET_MIN;
  return ((minutes % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
}

export function isNight(atMs: number, start = NIGHT_MODE_START, end = NIGHT_MODE_END): boolean {
  const now = manilaMinuteOfDay(atMs);
  const from = minutesOf(start);
  const to = minutesOf(end);
  // The end minute is included: 04:59 is still night
  return from <= to ? now >= from && now <= to : now >= from || now <= to;
}

// The Manila calendar day (YYYY-MM-DD), for the daily Energy caps
export function manilaDay(atMs: number): string {
  return new Date(atMs + MANILA_UTC_OFFSET_MIN * MS_PER_MIN).toISOString().slice(0, DATE_CHARS);
}

// --- Energy (PRD 19, D1, D14)

// CA1.1: 'checkin' is a spend now, and 'welcome' the Energy every account starts with
export type EnergyKind = 'gps_report' | 'no_gps_report' | 'checkin' | 'passive' | 'tracking' | 'welcome';
export type EarnKind = 'gps_report' | 'no_gps_report' | 'passive';
export type LedgerRow = { kind: EnergyKind; amount: number; atMs: number; requestKey: string };

const EARN: Record<EarnKind, number> = {
  gps_report: ENERGY_GPS_REPORT,
  no_gps_report: ENERGY_NO_GPS_REPORT,
  passive: ENERGY_PASSIVE_AMOUNT,
};

// Energy amounts have one decimal
const TENTHS = 10;
const round1 = (n: number) => Math.round(n * TENTHS) / TENTHS;

export function energyBalance(ledger: readonly LedgerRow[]): number {
  return Math.min(round1(ledger.reduce((sum, row) => sum + row.amount, 0)), ENERGY_WALLET_CAP);
}

// What one earning books: once per kind per Manila day (passive up to ENERGY_PASSIVE_DAILY_MAX),
// never above the wallet cap, and nothing for a request key already booked
export function energyEarn(ledger: readonly LedgerRow[], kind: EarnKind, atMs: number, requestKey: string): number {
  if (ledger.some((row) => row.requestKey === requestKey)) return 0;
  const day = manilaDay(atMs);
  const usedToday = ledger.filter((row) => row.kind === kind && manilaDay(row.atMs) === day).length;
  if (usedToday >= (kind === 'passive' ? ENERGY_PASSIVE_DAILY_MAX : 1)) return 0;
  const total = round1(ledger.reduce((sum, row) => sum + row.amount, 0));
  return Math.max(0, round1(Math.min(EARN[kind], ENERGY_WALLET_CAP - total)));
}

// The kinds that start the refill clock: a refill, and (CA1.1) the welcome Energy
export const REFILL_CLOCK_KINDS: readonly EnergyKind[] = ['passive', 'welcome'];

// A passive refill is due when ENERGY_PASSIVE_INTERVAL_H have passed since the last one (or the welcome)
export function passiveRefillDue(ledger: readonly LedgerRow[], atMs: number): boolean {
  const last = Math.max(-Infinity, ...ledger.filter((row) => REFILL_CLOCK_KINDS.includes(row.kind)).map((row) => row.atMs));
  return atMs - last >= ENERGY_PASSIVE_INTERVAL_H * MS_PER_HOUR;
}

// When the next passive refill is due: ENERGY_PASSIVE_INTERVAL_H after the last one, or now when
// there has been none. Null while the wallet is full, since a refill books nothing then.
export function nextPassiveRefillMs(lastPassiveMs: number | null, balance: number, nowMs: number, intervalH = ENERGY_PASSIVE_INTERVAL_H): number | null {
  if (balance >= ENERGY_WALLET_CAP) return null;
  return lastPassiveMs === null ? nowMs : lastPassiveMs + intervalH * MS_PER_HOUR;
}

// The time until the refill as the countdown shows it: "11h 59m", "59m", or "1m" in the last minute
export function formatRefillIn(ms: number): { hours: number; minutes: number } {
  const totalMin = Math.max(1, Math.ceil(ms / MS_PER_MIN));
  return { hours: Math.floor(totalMin / MIN_PER_HOUR), minutes: totalMin % MIN_PER_HOUR };
}

export type TrackingStart = { ok: true; cost: number } | { ok: false; reason: 'not_enough_energy' };

// A 30-minute tracking session costs ENERGY_TRACKING_COST, and nothing while Energy is off
export function startTracking(ledger: readonly LedgerRow[], energyEnabled: boolean, requestKey: string): TrackingStart {
  if (!energyEnabled) return { ok: true, cost: 0 };
  if (ledger.some((row) => row.requestKey === requestKey)) return { ok: true, cost: 0 };
  if (energyBalance(ledger) < ENERGY_TRACKING_COST) return { ok: false, reason: 'not_enough_energy' };
  return { ok: true, cost: ENERGY_TRACKING_COST };
}

// CA1.1: a check-in costs ENERGY_CHECKIN_ROUTE_COST for each route pinged (one decimal)
export function checkInCost(routeCount: number): number {
  return round1(routeCount * ENERGY_CHECKIN_ROUTE_COST);
}

// How many routes the balance pays a check-in for (every route while Energy is off). Counted in
// tenths, so 0.9 pays for 3 routes and not 2.
export function affordableRoutes(balance: number, energyEnabled: boolean): number {
  if (!energyEnabled) return Number.POSITIVE_INFINITY;
  return Math.floor(Math.round(Math.max(0, balance) * TENTHS) / Math.round(ENERGY_CHECKIN_ROUTE_COST * TENTHS));
}

// The check-in's charge, like check_in_routes on the server: nothing while Energy is off or for a
// request key already booked, else the cost when the wallet has it
export function chargeCheckIn(ledger: readonly LedgerRow[], energyEnabled: boolean, routeCount: number, requestKey: string): TrackingStart {
  if (!energyEnabled) return { ok: true, cost: 0 };
  if (ledger.some((row) => row.requestKey === requestKey)) return { ok: true, cost: 0 };
  const cost = checkInCost(routeCount);
  if (energyBalance(ledger) < cost) return { ok: false, reason: 'not_enough_energy' };
  return { ok: true, cost };
}

// --- Feed (PRD 19, D2)

export type FeedPhrase = (typeof FEED_PHRASES)[number];

export function isFeedPhrase(value: string): value is FeedPhrase {
  return (FEED_PHRASES as readonly string[]).includes(value);
}

export function feedExpiresAt(createdMs: number): number {
  return createdMs + FEED_LIFETIME_MIN * MS_PER_MIN;
}

// A post shows while it is younger than its lifetime and has fewer than FEED_FLAG_HIDE_COUNT unique flags
export function isPostVisible(post: { createdMs: number; flaggedBy: readonly string[] }, nowMs: number): boolean {
  return nowMs < feedExpiresAt(post.createdMs) && new Set(post.flaggedBy).size < FEED_FLAG_HIDE_COUNT;
}

// What is wrong with a username (D7): 'format' unless it is 3 to 20 letters, digits or underscores
// (as set_username checks on the server); 'blocked' when it is reserved or contains a blocked word
// (checked on the phone only)
export function usernameIssue(name: string): 'format' | 'blocked' | null {
  if (!new RegExp(`^[A-Za-z0-9_]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`).test(name)) return 'format';
  const lower = name.toLowerCase();
  if (USERNAME_RESERVED.includes(lower) || USERNAME_BLOCKED_WORDS.some((word) => lower.includes(word))) return 'blocked';
  return null;
}

export function isValidUsername(name: string): boolean {
  return usernameIssue(name) === null;
}

// A request key for an idempotent server call (8 to 64 characters, as energy_ledger checks)
const BASE36 = 36;
const RANDOM_CHARS = 8;
export function newRequestKey(prefix: string, nowMs: number, random: number): string {
  const tail = Math.floor(random * BASE36 ** RANDOM_CHARS).toString(BASE36).padStart(RANDOM_CHARS, '0');
  return `${prefix}-${nowMs.toString(BASE36)}-${tail}`;
}
