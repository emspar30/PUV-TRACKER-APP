// B2: a vehicle's round on its route, and the stand-in return leg of a one-leg route. Fixtures only.

import { BACK_LEG_SUFFIX, routeRound, withReturnLegs } from '../routing/loop';
import type { DirectedLine } from '../routing/types';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN } from './fixtures/routeFixture';

const SINGLE: DirectedLine = { ...FIXTURE_RETURN, id: 'T2-RET', routeCode: 'T2' };

describe('route loop', () => {
  it('adds a reversed stand-in leg only for a route with one stored leg', () => {
    const looped = withReturnLegs([FIXTURE_OUTBOUND, FIXTURE_RETURN, SINGLE]);
    expect(looped.map((line) => line.id)).toEqual(['T1-OUT', 'T1-RET', 'T2-RET', `T2-RET${BACK_LEG_SUFFIX}`]);
    const back = looped[3];
    expect(back.direction).toBe('outbound');
    expect(back.routeCode).toBe('T2');
    expect(back.coordinates[0]).toEqual(SINGLE.coordinates[SINGLE.coordinates.length - 1]);
    expect(back.coordinates[back.coordinates.length - 1]).toEqual(SINGLE.coordinates[0]);
  });

  it('leaves the stored lines untouched', () => {
    const before = JSON.stringify(SINGLE);
    withReturnLegs([SINGLE]);
    expect(JSON.stringify(SINGLE)).toBe(before);
  });

  it('a round starts on the given leg and goes outbound, then return', () => {
    const lines = [FIXTURE_RETURN, FIXTURE_OUTBOUND];
    expect(routeRound(lines, 'T1-OUT').map((line) => line.id)).toEqual(['T1-OUT', 'T1-RET']);
    expect(routeRound(lines, 'T1-RET').map((line) => line.id)).toEqual(['T1-RET', 'T1-OUT']);
    expect(routeRound(lines, 'NOPE')).toEqual([]);
  });
});
