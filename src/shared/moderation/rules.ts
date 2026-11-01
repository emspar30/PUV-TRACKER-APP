// MOD1 (PRD 11.2, 11.3): the moderation rules the server applies (migration 20261102000002), in
// TypeScript for the tests and the profile screen. Pure: times are passed in.

import {
  APPEAL_WINDOW_DAYS,
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

export type StrikeReason = 'confirmed_report' | 'auto_evidence';
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
