import { bearing, destination, point } from '@turf/turf';

import { R4_LINES, R4_STATIONS } from '../../data/seed/r4.placeholder';
import { FARE_DISCOUNT_MULTIPLIER, MAX_WALK_PER_LEG_M } from '../config';
import { computeFare, discountMultiplier } from '../fare/fare';
import type { LatLon } from '../geo/haversine';
import { pointAtChainage } from '../geo/line';
import { planTrip, type PlanLine } from '../routing/plan';

const LINES: PlanLine[] = R4_LINES.map((line) => ({
  routeId: line.routeId,
  routeCode: line.routeCode,
  routeName: line.routeName,
  routeColor: line.routeColor,
  coordinates: line.coordinates,
  fare: { baseFare: line.baseFare, baseKm: line.baseKm, perKmRate: line.perKmRate },
}));
const [OUTBOUND, RETURN] = LINES;
const REGULAR = discountMultiplier('regular');

const stop = (code: string): LatLon => {
  const station = R4_STATIONS.find((s) => s.code === code);
  if (!station) throw new Error(code);
  return { lat: station.lat, lon: station.lon };
};

// A point `meters` to the side of the outbound line, square to it at `chainageKm`.
// 12 km along, the line runs down the Davao-Agusan National Highway, away from other streets
// of the route, so the nearest point on the line stays the same whatever the distance.
const HIGHWAY_KM = 12;
const besideOutbound = (meters: number, chainageKm = HIGHWAY_KM): LatLon => {
  const before = pointAtChainage(OUTBOUND.coordinates, chainageKm - 0.02);
  const after = pointAtChainage(OUTBOUND.coordinates, chainageKm + 0.02);
  const at = pointAtChainage(OUTBOUND.coordinates, chainageKm);
  const heading = bearing(point([before.lon, before.lat]), point([after.lon, after.lat]));
  const [lon, lat] = destination(point([at.lon, at.lat]), meters / 1000, heading - 90).geometry.coordinates;
  return { lat, lon };
};

describe('routing direction check', () => {
  it('does not offer the return line to stops it does not pass', () => {
    // The return path leaves JAQNO at R. Calo, about 1 km from Imadejas
    expect(planTrip(stop('MCA'), stop('IMA'), [RETURN], REGULAR)).toMatchObject({
      ok: false,
      reason: 'too_far_to_walk',
    });
  });

  it('rejects a destination behind the origin on one direction', () => {
    expect(planTrip(stop('JCA'), stop('TSO'), [OUTBOUND], REGULAR)).toMatchObject({ ok: false, reason: 'not_ahead' });
  });

  it('picks the return line when the destination is behind on the outbound line', () => {
    const result = planTrip(stop('MCA'), stop('RCA'), LINES, REGULAR);
    expect(result.ok && result.itinerary.legs[1].routeId).toBe(RETURN.routeId);
  });

  it('picks the outbound line for a trip ahead on it', () => {
    const result = planTrip(stop('TSO'), stop('JCA'), LINES, REGULAR);
    expect(result.ok && result.itinerary.legs[1].routeId).toBe(OUTBOUND.routeId);
  });

  it('rejects a trip whose start and end snap to the same point', () => {
    expect(planTrip(stop('RCA'), stop('RCA'), LINES, REGULAR)).toMatchObject({ ok: false, reason: 'not_ahead' });
  });

  it('reports no routes when there are none', () => {
    expect(planTrip(stop('TSO'), stop('JCA'), [], REGULAR)).toMatchObject({ ok: false, reason: 'no_routes' });
  });
});

describe('routing walking limit', () => {
  it('rejects an origin 600 m from the line and says how far it is', () => {
    const result = planTrip(besideOutbound(600), stop('DEO'), [OUTBOUND], REGULAR);
    expect(result).toMatchObject({ ok: false, reason: 'too_far_to_walk' });
    if (!result.ok) {
      expect(result.originToRouteM).toBeCloseTo(600, -1);
      expect(result.destinationToRouteM).toBeLessThan(MAX_WALK_PER_LEG_M);
    }
  });

  it('accepts an origin 400 m from the line', () => {
    const result = planTrip(besideOutbound(400), stop('DEO'), [OUTBOUND], REGULAR);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.itinerary.legs[0].distanceM).toBeCloseTo(400, -1);
  });

  it('uses the configured limit', () => {
    expect(MAX_WALK_PER_LEG_M).toBe(500);
  });
});

describe('routing returns exactly walk, ride, walk', () => {
  it.each([
    ['TSO', 'JCA'],
    ['IMA', 'DEO'],
    ['MCA', 'RCA'],
  ])('%s to %s', (from, to) => {
    const result = planTrip(stop(from), stop(to), LINES, REGULAR);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.itinerary.legs.map((leg) => leg.kind)).toEqual(['walk', 'ride', 'walk']);
  });
});

describe('fare uses ride distance not walk distance', () => {
  it('moving the origin sideways changes the walk but not the fare', () => {
    const near = planTrip(besideOutbound(50), stop('DEO'), [OUTBOUND], REGULAR);
    const far = planTrip(besideOutbound(450), stop('DEO'), [OUTBOUND], REGULAR);
    expect(near.ok && far.ok).toBe(true);
    if (!near.ok || !far.ok) return;

    expect(far.itinerary.legs[0].distanceM).toBeGreaterThan(near.itinerary.legs[0].distanceM + 300);
    // Same boarding point to within a metre (the sideways offset is geodesic, so not exact)
    expect(far.itinerary.legs[1].distanceKm).toBeCloseTo(near.itinerary.legs[1].distanceKm, 3);
    expect(far.itinerary.fare).toEqual(near.itinerary.fare);
  });

  it('charges the formula on the ride slice', () => {
    const result = planTrip(stop('IMA'), stop('DEO'), LINES, REGULAR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ride = result.itinerary.legs[1];
    expect(result.itinerary.fare).toEqual(computeFare(ride.distanceKm, OUTBOUND.fare, REGULAR));
    expect(ride.distanceKm).toBeGreaterThan(OUTBOUND.fare.baseKm);
  });
});

describe('discount applies to Student, Senior Citizen, PWD only', () => {
  it.each([
    ['regular', 1],
    ['student', FARE_DISCOUNT_MULTIPLIER],
    ['senior', FARE_DISCOUNT_MULTIPLIER],
    ['pwd', FARE_DISCOUNT_MULTIPLIER],
  ] as const)('%s pays multiplier %p', (classification, multiplier) => {
    expect(discountMultiplier(classification)).toBe(multiplier);
  });

  it('lowers the planned fare only for a discounted classification', () => {
    const regular = planTrip(stop('IMA'), stop('DEO'), LINES, discountMultiplier('regular'));
    const student = planTrip(stop('IMA'), stop('DEO'), LINES, discountMultiplier('student'));
    expect(regular.ok && student.ok).toBe(true);
    if (regular.ok && student.ok) {
      expect(student.itinerary.fare.gross).toBe(regular.itinerary.fare.gross);
      expect(student.itinerary.fare.rounded).toBeLessThan(regular.itinerary.fare.rounded);
    }
  });
});
