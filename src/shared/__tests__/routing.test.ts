import { MAX_WALK_PER_LEG_M } from '../config';
import { discountMultiplier } from '../fare/fare';
import { haversineMeters } from '../geo/haversine';
import { sliceCoordinates } from '../geo/line';
import { fareForItinerary, planTrip } from '../routing/plan';

import { FIXTURE_OUTBOUND, FIXTURE_RETURN, pointAt } from './fixtures/routeFixture';

const BOTH = [FIXTURE_OUTBOUND, FIXTURE_RETURN];

function plan(lines: typeof BOTH, originKm: number, destinationKm: number, originNorthM = 0, destinationNorthM = 0) {
  return planTrip(lines, pointAt(originKm, originNorthM), pointAt(destinationKm, destinationNorthM));
}

describe('trip planner', () => {
  it('returns exactly walk, ride, walk', () => {
    const result = plan(BOTH, 1, 5, 100, 50);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.itinerary.legs.map((leg) => leg.kind)).toEqual(['walk', 'ride', 'walk']);
  });

  it('boards and alights anywhere along the line, at the points nearest the origin and destination', () => {
    const result = plan(BOTH, 1.3, 5.7, 120, 80);
    if (!result.ok) throw new Error(result.reason);
    const [walkIn, ride, walkOut] = result.itinerary.legs;

    expect(haversineMeters(ride.from, pointAt(1.3))).toBeLessThan(2);
    expect(haversineMeters(ride.to, pointAt(5.7))).toBeLessThan(2);
    expect(walkIn.distanceM).toBeCloseTo(120, 0);
    expect(walkOut.distanceM).toBeCloseTo(80, 0);
    expect(ride.distanceKm).toBeCloseTo(4.4, 2);
    expect(result.itinerary.walkM).toBeCloseTo(200, 0);
  });

  it('rejects a destination behind the origin when only one direction exists', () => {
    expect(plan([FIXTURE_OUTBOUND], 5, 1)).toEqual({ ok: false, reason: 'destination_not_ahead' });
  });

  it('picks the return line when the destination is behind on the outbound line', () => {
    const result = plan(BOTH, 5, 1);
    if (!result.ok) throw new Error(result.reason);
    expect(result.itinerary.legs[1].lineId).toBe(FIXTURE_RETURN.id);
    expect(result.itinerary.legs[1].direction).toBe('return');
    expect(result.itinerary.rideKm).toBeCloseTo(4, 2);
  });

  it('picks the outbound line when the destination is ahead on it', () => {
    const result = plan(BOTH, 1, 5);
    if (!result.ok) throw new Error(result.reason);
    expect(result.itinerary.legs[1].lineId).toBe(FIXTURE_OUTBOUND.id);
  });

  it('rejects an origin beyond the walking limit', () => {
    expect(plan(BOTH, 1, 5, 600)).toEqual({ ok: false, reason: 'origin_too_far' });
  });

  it('rejects a destination beyond the walking limit', () => {
    expect(plan(BOTH, 1, 5, 0, 600)).toEqual({ ok: false, reason: 'destination_too_far' });
  });

  it('accepts walks inside the limit, on either side of it', () => {
    expect(MAX_WALK_PER_LEG_M).toBe(500);
    expect(plan(BOTH, 1, 5, 400, 400).ok).toBe(true);
    expect(plan(BOTH, 1, 5, 490, -490).ok).toBe(true);
    expect(plan(BOTH, 1, 5, 510).ok).toBe(false);
  });

  it('uses the walking limit it is given', () => {
    expect(planTrip(BOTH, pointAt(1, 300), pointAt(5), { maxWalkM: 200 })).toEqual({
      ok: false,
      reason: 'origin_too_far',
    });
  });

  it('rejects the same point as origin and destination', () => {
    expect(plan(BOTH, 3, 3)).toEqual({ ok: false, reason: 'destination_not_ahead' });
  });

  it('reports no routes when there is no route data', () => {
    expect(plan([], 1, 5)).toEqual({ ok: false, reason: 'no_routes' });
  });
});

describe('fare for an itinerary', () => {
  const regular = discountMultiplier('regular');

  it('uses the ride distance, not the walked distance', () => {
    const near = plan(BOTH, 1, 7.3);
    const far = plan(BOTH, 1, 7.3, 450, 450);
    if (!near.ok || !far.ok) throw new Error('expected both plans to succeed');

    expect(far.itinerary.walkM).toBeGreaterThan(near.itinerary.walkM + 800);
    expect(far.itinerary.rideKm).toBeCloseTo(near.itinerary.rideKm, 3);
    expect(fareForItinerary(BOTH, far.itinerary, regular)).toEqual(fareForItinerary(BOTH, near.itinerary, regular));
  });

  it('follows the fare formula for the route slice', () => {
    // 6.3 km ride: 15 + ceil(6.3 - 4) x 2 = 21.00
    const result = plan(BOTH, 1, 7.3);
    if (!result.ok) throw new Error(result.reason);
    expect(result.itinerary.rideKm).toBeCloseTo(6.3, 2);
    expect(fareForItinerary(BOTH, result.itinerary, regular).rounded).toBe(21);
  });

  it('charges the base fare for a short ride', () => {
    const result = plan(BOTH, 1, 2);
    if (!result.ok) throw new Error(result.reason);
    expect(fareForItinerary(BOTH, result.itinerary, regular).rounded).toBe(15);
  });

  it('applies the discount only for Student, Senior Citizen and PWD', () => {
    const result = plan(BOTH, 1, 7.3);
    if (!result.ok) throw new Error(result.reason);
    const fare = (classification: Parameters<typeof discountMultiplier>[0]) =>
      fareForItinerary(BOTH, result.itinerary, discountMultiplier(classification));

    expect(fare('regular').rounded).toBe(21);
    for (const discounted of ['student', 'senior', 'pwd'] as const) {
      expect(fare(discounted).unrounded).toBe(16.8);
      expect(fare(discounted).rounded).toBe(16.75);
    }
  });

  it('uses the fare parameters of the line that is ridden', () => {
    const pricey = { ...FIXTURE_OUTBOUND, fare: { baseFare: 20, baseKm: 2, perKmRate: 5 } };
    const result = planTrip([pricey], pointAt(1), pointAt(4.5));
    if (!result.ok) throw new Error(result.reason);
    // 3.5 km ride: 20 + ceil(3.5 - 2) x 5 = 30
    expect(fareForItinerary([pricey], result.itinerary, regular).rounded).toBe(30);
  });
});

describe('ride slice for drawing', () => {
  it('runs from the boarding point to the alighting point', () => {
    const result = plan(BOTH, 1, 5);
    if (!result.ok) throw new Error(result.reason);
    const ride = result.itinerary.legs[1];
    const slice = sliceCoordinates(FIXTURE_OUTBOUND.coordinates, ride.boardChainageKm, ride.alightChainageKm);

    const first = slice[0];
    const last = slice[slice.length - 1];
    expect(haversineMeters({ lat: first[1], lon: first[0] }, ride.from)).toBeLessThan(2);
    expect(haversineMeters({ lat: last[1], lon: last[0] }, ride.to)).toBeLessThan(2);
  });

  it('is empty when the end is not after the start', () => {
    expect(sliceCoordinates(FIXTURE_OUTBOUND.coordinates, 3, 3)).toEqual([]);
  });
});
