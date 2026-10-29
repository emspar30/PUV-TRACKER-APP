// F5: badges (PRD 19, D8), earned from the user's own counts on this phone. Counts only: no
// leaderboard, no ranking and no badge that compares users. Pure.

import { BADGE_HELPING_HAND_REPORTS, BADGE_ROAD_REGULAR_REPORTS, BADGE_STOP_REGULAR_CHECKINS } from '../config';

export type BadgeCounts = {
  tripsPlanned: number;
  checkIns: number;
  reports: number;
  gpsReports: number;
};

export const NO_COUNTS: BadgeCounts = { tripsPlanned: 0, checkIns: 0, reports: 0, gpsReports: 0 };

export type BadgeId =
  | 'first_trip'
  | 'first_checkin'
  | 'stop_regular'
  | 'first_report'
  | 'helping_hand'
  | 'road_regular'
  | 'first_live_report';

type BadgeRule = { id: BadgeId; count: keyof BadgeCounts; need: number };

// The fixed order the badges are shown in
export const BADGES: readonly BadgeRule[] = [
  { id: 'first_trip', count: 'tripsPlanned', need: 1 },
  { id: 'first_checkin', count: 'checkIns', need: 1 },
  { id: 'stop_regular', count: 'checkIns', need: BADGE_STOP_REGULAR_CHECKINS },
  { id: 'first_report', count: 'reports', need: 1 },
  { id: 'helping_hand', count: 'reports', need: BADGE_HELPING_HAND_REPORTS },
  { id: 'road_regular', count: 'reports', need: BADGE_ROAD_REGULAR_REPORTS },
  { id: 'first_live_report', count: 'gpsReports', need: 1 },
];

export type BadgeState = { id: BadgeId; earned: boolean; have: number; need: number };

// Every badge in order, with how far the user is towards it
export function badgeStates(counts: BadgeCounts): BadgeState[] {
  return BADGES.map(({ id, count, need }) => {
    const have = Math.max(0, Math.floor(counts[count]));
    return { id, earned: have >= need, have: Math.min(have, need), need };
  });
}

export function earnedBadges(counts: BadgeCounts): BadgeId[] {
  return badgeStates(counts)
    .filter((badge) => badge.earned)
    .map((badge) => badge.id);
}

// BG1 (Emjay, option a, 2026-10-27): every badge earned makes a "Tunton regular", a mark on the
// Profile next to the Trusted commuter line. It says the person uses the app a lot; Trusted keeps
// its own rule (reports nobody flagged), so the two never stand for each other.
export function isRegular(counts: BadgeCounts): boolean {
  return badgeStates(counts).every((badge) => badge.earned);
}

// True only for the change that earns the mark, so its notice shows once
export function becameRegular(before: BadgeCounts, after: BadgeCounts): boolean {
  return !isRegular(before) && isRegular(after);
}

// The badges earned by going from `before` to `after`, in order (for the "Badge earned" notice)
export function newlyEarned(before: BadgeCounts, after: BadgeCounts): BadgeId[] {
  const had = new Set(earnedBadges(before));
  return earnedBadges(after).filter((id) => !had.has(id));
}
