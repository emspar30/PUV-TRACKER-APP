// My Ride messages: wrong direction (other direction mapped), direction not mapped yet, and no single
// route serving both points. Synthetic fixtures only; the routing is unchanged.

import { explainFailure } from '../routing/explainFailure';
import { planTrip, type PlanFailureResult } from '../routing/plan';
import type { DirectedLine } from '../routing/types';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN, pointAt } from './fixtures/routeFixture';

const failureOf = (lines: DirectedLine[], from: ReturnType<typeof pointAt>, to: ReturnType<typeof pointAt>) => {
  const plan = planTrip(lines, from, to);
  if (plan.ok) throw new Error('expected a failure');
  return plan as PlanFailureResult;
};

// A one-way street 3 km north, with only its outbound mapped (like R4 and R5 today)
const ONE_WAY: DirectedLine = {
  ...FIXTURE_OUTBOUND,
  id: 'T2-OUT',
  routeCode: 'T2',
  coordinates: FIXTURE_OUTBOUND.coordinates.map(([lon, lat]) => [lon, lat + 0.027]),
};

describe('explainFailure', () => {
  it('the other direction is mapped (on another street): wrong direction, Swap stays', () => {
    // The return runs on a street about 1.1 km north, out of walking reach of both points
    const otherStreet: DirectedLine = { ...FIXTURE_RETURN, coordinates: FIXTURE_RETURN.coordinates.map(([lon, lat]) => [lon, lat + 0.01]) };
    const lines = [FIXTURE_OUTBOUND, otherStreet];
    const failure = failureOf(lines, pointAt(6), pointAt(2));
    expect(failure.reason).toBe('destination_not_ahead');
    expect(explainFailure(lines, failure, pointAt(6), pointAt(2))).toEqual({ kind: 'wrong_direction', routeCode: 'T1' });
  });

  it('the route serves both points only in a direction that is not mapped yet', () => {
    const from = { ...pointAt(6), lat: pointAt(6).lat + 0.027 };
    const to = { ...pointAt(2), lat: pointAt(2).lat + 0.027 };
    const failure = failureOf([ONE_WAY], from, to);
    expect(failure.reason).toBe('destination_not_ahead');
    expect(explainFailure([ONE_WAY], failure, from, to)).toEqual({ kind: 'not_mapped', routeCode: 'T2' });
  });

  it('no route serves both points: the routes near each point', () => {
    const lines = [FIXTURE_OUTBOUND, ONE_WAY];
    const from = pointAt(1);
    const to = { ...pointAt(5), lat: pointAt(5).lat + 0.027 };
    const failure = failureOf(lines, from, to);
    expect(failure.reason).toBe('destination_too_far');
    expect(explainFailure(lines, failure, from, to)).toEqual({ kind: 'different_routes', originRoutes: ['T1'], destinationRoutes: ['T2'] });
  });

  it('far from every route: the plan\'s own message', () => {
    const far = { ...pointAt(4), lat: pointAt(4).lat + 0.1 };
    const failure = failureOf([FIXTURE_OUTBOUND], far, pointAt(2));
    expect(explainFailure([FIXTURE_OUTBOUND], failure, far, pointAt(2))).toEqual({ kind: 'as_planned' });
  });
});
