// Alternatives for a trip, and the "Best match": the quicker trip, then (among trips about as quick)
// free seats on multicabs still coming to the boarding point, their number, the shorter walk.
// Fixtures only.

import { planOptions } from '../routing/plan';
import { rankRouteOptions } from '../routing/rankOptions';
import type { DirectedLine } from '../routing/types';
import type { VehicleSnapshot } from '../telemetry/vehicle';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN, pointAt } from './fixtures/routeFixture';

// A second route on a street 100 m north of the first, in the same direction
const NORTH_DEG = 0.0009;
const PARALLEL: DirectedLine = {
  ...FIXTURE_OUTBOUND,
  id: 'T2-OUT',
  routeCode: 'T2',
  coordinates: FIXTURE_OUTBOUND.coordinates.map(([lon, lat]) => [lon, lat + NORTH_DEG]),
};
const LINES = [FIXTURE_OUTBOUND, FIXTURE_RETURN, PARALLEL];
const NOW = Date.UTC(2026, 9, 5, 2, 0, 0);

const vehicle = (id: string, lineId: string, km: number, seatsTaken: number): VehicleSnapshot => ({
  id,
  label: id,
  routeCode: lineId.slice(0, 2),
  lineId,
  ...pointAt(km),
  headingDeg: 90,
  speedKmh: 20,
  seatsTaken,
  lastPacketMs: NOW,
  recentSpeeds: [],
  demo: true,
});

describe('route alternatives', () => {
  const options = planOptions(LINES, pointAt(2), pointAt(5));

  it('gives one itinerary per route that serves the trip, shortest first', () => {
    expect(options.map((option) => option.legs[1].routeCode)).toEqual(['T1', 'T2']);
  });

  it('without vehicles, the shorter walk is the best match', () => {
    expect(rankRouteOptions(options, [], LINES, NOW)[0].itinerary.legs[1].routeCode).toBe('T1');
  });

  it('prefers the route with more free seats on multicabs still before the boarding point', () => {
    const vehicles = [
      vehicle('a', 'T1-OUT', 1, 15),
      vehicle('b', 'T2-OUT', 1, 2),
      // Already past the boarding point: does not count
      vehicle('c', 'T1-OUT', 3, 0),
    ];
    const ranked = rankRouteOptions(options, vehicles, LINES, NOW);
    expect(ranked.map((option) => [option.itinerary.legs[1].routeCode, option.approaching, option.freeSeats])).toEqual([
      ['T2', 1, 14],
      ['T1', 1, 1],
    ]);
  });

  it('a much longer ride is not the best match, even with more free seats (Emjay, 2026-10-26)', () => {
    // T2 rides 5 km more, about 17 minutes: far past RANK_TIME_TIE_MIN
    const detour = { ...options[1], rideKm: options[1].rideKm + 5 };
    const vehicles = [vehicle('a', 'T1-OUT', 1, 15), vehicle('b', 'T2-OUT', 1, 0)];
    const ranked = rankRouteOptions([detour, options[0]], vehicles, LINES, NOW);
    expect(ranked.map((option) => option.itinerary.legs[1].routeCode)).toEqual(['T1', 'T2']);
  });
});
