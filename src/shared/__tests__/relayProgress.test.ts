// CA1.1 relay info: how far a sharing rider is from their destination, how much of the ride is done,
// about how long is left and how long it has been shared.

import { ETA_MIN_SPEED_KMH, RELAY_PROGRESS_SNAP_M, RELAY_SESSION_CAP_H } from '../config';
import type { RelayBroadcast } from '../relay/broadcast';
import { alongRouteM, relayProgress } from '../relay/progress';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN, pointAt } from './fixtures/routeFixture';

const T0 = 1_790_000_000_000;
const MIN = 60_000;
const LINES = [FIXTURE_OUTBOUND.coordinates, FIXTURE_RETURN.coordinates];
const destination = { code: 'CCC', name: 'Six kilometres', ...pointAt(6) };
const session: RelayBroadcast = { mode: 'live', post: null, routeCode: 'T1', vehicleId: 'T1-01', seatTier: 'amber', destination, startedMs: T0, startPoint: pointAt(2), terminals: [] };
const CAP_MIN = RELAY_SESSION_CAP_H * 60;

describe('relay progress', () => {
  it('measures along the route line, in the direction of travel', () => {
    expect(alongRouteM(LINES, pointAt(2), pointAt(6))).toBeCloseTo(4000, -1);
    // Riding back west: the return line has the destination ahead
    expect(alongRouteM(LINES, pointAt(6), pointAt(2))).toBeCloseTo(4000, -1);
    // Off the line: no road distance
    expect(alongRouteM(LINES, pointAt(2, RELAY_PROGRESS_SNAP_M + 50), pointAt(6))).toBeNull();
  });

  it('half way: 2 km left by road, half done, minutes at the current speed', () => {
    const progress = relayProgress({ session, position: pointAt(4), lines: LINES, speedKmh: 20, capFromMs: T0, nowMs: T0 + 10 * MIN });
    expect(progress.byRoad).toBe(true);
    expect(progress.leftM).toBeGreaterThan(1990);
    expect(progress.leftM).toBeLessThan(2010);
    expect(progress.done).toBeCloseTo(0.5, 2);
    // 2 km at 20 km/h is 6 minutes
    expect(progress.etaMin).toBe(6);
    expect(progress.sharedMin).toBe(10);
    expect(progress.askInMin).toBe(CAP_MIN - 10);
  });

  it('no time left is shown when stopped or slow', () => {
    expect(relayProgress({ session, position: pointAt(4), lines: LINES, speedKmh: ETA_MIN_SPEED_KMH - 1, capFromMs: T0, nowMs: T0 }).etaMin).toBeNull();
    expect(relayProgress({ session, position: pointAt(4), lines: LINES, speedKmh: null, capFromMs: T0, nowMs: T0 }).etaMin).toBeNull();
  });

  it('off the route it falls back to a straight line', () => {
    const progress = relayProgress({ session, position: pointAt(4, 500), lines: LINES, speedKmh: null, capFromMs: T0, nowMs: T0 });
    expect(progress.byRoad).toBe(false);
    expect(progress.leftM).toBeGreaterThan(2000);
  });

  it('without a position only the times are known; without a start point, nothing is done yet', () => {
    expect(relayProgress({ session, position: null, lines: LINES, speedKmh: 20, capFromMs: T0, nowMs: T0 + 5 * MIN })).toEqual({
      leftM: null,
      byRoad: false,
      done: null,
      etaMin: null,
      sharedMin: 5,
      askInMin: CAP_MIN - 5,
    });
    expect(relayProgress({ session: { ...session, startPoint: null }, position: pointAt(4), lines: LINES, speedKmh: null, capFromMs: T0, nowMs: T0 }).done).toBeNull();
  });

  it('done never goes past the ends', () => {
    expect(relayProgress({ session, position: pointAt(1), lines: LINES, speedKmh: null, capFromMs: T0, nowMs: T0 }).done).toBe(0);
    expect(relayProgress({ session, position: pointAt(6), lines: LINES, speedKmh: null, capFromMs: T0, nowMs: T0 }).done).toBe(1);
    expect(relayProgress({ session, position: pointAt(4), lines: LINES, speedKmh: null, capFromMs: T0, nowMs: T0 + 200 * MIN }).askInMin).toBe(0);
    // After Keep sharing the hours start again
    expect(relayProgress({ session, position: null, lines: LINES, speedKmh: null, capFromMs: T0 + 180 * MIN, nowMs: T0 + 200 * MIN }).askInMin).toBe(CAP_MIN - 20);
  });
});
