// SB1 business rules on fixtures: Night Mode, the Manila day, Energy caps, tracking and the feed.

import {
  affordableRoutes,
  chargeCheckIn,
  checkInCost,
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
  isValidUsername,
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

  it('earns 1.0 for a GPS report and nothing without GPS (CA1.1, was 0.5)', () => {
    expect(energyEarn([], 'gps_report', t, 'a')).toBe(1);
    expect(energyEarn([], 'no_gps_report', t, 'a')).toBe(0);
  });

  it('each kind once per Manila day, and again after Manila midnight', () => {
    const ledger = [row('gps_report', 1, t)];
    expect(energyEarn(ledger, 'gps_report', manila(5, 23), 'b')).toBe(0);
    expect(energyEarn(ledger, 'gps_report', manila(6, 0, 1), 'c')).toBe(1);
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
    const full = [row('welcome', 5, t - 9e8), row('checkin', -0.6, t - 4e8), row('passive', 1, t - 4e8), row('checkin', -0.6, t - 1)];
    expect(energyBalance(full)).toBe(4.8);
    expect(energyEarn(full, 'gps_report', t, 'x')).toBeCloseTo(0.2, 9);
    expect(energyBalance([...full, row('gps_report', 0.2, t), row('gps_report', 1, t + 9e7)])).toBe(5);
  });

  it('the same request key never books twice', () => {
    const ledger = [row('gps_report', 1, t, 'same')];
    expect(energyEarn(ledger, 'no_gps_report', t, 'same')).toBe(0);
  });

  it('tracking costs 1 when Energy is on, nothing when off, and is refused below 1', () => {
    expect(startTracking([], false, 'k')).toEqual({ ok: true, cost: 0 });
    expect(startTracking([row('gps_report', 1, t)], true, 'k')).toEqual({ ok: true, cost: 1 });
    expect(startTracking([row('passive', 0.5, t)], true, 'k')).toEqual({ ok: false, reason: 'not_enough_energy' });
  });

  // CA1.1 (Emjay, 2026-10-22): a check-in costs 0.3 for each route pinged
  it('a check-in costs 0.3 a route, nothing while Energy is off, and is refused when short', () => {
    expect(checkInCost(1)).toBe(0.3);
    expect(checkInCost(4)).toBe(1.2);
    const wallet = [row('welcome', 1, t)];
    expect(chargeCheckIn(wallet, true, 3, 'k')).toEqual({ ok: true, cost: 0.9 });
    expect(chargeCheckIn(wallet, true, 4, 'k')).toEqual({ ok: false, reason: 'not_enough_energy' });
    expect(chargeCheckIn([], false, 4, 'k')).toEqual({ ok: true, cost: 0 });
    expect(chargeCheckIn([...wallet, row('checkin', -0.9, t, 'k')], true, 3, 'k')).toEqual({ ok: true, cost: 0 });
  });

  it('the routes a balance pays for, counted in tenths', () => {
    expect(affordableRoutes(0.8, true)).toBe(2);
    expect(affordableRoutes(0.9, true)).toBe(3);
    expect(affordableRoutes(2.1, true)).toBe(7);
    expect(affordableRoutes(0.2, true)).toBe(0);
    expect(affordableRoutes(0, false)).toBe(Number.POSITIVE_INFINITY);
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

describe('username (D7)', () => {
  it('accepts 3 to 20 letters, digits or underscores, as set_username does', () => {
    expect(isValidUsername('JuanCommuter')).toBe(true);
    expect(isValidUsername('a_1')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('x'.repeat(21))).toBe(false);
    expect(isValidUsername('juan dela')).toBe(false);
    expect(isValidUsername('juan@x')).toBe(false);
  });
});
