// SB1 business rules on fixtures: Night Mode, the Manila day, Energy caps, tracking and the feed.

import {
  energyBalance,
  energyEarn,
  feedExpiresAt,
  isFeedPhrase,
  isNight,
  isPostVisible,
  manilaDay,
  passiveRefillDue,
  startTracking,
  type LedgerRow,
} from '../backend/rules';

// Manila is UTC+8: 2026-10-05 21:00 Manila is 13:00 UTC
const manila = (day: number, h: number, m = 0) => Date.UTC(2026, 9, day, h - 8, m);
const row = (kind: LedgerRow['kind'], amount: number, atMs: number, requestKey = `k-${kind}-${atMs}`): LedgerRow => ({ kind, amount, atMs, requestKey });

describe('Night Mode window, 21:00 to 04:59 Manila', () => {
  it('covers the edges and wraps midnight', () => {
    expect(isNight(manila(5, 20, 59))).toBe(false);
    expect(isNight(manila(5, 21, 0))).toBe(true);
    expect(isNight(manila(6, 0, 30))).toBe(true);
    expect(isNight(manila(6, 4, 59))).toBe(true);
    expect(isNight(manila(6, 5, 0))).toBe(false);
    expect(isNight(manila(6, 12, 0))).toBe(false);
  });

  it('the Manila day changes at Manila midnight, not UTC midnight', () => {
    expect(manilaDay(manila(5, 23, 59))).toBe('2026-10-05');
    expect(manilaDay(manila(6, 0, 0))).toBe('2026-10-06');
  });
});

describe('Energy', () => {
  const t = manila(5, 9);

  it('earns 1.0 for a GPS report, 0.5 without, 0.3 for a check-in', () => {
    expect(energyEarn([], 'gps_report', t, 'a')).toBe(1);
    expect(energyEarn([], 'no_gps_report', t, 'a')).toBe(0.5);
    expect(energyEarn([], 'checkin', t, 'a')).toBe(0.3);
  });

  it('each kind once per Manila day, and again after Manila midnight', () => {
    const ledger = [row('checkin', 0.3, t)];
    expect(energyEarn(ledger, 'checkin', manila(5, 23), 'b')).toBe(0);
    expect(energyEarn(ledger, 'checkin', manila(6, 0, 1), 'c')).toBe(0.3);
  });

  it('passive: +1 per 12 hours, at most 2 a day', () => {
    const one = [row('passive', 1, manila(5, 1))];
    expect(passiveRefillDue(one, manila(5, 12))).toBe(false);
    expect(passiveRefillDue(one, manila(5, 13))).toBe(true);
    expect(energyEarn(one, 'passive', manila(5, 13), 'p2')).toBe(1);
    const two = [...one, row('passive', 1, manila(5, 13))];
    expect(energyEarn(two, 'passive', manila(5, 23), 'p3')).toBe(0);
  });

  it('the wallet stops at 5', () => {
    const full = [row('passive', 1, t - 1), row('passive', 1, t - 2), row('gps_report', 1, t - 3), row('passive', 1, t - 4e8), row('checkin', 0.3, t - 4e8), row('no_gps_report', 0.5, t - 4e8)];
    expect(energyBalance(full)).toBe(4.8);
    expect(energyEarn(full, 'checkin', t, 'x')).toBeCloseTo(0.2, 9);
    expect(energyBalance([...full, row('checkin', 0.2, t), row('gps_report', 1, t + 9e7)])).toBe(5);
  });

  it('the same request key never books twice', () => {
    const ledger = [row('gps_report', 1, t, 'same')];
    expect(energyEarn(ledger, 'no_gps_report', t, 'same')).toBe(0);
  });

  it('tracking costs 1 when Energy is on, nothing when off, and is refused below 1', () => {
    expect(startTracking([], false, 'k')).toEqual({ ok: true, cost: 0 });
    expect(startTracking([row('gps_report', 1, t)], true, 'k')).toEqual({ ok: true, cost: 1 });
    expect(startTracking([row('checkin', 0.3, t)], true, 'k')).toEqual({ ok: false, reason: 'not_enough_energy' });
  });
});

describe('feed', () => {
  const created = manila(5, 9);

  it('allows the preset phrases only', () => {
    expect(isFeedPhrase('few_seats')).toBe(true);
    expect(isFeedPhrase('the driver was rude')).toBe(false);
  });

  it('a post lasts 60 minutes', () => {
    expect(feedExpiresAt(created) - created).toBe(60 * 60000);
    expect(isPostVisible({ createdMs: created, flaggedBy: [] }, created + 59 * 60000)).toBe(true);
    expect(isPostVisible({ createdMs: created, flaggedBy: [] }, created + 60 * 60000)).toBe(false);
  });

  it('is hidden at 3 unique flags; a repeat flag does not count', () => {
    expect(isPostVisible({ createdMs: created, flaggedBy: ['a', 'b', 'b'] }, created)).toBe(true);
    expect(isPostVisible({ createdMs: created, flaggedBy: ['a', 'b', 'c'] }, created)).toBe(false);
  });
});
