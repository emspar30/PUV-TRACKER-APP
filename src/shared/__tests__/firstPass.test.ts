// RR2: when a line passes the same place more than once, the trip uses the first pass near the
// destination ahead of the origin, never a later one. Synthetic fixtures only.

import { linePasses } from '../geo/line';
import { planTrip } from '../routing/plan';
import type { DirectedLine } from '../routing/types';
import { FIXTURE_FARE, KM_PER_DEG_LAT, pointAt } from './fixtures/routeFixture';

const LAT = 9.0;
const lonAt = (km: number) => pointAt(km).lon;
const NORTH_1500_M = 1.5 / KM_PER_DEG_LAT;

// East along the street to 8 km, 1.5 km north, back west to 1 km, back south to the street,
// then east again to 4 km: it passes 2 km and 3 km on the street twice
const LOOPING: DirectedLine = {
  id: 'L1-OUT',
  routeCode: 'L1',
  direction: 'outbound',
  directionMode: 'one_way',
  name: 'Loop fixture',
  color: '#123456',
  fare: FIXTURE_FARE,
  coordinates: [
    [lonAt(0), LAT],
    [lonAt(8), LAT],
    [lonAt(8), LAT + NORTH_1500_M],
    [lonAt(1), LAT + NORTH_1500_M],
    [lonAt(1), LAT],
    [lonAt(4), LAT],
  ],
};

describe('linePasses', () => {
  it('finds each separate approach, in order along the line', () => {
    const { passes, nearestM } = linePasses(LOOPING.coordinates, pointAt(2, 20), 500);
    expect(passes).toHaveLength(2);
    expect(passes[0].chainageKm).toBeCloseTo(2, 2);
    expect(passes[1].chainageKm).toBeGreaterThan(passes[0].chainageKm + 10);
    expect(nearestM).toBeCloseTo(20, 0);
  });

  it('reports none within the limit but still the nearest distance', () => {
    const { passes, nearestM } = linePasses(LOOPING.coordinates, pointAt(5, 700), 500);
    expect(passes).toEqual([]);
    expect(nearestM).toBeCloseTo(700, -1);
  });
});

describe('first-pass snapping', () => {
  it('rides to the first pass of the destination ahead of the origin, not the second', () => {
    const plan = planTrip([LOOPING], pointAt(0.2), pointAt(3, 10));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.itinerary.legs[1].alightChainageKm).toBeCloseTo(3, 2);
    expect(plan.itinerary.rideKm).toBeCloseTo(2.8, 2);
  });

  it('boards at the later pass of the origin when that gives the shorter trip', () => {
    // 1.5 km is passed at 1.5 km and again on the way back east (after the loop); 3.5 km only on
    // the first pass at 3.5 km and on the last stretch: board on the last stretch for a 2 km ride
    const plan = planTrip([LOOPING], pointAt(1.5), pointAt(3.5));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.itinerary.rideKm).toBeCloseTo(2, 2);
  });

  it('still refuses a destination that is behind the origin on every pass', () => {
    const line: DirectedLine = { ...LOOPING, coordinates: [LOOPING.coordinates[0], LOOPING.coordinates[1]] };
    const plan = planTrip([line], pointAt(6), pointAt(2));
    expect(plan).toMatchObject({ ok: false, reason: 'destination_not_ahead' });
  });
});
