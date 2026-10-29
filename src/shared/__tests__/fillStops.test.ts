// CA2-0: fill stops. Every point of every route line is within CHECKIN_STOP_MAX_M of a stop of that
// route; codes are unique and well formed; no two stops crowd each other; a rerun gives the same stops.

import { MAP_PLACES } from '../../data/seed/places';
import { GENERATED_EXTRA_ROUTES, GENERATED_FILL_STOPS } from '../../data/seed/fillStops.generated';
import { SEED_STATIONS } from '../../data/seed/routes';
import { GENERATED_LINES, GENERATED_STATIONS } from '../../data/seed/routes.generated';
import { CHECKIN_STOP_MAX_M, FILL_STOP_MERGE_M } from '../config';
import { haversineMeters } from '../geo/haversine';
import { lineLengthKm, pointAtChainage } from '../geo/line';
import { fillStops, isFillStopCode } from '../routing/fillStops';

const SAMPLE_M = 50;

describe('fill stops (CA2-0)', () => {
  it('leave no point of a route line farther than the check-in limit from a stop of that route', () => {
    const misses: string[] = [];
    for (const line of GENERATED_LINES) {
      const stops = SEED_STATIONS.filter((station) => station.routeCodes.includes(line.routeCode));
      const lengthM = lineLengthKm(line.coordinates) * 1000;
      for (let at = 0; at <= lengthM; at += SAMPLE_M) {
        const point = pointAtChainage(line.coordinates, at / 1000);
        const nearestM = Math.min(...stops.map((stop) => haversineMeters(point, stop)));
        if (nearestM > CHECKIN_STOP_MAX_M) misses.push(`${line.routeCode} ${line.direction} at ${Math.round(at)} m: ${Math.round(nearestM)} m`);
      }
    }
    expect(misses).toEqual([]);
  });

  it('have unique four-letter F codes, while the real stops keep three letters', () => {
    const codes = SEED_STATIONS.map((station) => station.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const stop of GENERATED_FILL_STOPS) expect(isFillStopCode(stop.code)).toBe(true);
    for (const station of GENERATED_STATIONS) expect(isFillStopCode(station.code)).toBe(false);
  });

  it(`are never within ${FILL_STOP_MERGE_M} m of another stop`, () => {
    const close: string[] = [];
    for (const fill of GENERATED_FILL_STOPS) {
      for (const other of SEED_STATIONS) {
        if (other.code !== fill.code && haversineMeters(fill, other) < FILL_STOP_MERGE_M) close.push(`${fill.code}-${other.code}`);
      }
    }
    expect(close).toEqual([]);
  });

  it('are named after a nearby place and belong to at least one route', () => {
    for (const stop of GENERATED_FILL_STOPS) {
      expect(stop.name.startsWith('Near ')).toBe(true);
      expect(stop.routeCodes.length).toBeGreaterThan(0);
    }
  });

  it('come out the same on a rerun (the checked-in file is current)', () => {
    const again = fillStops(
      GENERATED_LINES.map((line) => ({ routeCode: line.routeCode, coordinates: line.coordinates })),
      GENERATED_STATIONS,
      MAP_PLACES.map(([name, , group, lat, lon]) => ({ name, group, lat, lon })),
    );
    expect(again.stops.map((stop) => [stop.code, stop.routeCodes])).toEqual(GENERATED_FILL_STOPS.map((stop) => [stop.code, stop.routeCodes]));
    expect(again.extraRoutes).toEqual(GENERATED_EXTRA_ROUTES);
  });
});
