// MOD1 (PRD 11.2, 11.3): the moderation rules the server applies (migration 20261102000002), in
// TypeScript for the tests and the profile screen. Pure: times are passed in.

import {
  APPEAL_WINDOW_DAYS,
  BAN_READS_AFTER_YEARS,
  BAN_STRIKES,
  FLAG_MIN_ACCOUNT_DAYS,
  FLAG_WEIGHT_MIN_AGE_H,
  MERIT_MAX,
  MERIT_POINTS_PER,
  SUSPENSION_DAYS,
  SUSPENSION_STRIKES,
  SUSPENSION_WINDOW_DAYS,
  TRUST_BADGE_POINTS,
  TRUST_LEVEL_MIN_REPORTS,
} from '../config';

const MS_PER_H = 3_600_000;
const MS_PER_DAY = 86_400_000;
const PERCENT = 100;
// "Mostly flags one author": this many of the flagger's last FLAG_HISTORY flags
const SAME_AUTHOR_MIN = 3;
const FLAG_HISTORY = 5;

// flagged_unverified (2026-11-23): hidden by flags and not a verified ride
export type StrikeReason = 'confirmed_report' | 'auto_evidence' | 'flagged_unverified';
export type AppealState = 'none' | 'pending' | 'upheld' | 'rejected';

export type Strike = {
  id: string;
  reason: StrikeReason;
  createdMs: number;
  expiresMs: number;
  absorbed: boolean;
  lifted: boolean;
  appealState: AppealState;
};

// The share of recent reports neither hidden by flags nor struck, once there are enough of them
export function trustLevel(reports: number, clean: number): number | null {
  return reports >= TRUST_LEVEL_MIN_REPORTS ? Math.round((PERCENT * clean) / reports) : null;
}

// Merit points left to absorb a strike
export function meritLeft(trustPoints: number, used: number): number {
  return Math.max(0, Math.min(MERIT_MAX, Math.floor(trustPoints / MERIT_POINTS_PER)) - used);
}

export const strikeCounts = (strike: Strike, nowMs: number) => !strike.absorbed && !strike.lifted && strike.expiresMs > nowMs;

// Suspended when enough strikes count within the window: until SUSPENSION_DAYS after the last one
export function suspendedUntil(strikes: readonly Strike[], nowMs: number): number | null {
  const recent = strikes.filter((strike) => strikeCounts(strike, nowMs) && strike.createdMs >= nowMs - SUSPENSION_WINDOW_DAYS * MS_PER_DAY);
  if (recent.length < SUSPENSION_STRIKES) return null;
  const last = Math.max(...recent.map((strike) => strike.createdMs));
  const until = last + SUSPENSION_DAYS * MS_PER_DAY;
  return until > nowMs ? until : null;
}

// May flag: an account old enough, or the Trusted badge
export function mayFlag(accountMs: number, trustPoints: number, nowMs: number): boolean {
  return nowMs - accountMs >= FLAG_MIN_ACCOUNT_DAYS * MS_PER_DAY || trustPoints >= TRUST_BADGE_POINTS;
}

// The flag counts toward hiding: the account is old enough, and the flagger does not mostly flag
// this author (recentAuthors: the authors of their last flags, newest first)
export function flagWeighted(accountMs: number, nowMs: number, recentAuthors: readonly string[], author: string): boolean {
  const last = recentAuthors.slice(0, FLAG_HISTORY);
  const mostlyOne = last.length >= SAME_AUTHOR_MIN && last.filter((id) => id === author).length >= SAME_AUTHOR_MIN;
  return nowMs - accountMs >= FLAG_WEIGHT_MIN_AGE_H * MS_PER_H && !mostlyOne;
}

export function mayAppeal(strike: Strike, nowMs: number): boolean {
  return strike.appealState === 'none' && !strike.lifted && nowMs - strike.createdMs <= APPEAL_WINDOW_DAYS * MS_PER_DAY;
}

// --- Automatic moderation (owner, 2026-11-23; migration 20261123000000_auto_moderation.sql) ---

const DAYS_PER_YEAR = 365;

// The strike a post gets when flags hide it: phone evidence first; else none for a verified ride (an
// admin decides), else flagged_unverified
export function autoStrike(hasRiskEvent: boolean, verifiedRide: boolean): StrikeReason | null {
  if (hasRiskEvent) return 'auto_evidence';
  return verifiedRide ? null : 'flagged_unverified';
}

// A hidden verified ride with no strike waits for the admin's decision
export function needsReview(post: { hidden: boolean; verified: boolean; struck: boolean }): boolean {
  return post.hidden && post.verified && !post.struck;
}

// A suspension this far ahead is a ban
export function isBan(untilMs: number | null, nowMs: number): boolean {
  return untilMs !== null && untilMs > nowMs + BAN_READS_AFTER_YEARS * DAYS_PER_YEAR * MS_PER_DAY;
}

// What the rules do next, as moderation_settle: a first suspension at SUSPENSION_STRIKES strikes in the
// window; after one, a ban at BAN_STRIKES strikes made since it started
export function settleOutcome(
  strikes: readonly Strike[],
  account: { suspensions: number; lastSuspendedMs: number | null; suspendedUntilMs: number | null },
  nowMs: number,
): 'none' | 'suspend' | 'ban' {
  if (account.suspendedUntilMs !== null && account.suspendedUntilMs > nowMs) return 'none';
  const since = nowMs - SUSPENSION_WINDOW_DAYS * MS_PER_DAY;
  const counted = strikes.filter((strike) => strikeCounts(strike, nowMs) && strike.createdMs >= since);
  if (account.suspensions === 0) return counted.length >= SUSPENSION_STRIKES ? 'suspend' : 'none';
  const fresh = counted.filter((strike) => account.lastSuspendedMs !== null && strike.createdMs >= account.lastSuspendedMs);
  return fresh.length >= BAN_STRIKES ? 'ban' : 'none';
}
