// BT1 (PRD 8.3): the baton rule, the same as relay_heartbeat on the server.

import { batonEligible, batonOrder, batonRoles, type BatonRider } from '../relay/baton';
import { PRIMARY_MIN_BATTERY_PCT, RELAY_LIVENESS_S } from '../config';

const T0 = 1_790_000_000_000;
const S = 1000;
const rider = (userId: string, over: Partial<BatonRider> = {}): BatonRider => ({
  userId, leftM: 1000, eligible: true, movedBack: false, joinedMs: T0, lastSeenMs: T0, role: 'secondary', ...over,
});
const primaryOf = (riders: BatonRider[]) => riders.find((r) => r.role === 'primary')?.userId ?? null;

describe('BT1 baton', () => {
  it('the rider with more distance left leads', () => {
    expect(primaryOf(batonRoles([rider('a', { leftM: 800 }), rider('b', { leftM: 2500 })], T0))).toBe('b');
  });

  it('eligible riders lead before ineligible ones, and a destination change goes to the back', () => {
    expect(batonOrder([rider('a', { leftM: 5000, eligible: false }), rider('b', { leftM: 100 })])[0].userId).toBe('b');
    expect(batonOrder([rider('a', { leftM: 5000, movedBack: true }), rider('b', { leftM: 100 })])[0].userId).toBe('b');
    expect(batonOrder([rider('a', { joinedMs: T0 + S }), rider('b')])[0].userId).toBe('b');
  });

  it('a live Primary keeps the baton even if another would rank higher', () => {
    const riders = [rider('a', { role: 'primary', leftM: 100 }), rider('b', { leftM: 9000 })];
    expect(primaryOf(batonRoles(riders, T0 + 30 * S))).toBe('a');
  });

  it('a Primary silent for the liveness time is replaced by the next live rider', () => {
    const riders = [rider('a', { role: 'primary', lastSeenMs: T0 }), rider('b', { lastSeenMs: T0 + RELAY_LIVENESS_S * S })];
    expect(primaryOf(batonRoles(riders, T0 + RELAY_LIVENESS_S * S))).toBe('b');
  });

  it('nobody live: nobody leads', () => {
    expect(primaryOf(batonRoles([rider('a', { lastSeenMs: T0 })], T0 + RELAY_LIVENESS_S * S))).toBeNull();
  });

  it('eligibility: battery, battery saver, location', () => {
    expect(batonEligible(PRIMARY_MIN_BATTERY_PCT, false, true)).toBe(true);
    expect(batonEligible(PRIMARY_MIN_BATTERY_PCT - 1, false, true)).toBe(false);
    expect(batonEligible(null, false, true)).toBe(true);
    expect(batonEligible(80, true, true)).toBe(false);
    expect(batonEligible(80, false, false)).toBe(false);
  });
});
