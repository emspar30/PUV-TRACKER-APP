// F5: badges from counts (PRD 19, D8). Each threshold at n - 1 and n; a fixed order; no ranking.

import { BADGE_HELPING_HAND_REPORTS, BADGE_ROAD_REGULAR_REPORTS, BADGE_STOP_REGULAR_CHECKINS } from '../config';
import { BADGES, badgeStates, earnedBadges, newlyEarned, NO_COUNTS, type BadgeCounts, type BadgeId } from '../profile/badges';

const counts = (partial: Partial<BadgeCounts>): BadgeCounts => ({ ...NO_COUNTS, ...partial });

describe('badges (F5)', () => {
  it('none are earned with no counts', () => {
    expect(earnedBadges(NO_COUNTS)).toEqual([]);
  });

  const cases: [BadgeId, keyof BadgeCounts, number][] = [
    ['first_trip', 'tripsPlanned', 1],
    ['first_checkin', 'checkIns', 1],
    ['stop_regular', 'checkIns', BADGE_STOP_REGULAR_CHECKINS],
    ['first_report', 'reports', 1],
    ['helping_hand', 'reports', BADGE_HELPING_HAND_REPORTS],
    ['road_regular', 'reports', BADGE_ROAD_REGULAR_REPORTS],
    ['first_live_report', 'gpsReports', 1],
  ];

  it.each(cases)('%s: not at n - 1, earned at n', (id, count, need) => {
    expect(earnedBadges(counts({ [count]: need - 1 }))).not.toContain(id);
    expect(earnedBadges(counts({ [count]: need }))).toContain(id);
  });

  it('come out in a fixed order', () => {
    expect(BADGES.map((badge) => badge.id)).toEqual(cases.map(([id]) => id));
    const all = counts({ tripsPlanned: 9, checkIns: 99, reports: 99, gpsReports: 9 });
    expect(earnedBadges(all)).toEqual(cases.map(([id]) => id));
  });

  it('show progress capped at the target', () => {
    const state = badgeStates(counts({ checkIns: 3 })).find((badge) => badge.id === 'stop_regular');
    expect(state).toEqual({ id: 'stop_regular', earned: false, have: 3, need: BADGE_STOP_REGULAR_CHECKINS });
    const done = badgeStates(counts({ checkIns: 40 })).find((badge) => badge.id === 'stop_regular');
    expect(done).toMatchObject({ earned: true, have: BADGE_STOP_REGULAR_CHECKINS });
  });

  it('tell which badges a new count earned, once', () => {
    expect(newlyEarned(NO_COUNTS, counts({ reports: 1, gpsReports: 1 }))).toEqual(['first_report', 'first_live_report']);
    expect(newlyEarned(counts({ reports: 1 }), counts({ reports: 2 }))).toEqual([]);
  });
});
