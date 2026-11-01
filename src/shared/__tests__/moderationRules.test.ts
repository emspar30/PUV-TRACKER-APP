// MOD1: the moderation rules (shared/moderation/rules.ts), the same as the server's.

import { MERIT_MAX, MERIT_POINTS_PER, SUSPENSION_DAYS, TRUST_BADGE_POINTS, TRUST_LEVEL_MIN_REPORTS } from '../config';
import { flagWeighted, mayAppeal, mayFlag, meritLeft, suspendedUntil, trustLevel, type Strike } from '../moderation/rules';

const T0 = Date.UTC(2026, 10, 2);
const DAY = 86_400_000;
const strike = (over: Partial<Strike> = {}): Strike => ({
  id: '1',
  reason: 'confirmed_report',
  createdMs: T0,
  expiresMs: T0 + 60 * DAY,
  absorbed: false,
  lifted: false,
  appealState: 'none',
  ...over,
});

describe('MOD1 rules', () => {
  it('Trust Level shows only after enough reports', () => {
    expect(trustLevel(TRUST_LEVEL_MIN_REPORTS - 1, 9)).toBeNull();
    expect(trustLevel(TRUST_LEVEL_MIN_REPORTS, 9)).toBe(90);
  });

  it('Merit: one point per MERIT_POINTS_PER trust points, at most MERIT_MAX, minus those used', () => {
    expect(meritLeft(MERIT_POINTS_PER - 1, 0)).toBe(0);
    expect(meritLeft(MERIT_POINTS_PER * 10, 0)).toBe(MERIT_MAX);
    expect(meritLeft(MERIT_POINTS_PER * 2, 1)).toBe(1);
  });

  it('two counting strikes within 30 days suspend for 7 days from the last; absorbed, lifted or old ones do not', () => {
    expect(suspendedUntil([strike()], T0)).toBeNull();
    expect(suspendedUntil([strike(), strike({ id: '2', createdMs: T0 + DAY })], T0 + DAY)).toBe(T0 + DAY + SUSPENSION_DAYS * DAY);
    expect(suspendedUntil([strike(), strike({ id: '2', absorbed: true })], T0)).toBeNull();
    expect(suspendedUntil([strike(), strike({ id: '2', lifted: true })], T0)).toBeNull();
    expect(suspendedUntil([strike(), strike({ id: '2', createdMs: T0 - 31 * DAY })], T0)).toBeNull();
    expect(suspendedUntil([strike(), strike({ id: '2' })], T0 + SUSPENSION_DAYS * DAY)).toBeNull();
  });

  it('flagging needs an old enough account or the Trusted badge; weight needs 48 h and no fixation on one author', () => {
    expect(mayFlag(T0, 0, T0 + 6 * DAY)).toBe(false);
    expect(mayFlag(T0, 0, T0 + 7 * DAY)).toBe(true);
    expect(mayFlag(T0, TRUST_BADGE_POINTS, T0)).toBe(true);
    expect(flagWeighted(T0, T0 + DAY, [], 'a')).toBe(false);
    expect(flagWeighted(T0, T0 + 3 * DAY, ['a', 'a', 'b'], 'a')).toBe(true);
    expect(flagWeighted(T0, T0 + 3 * DAY, ['a', 'a', 'a', 'b'], 'a')).toBe(false);
  });

  it('a strike may be appealed once, within 30 days', () => {
    expect(mayAppeal(strike(), T0 + 30 * DAY)).toBe(true);
    expect(mayAppeal(strike(), T0 + 31 * DAY)).toBe(false);
    expect(mayAppeal(strike({ appealState: 'pending' }), T0)).toBe(false);
  });
});
