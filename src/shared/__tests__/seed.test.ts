import { R4_LINES, R4_STATIONS, ROUTE_DATA_VERSION } from './fixtures/r4Placeholder';
import { FARE_BASE_KM, FARE_BASE_PHP, FARE_PER_KM_PHP } from '../config';

// Expected coordinate ranges for the Route 4 placeholders, from the values in PRD 12.5
const LAT_RANGE = [8.9, 8.96] as const;
const LON_RANGE = [125.52, 125.65] as const;

// PRD 12.5, as [code, latitude, longitude]
const PRD_STOPS: [string, number, number][] = [
  ['RCA', 8.947459, 125.541426],
  ['MCA', 8.947134, 125.544259],
  ['JCA', 8.947506, 125.541979],
  ['TSO', 8.946096, 125.533083],
  ['IMA', 8.94755, 125.531184],
  ['DEO', 8.9165511, 125.6420476],
];

const outbound = R4_LINES.find((line) => line.direction === 'outbound')!;
const returning = R4_LINES.find((line) => line.direction === 'return')!;

describe('Route 4 placeholder seed', () => {
  it('has a positive integer data version', () => {
    expect(Number.isInteger(ROUTE_DATA_VERSION)).toBe(true);
    expect(ROUTE_DATA_VERSION).toBeGreaterThan(0);
  });

  it('every stop is inside the expected ranges', () => {
    for (const stop of R4_STATIONS) {
      expect(stop.lat).toBeGreaterThanOrEqual(LAT_RANGE[0]);
      expect(stop.lat).toBeLessThanOrEqual(LAT_RANGE[1]);
      expect(stop.lon).toBeGreaterThanOrEqual(LON_RANGE[0]);
      expect(stop.lon).toBeLessThanOrEqual(LON_RANGE[1]);
    }
  });

  it('matches the PRD 12.5 stop table exactly', () => {
    expect(R4_STATIONS).toHaveLength(PRD_STOPS.length);
    for (const [code, lat, lon] of PRD_STOPS) {
      const stop = R4_STATIONS.find((s) => s.code === code);
      expect(stop).toBeDefined();
      expect(stop!.lat).toBe(lat);
      expect(stop!.lon).toBe(lon);
    }
  });

  it('station codes are unique and fit the SMS code format', () => {
    const codes = R4_STATIONS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2,4}$/);
  });

  it('polyline coordinates are longitude first, then latitude', () => {
    for (const line of R4_LINES) {
      for (const [first, second] of line.coordinates) {
        expect(first).toBeGreaterThan(100);
        expect(second).toBeLessThan(20);
      }
    }
  });

  it('the outbound line joins the stops in travel order', () => {
    const order = ['IMA', 'TSO', 'RCA', 'JCA', 'MCA', 'DEO'];
    expect(outbound.coordinates).toEqual(
      order.map((code) => {
        const stop = R4_STATIONS.find((s) => s.code === code)!;
        return [stop.lon, stop.lat];
      }),
    );
  });

  it('the return line is the outbound line reversed', () => {
    expect(returning.coordinates).toEqual([...outbound.coordinates].reverse());
  });

  it('stores Route 4 as two directed rows with one public route code', () => {
    expect(R4_LINES).toHaveLength(2);
    expect(new Set(R4_LINES.map((line) => line.routeId)).size).toBe(2);
    expect(R4_LINES.every((line) => line.routeCode === 'R4')).toBe(true);
    expect(R4_LINES.map((line) => line.direction).sort()).toEqual(['outbound', 'return']);
  });

  it('takes its fare defaults from config', () => {
    for (const line of R4_LINES) {
      expect(line.baseFare).toBe(FARE_BASE_PHP);
      expect(line.baseKm).toBe(FARE_BASE_KM);
      expect(line.perKmRate).toBe(FARE_PER_KM_PHP);
    }
  });
});
