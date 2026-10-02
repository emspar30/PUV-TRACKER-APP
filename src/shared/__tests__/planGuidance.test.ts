// UX1: naming picked points, explaining failed plans, moving a pin onto the route, and the fare breakdown.
// Uses the fixed fixture route, not the live seed file.

import { MAX_WALK_PER_LEG_M } from '../config';
import { computeFare, discountMultiplier } from '../fare/fare';
import { haversineMeters } from '../geo/haversine';
import { describePoint, nearestOnRoute, nearestStop, snapToRoute } from '../routing/describe';
import { planTrip } from '../routing/plan';

import { FIXTURE_FARE, FIXTURE_OUTBOUND, FIXTURE_RETURN, FIXTURE_STOPS, pointAt } from './fixtures/routeFixture';

const LINES = [FIXTURE_OUTBOUND, FIXTURE_RETURN];

describe('naming a point from the nearest stop', () => {
  it('names the nearest stop and the distance to the route', () => {
    // 2.1 km along the street and 120 m north of it: stop BBB (at 2 km) is nearest
    const description = describePoint(LINES, FIXTURE_STOPS, pointAt(2.1, 120));
    expect(description.nearestStopCode).toBe('BBB');
    expect(description.routeDistanceM).toBeCloseTo(120, 0);
    expect(description.nearestStopDistanceM).toBeCloseTo(Math.hypot(100, 120), 0);
  });

  it('reports a point on the route as 0 m from it', () => {
    const description = describePoint(LINES, FIXTURE_STOPS, pointAt(5.9));
    expect(description.nearestStopCode).toBe('CCC');
    expect(description.routeDistanceM).toBeLessThan(1);
  });

  it('picks the off-street stop when the point is beside it', () => {
    expect(describePoint(LINES, FIXTURE_STOPS, pointAt(4, 390)).nearestStopCode).toBe('FAR');
  });

  it('gives where the point would land on the route', () => {
    const { snapped } = describePoint(LINES, FIXTURE_STOPS, pointAt(3, 250));
    expect(snapped).not.toBeNull();
    expect(haversineMeters(snapped!, pointAt(3))).toBeLessThan(2);
  });

  it('copes with no stops and no lines', () => {
    expect(describePoint([], [], pointAt(1))).toEqual({
      nearestStopCode: null,
      nearestStopDistanceM: null,
      routeDistanceM: null,
      snapped: null,
    });
    expect(nearestStop([], pointAt(1))).toBeNull();
    expect(nearestOnRoute([], pointAt(1))).toBeNull();
  });
});

describe('each failure reason, with distances', () => {
  it('origin too far: states how far the origin is from the route', () => {
    const result = planTrip(LINES, pointAt(1, 650), pointAt(5, 40));
    expect(result).toMatchObject({ ok: false, reason: 'origin_too_far', maxWalkM: MAX_WALK_PER_LEG_M });
    if (result.ok) return;
    expect(result.originDistanceM).toBeCloseTo(650, 0);
    expect(result.destinationDistanceM).toBeCloseTo(40, 0);
  });

  it('destination too far: states how far the destination is from the route', () => {
    const result = planTrip(LINES, pointAt(1, 30), pointAt(5, 720));
    expect(result).toMatchObject({ ok: false, reason: 'destination_too_far' });
    if (result.ok) return;
    expect(result.originDistanceM).toBeCloseTo(30, 0);
    expect(result.destinationDistanceM).toBeCloseTo(720, 0);
  });

  it('destination behind: both points are in reach but the travel direction is wrong', () => {
    const result = planTrip([FIXTURE_OUTBOUND], pointAt(5, 20), pointAt(1, 20));
    expect(result).toMatchObject({ ok: false, reason: 'destination_not_ahead' });
    if (result.ok) return;
    expect(result.originDistanceM).toBeLessThanOrEqual(MAX_WALK_PER_LEG_M);
    expect(result.destinationDistanceM).toBeLessThanOrEqual(MAX_WALK_PER_LEG_M);
  });

  it('no route: there is no route data at all', () => {
    expect(planTrip([], pointAt(1), pointAt(5))).toEqual({
      ok: false,
      reason: 'no_routes',
      originDistanceM: null,
      destinationDistanceM: null,
      maxWalkM: MAX_WALK_PER_LEG_M,
    });
  });
});

