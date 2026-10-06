import { TRUST_BADGE_POINTS, TRUST_DAILY_MAX } from '../config';
import { isTrusted, trustPoints } from '../profile/trust';

// 02:00 UTC is 10:00 in Manila
const DAY1 = Date.UTC(2026, 9, 6, 2, 0, 0);
const HOUR = 3600000;
const DAY = 24 * HOUR;

describe('trust points (B6, B7)', () => {
  it('counts each check-in or relay, at most TRUST_DAILY_MAX a Manila day', () => {
    const day1 = Array.from({ length: TRUST_DAILY_MAX + 2 }, (_, n) => DAY1 + n * HOUR);
    expect(trustPoints(day1)).toBe(TRUST_DAILY_MAX);
    expect(trustPoints([...day1, DAY1 + DAY])).toBe(TRUST_DAILY_MAX + 1);
    expect(trustPoints([])).toBe(0);
  });

  it('uses the Manila day: 23:30 and 00:30 Manila are two days', () => {
    const lateManila = Date.UTC(2026, 9, 6, 15, 30, 0);
    const events = [...Array.from({ length: TRUST_DAILY_MAX }, () => lateManila), lateManila + HOUR];
    expect(trustPoints(events)).toBe(TRUST_DAILY_MAX + 1);
  });

  it('is Trusted from TRUST_BADGE_POINTS, never when unknown', () => {
    expect(isTrusted(TRUST_BADGE_POINTS)).toBe(true);
    expect(isTrusted(TRUST_BADGE_POINTS - 1)).toBe(false);
    expect(isTrusted(null)).toBe(false);
  });
});
