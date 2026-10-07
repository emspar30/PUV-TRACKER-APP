// F3: route suggestions for frequent destinations (PRD 19, D4). Fixture lines, not the seed.

import { FARE_DISCOUNT_MULTIPLIER, MAX_WALK_PER_LEG_M } from '../config';
import { fareForItinerary, planOptions } from '../routing/plan';
import { placeIdOf, routesNear, suggestRoute } from '../routing/suggest';
import type { DirectedLine } from '../routing/types';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN, pointAt } from './fixtures/routeFixture';

const LINES = [FIXTURE_OUTBOUND, FIXTURE_RETURN];
// A second route 300 m north of the first, so both serve a place between them
const NORTH: DirectedLine = {
  ...FIXTURE_OUTBOUND,
  id: 'T2-OUT',
  routeCode: 'T2',
  coordinates: FIXTURE_OUTBOUND.coordinates.map(([lon, lat]) => [lon, pointAt(0, 300).lat - pointAt(0).lat + lat]),
};

describe('routes near a destination (F3)', () => {
  it('a destination 100 m from the line suggests that route', () => {
    expect(routesNear(LINES, pointAt(3, 100))).toEqual([{ routeCode: 'T1', walkM: 100 }]);
  });

  it('a destination 600 m away suggests none', () => {
    expect(routesNear(LINES, pointAt(3, 600))).toEqual([]);
    expect(routesNear(LINES, pointAt(3, MAX_WALK_PER_LEG_M + 1))).toEqual([]);
  });

  it('lists each route once, nearest first', () => {
    expect(routesNear([...LINES, NORTH], pointAt(3, 200)).map((item) => item.routeCode)).toEqual(['T2', 'T1']);
    expect(routesNear([...LINES, NORTH], pointAt(3, 50)).map((item) => item.routeCode)).toEqual(['T1', 'T2']);
  });
});

describe('the route to take (F3)', () => {
  it('is the planner’s option, and its fare matches the fare tests (6.3 km)', () => {
    const from = pointAt(1);
    const to = pointAt(7.3, 100);
    expect(suggestRoute(LINES, from, to)).toBe('T1');
    const itinerary = planOptions(LINES, from, to)[0];
    expect(fareForItinerary(LINES, itinerary, 1).rounded).toBe(21);
    expect(fareForItinerary(LINES, itinerary, FARE_DISCOUNT_MULTIPLIER).rounded).toBeCloseTo(16.75, 2);
  });

  it('is null when no route serves the trip', () => {
    expect(suggestRoute(LINES, pointAt(1), pointAt(5, 900))).toBeNull();
  });
});

describe('saved map points (F3)', () => {
  it('get the same id for the same point, rounded to about a metre', () => {
    expect(placeIdOf({ lat: 8.9474591, lon: 125.5414262 })).toBe('place-8.94746-125.54143');
    expect(placeIdOf({ lat: 8.9474594, lon: 125.5414258 })).toBe(placeIdOf({ lat: 8.9474591, lon: 125.5414262 }));
  });
});