describe('move pin to the route', () => {
  it('moves a far pin onto the route, directly opposite where it was', () => {
    const moved = snapToRoute(LINES, pointAt(1, 650));
    expect(haversineMeters(moved, pointAt(1))).toBeLessThan(2);
  });

  it('turns an "origin too far" plan into a trip', () => {
    const origin = pointAt(1, 650);
    const destination = pointAt(5);
    expect(planTrip(LINES, origin, destination).ok).toBe(false);

    const result = planTrip(LINES, snapToRoute(LINES, origin), destination);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.itinerary.legs[0].distanceM).toBeLessThan(1);
    expect(result.itinerary.rideKm).toBeCloseTo(4, 2);
  });

  it('leaves a pin that is already on the route where it is', () => {
    const onRoute = pointAt(3);
    expect(haversineMeters(snapToRoute(LINES, onRoute), onRoute)).toBeLessThan(1);
  });

  it('returns the point unchanged when there is no route', () => {
    const point = pointAt(3, 200);
    expect(snapToRoute([], point)).toEqual(point);
  });

  it('"use the nearest stop" finds the closest stop and its distance', () => {
    const nearest = nearestStop(FIXTURE_STOPS, pointAt(5.5, 100));
    expect(nearest?.stop.code).toBe('CCC');
    expect(nearest?.distanceM).toBeCloseTo(Math.hypot(500, 100), 0);
  });
});

describe('fare breakdown arithmetic', () => {
  it('6.3 km regular: base 15.00 for 4 km, 3 extra km at 2.00, total 21.00', () => {
    const fare = computeFare(6.3, FIXTURE_FARE, discountMultiplier('regular'));
    expect(fare.breakdown).toEqual({
      baseFare: 15,
      baseKm: 4,
      extraKm: 3,
      perKmRate: 2,
      extraCost: 6,
      multiplier: 1,
      discount: 0,
      roundingStep: 0.25,
      roundingAdjustment: 0,
    });
    expect(fare.gross).toBe(21);
    expect(fare.rounded).toBe(21);
  });

  it('6.3 km student: 21.00 less 4.20 is 16.80, rounded to 16.75', () => {
    const fare = computeFare(6.3, FIXTURE_FARE, discountMultiplier('student'));
    expect(fare.gross).toBe(21);
    expect(fare.breakdown.discount).toBe(4.2);
    expect(fare.unrounded).toBe(16.8);
    expect(fare.breakdown.roundingAdjustment).toBe(-0.05);
    expect(fare.rounded).toBe(16.75);
  });

  it('the parts always add up to the total', () => {
    for (const km of [0.4, 3.99, 4, 4.01, 6.3, 9.75, 12.2]) {
      for (const classification of ['regular', 'student', 'senior', 'pwd'] as const) {
        const fare = computeFare(km, FIXTURE_FARE, discountMultiplier(classification));
        const { baseFare, extraCost, discount, roundingAdjustment, extraKm, perKmRate } = fare.breakdown;
        expect(extraCost).toBeCloseTo(extraKm * perKmRate, 9);
        expect(baseFare + extraCost).toBeCloseTo(fare.gross, 9);
        expect(fare.gross - discount).toBeCloseTo(fare.unrounded, 9);
        expect(fare.unrounded + roundingAdjustment).toBeCloseTo(fare.rounded, 9);
      }
    }
  });

  it('a ride inside the base distance has no extra kilometres', () => {
    const fare = computeFare(2.5, FIXTURE_FARE, 1);
    expect(fare.breakdown.extraKm).toBe(0);
    expect(fare.breakdown.extraCost).toBe(0);
    expect(fare.rounded).toBe(15);
  });

  it('reports no rounding step when rounding is off', () => {
    const fare = computeFare(6.3, FIXTURE_FARE, 0.8, null);
    expect(fare.breakdown.roundingStep).toBeNull();
    expect(fare.breakdown.roundingAdjustment).toBe(0);
    expect(fare.rounded).toBe(16.8);
  });
});
