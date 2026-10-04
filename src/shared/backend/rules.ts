// The commuter-side business rules of the SB1 database, as pure functions (Energy caps, feed expiry,
// flags, the Night Mode window). The server enforces them in supabase/migrations; these copies let
// the app show the same answers and are tested on fixtures, without the live project.
// Pure: no React Native or Expo imports.

import {
  ENERGY_CHECKIN,
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

export type EnergyKind = 'gps_report' | 'no_gps_report' | 'checkin' | 'passive' | 'tracking';
export type LedgerRow = { kind: EnergyKind; amount: number; atMs: number; requestKey: string };

const EARN: Record<Exclude<EnergyKind, 'tracking'>, number> = {
  gps_report: ENERGY_GPS_REPORT,
  no_gps_report: ENERGY_NO_GPS_REPORT,
  checkin: ENERGY_CHECKIN,
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
export function energyEarn(ledger: readonly LedgerRow[], kind: Exclude<EnergyKind, 'tracking'>, atMs: number, requestKey: string): number {
  if (ledger.some((row) => row.requestKey === requestKey)) return 0;
  const day = manilaDay(atMs);
  const usedToday = ledger.filter((row) => row.kind === kind && manilaDay(row.atMs) === day).length;
  if (usedToday >= (kind === 'passive' ? ENERGY_PASSIVE_DAILY_MAX : 1)) return 0;
  const total = round1(ledger.reduce((sum, row) => sum + row.amount, 0));
  return Math.max(0, round1(Math.min(EARN[kind], ENERGY_WALLET_CAP - total)));
}

// A passive refill is due when ENERGY_PASSIVE_INTERVAL_H have passed since the last one
export function passiveRefillDue(ledger: readonly LedgerRow[], atMs: number): boolean {
  const last = Math.max(-Infinity, ...ledger.filter((row) => row.kind === 'passive').map((row) => row.atMs));
  return atMs - last >= ENERGY_PASSIVE_INTERVAL_H * MS_PER_HOUR;
}

export type TrackingStart = { ok: true; cost: number } | { ok: false; reason: 'not_enough_energy' };

// A 30-minute tracking session costs ENERGY_TRACKING_COST, and nothing while Energy is off
export function startTracking(ledger: readonly LedgerRow[], energyEnabled: boolean, requestKey: string): TrackingStart {
  if (!energyEnabled) return { ok: true, cost: 0 };
  if (ledger.some((row) => row.requestKey === requestKey)) return { ok: true, cost: 0 };
  if (energyBalance(ledger) < ENERGY_TRACKING_COST) return { ok: false, reason: 'not_enough_energy' };
  return { ok: true, cost: ENERGY_TRACKING_COST };
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
