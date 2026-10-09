// RR3: the real stop list parsed and checked against the lines (keep within 150 m, move within
// 500 m, leave out farther; Emjay 2026-10-08). Fixtures only, plus the shipped seed.

import { ROUTE_STOP_MAX_DISTANCE_M, ROUTE_STOP_SNAP_MAX_M } from '../config';
import { projectOntoLine } from '../geo/line';
import { assignStops, parseStopList } from '../routing/stopImport';
import { GENERATED_LINES, GENERATED_STATIONS } from '../../data/seed/routes.generated';
import { FIXTURE_OUTBOUND, pointAt } from './fixtures/routeFixture';

const LINES = { T1: [FIXTURE_OUTBOUND.coordinates], T2: [FIXTURE_OUTBOUND.coordinates] };
const at = (routeCode: string, name: string, km: number, northM: number) => ({ routeCode, name, ...pointAt(km, northM) });

describe('stop list (RR3)', () => {
  it('reads each route heading and its stops, with names that hold dashes, apostrophes and accents', () => {
    const md = "# Real Route Stops\n\n## Route 1 (R1)\n* Robinsons-Transport Terminal: 8.9426, 125.5200\n* Butuan Doctors' Hospital: 8.9436, 125.5219\n\n## Route 14 (R14)\n* Santo Niño: 8.9700, 125.5800 \n";
    expect(parseStopList(md)).toEqual([
      { routeCode: 'R1', name: 'Robinsons-Transport Terminal', lat: 8.9426, lon: 125.52 },
      { routeCode: 'R1', name: "Butuan Doctors' Hospital", lat: 8.9436, lon: 125.5219 },
      { routeCode: 'R14', name: 'Santo Niño', lat: 8.97, lon: 125.58 },
    ]);
  });

  it('reads a position with no space after the comma, and a name with no colon after it (ST2-C2)', () => {
    const md = '## Route 14 (R14)\n* Robinsons-Transport 8.943060, 125.519548\n* Nissan: 8.9538664,125.5642312\n';
    expect(parseStopList(md)).toEqual([
      { routeCode: 'R14', name: 'Robinsons-Transport', lat: 8.94306, lon: 125.519548 },
      { routeCode: 'R14', name: 'Nissan', lat: 8.9538664, lon: 125.5642312 },
    ]);
  });

  it('keeps a stop within 150 m as given, moves one within 500 m onto the line, and leaves out one farther', () => {
    const listed = [at('T1', 'Near', 1, ROUTE_STOP_MAX_DISTANCE_M - 10), at('T1', 'Off', 3, ROUTE_STOP_MAX_DISTANCE_M + 50), at('T1', 'Far', 5, ROUTE_STOP_SNAP_MAX_M + 50)];
    const { stations, issues } = assignStops(listed, LINES, { Near: 'NEA', Off: 'OFF', Far: 'FAR' }, {});
    expect(stations.map((s) => [s.code, s.moved !== undefined])).toEqual([
      ['NEA', false],
      ['OFF', true],
    ]);
    expect(stations[0]).toMatchObject(pointAt(1, ROUTE_STOP_MAX_DISTANCE_M - 10));
    expect(projectOntoLine(FIXTURE_OUTBOUND.coordinates, stations[1]).offsetM).toBeLessThan(1);
    expect(stations[1].moved?.offsetM).toBeCloseTo(ROUTE_STOP_MAX_DISTANCE_M + 50, -1);
    expect(issues).toEqual([expect.objectContaining({ code: 'FAR', reason: 'too_far' })]);
  });

  it('makes one station of a stop listed under several routes or names at one position', () => {
    const listed = [at('T1', 'Hotel Oazis', 2, 0), at('T2', 'Hotel Oasis', 2, 0)];
    const { stations } = assignStops(listed, LINES, { 'Hotel Oazis': 'OAZ', 'Hotel Oasis': 'OAZ' }, { OAZ: 'Hotel Oazis' });
    expect(stations).toEqual([expect.objectContaining({ code: 'OAZ', name: 'Hotel Oazis', routeCodes: ['T1', 'T2'] })]);
  });

  it('refuses a name with no code, one code at two positions, and two codes at one position', () => {
    expect(() => assignStops([at('T1', 'X', 1, 0)], LINES, {}, {})).toThrow('no station code');
    expect(() => assignStops([at('T1', 'A', 1, 0), at('T1', 'A', 2, 0)], LINES, { A: 'AAA' }, {})).toThrow('two positions');
    expect(() => assignStops([at('T1', 'A', 1, 0), at('T1', 'B', 1, 0)], LINES, { A: 'AAA', B: 'BBB' }, {})).toThrow('same position');
  });
});

describe('the shipped stations (RR3)', () => {
  it('have unique letters-only codes that fit the SMS protocol and the check-in column', () => {
    const codes = GENERATED_STATIONS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2,4}$/);
  });

  it('each lies within 150 m of a line of every route it is listed on', () => {
    for (const station of GENERATED_STATIONS) {
      expect(station.routeCodes.length).toBeGreaterThan(0);
      for (const code of station.routeCodes) {
        const offsets = GENERATED_LINES.filter((line) => line.routeCode === code).map((line) => projectOntoLine(line.coordinates, station).offsetM);
        expect(Math.min(...offsets)).toBeLessThanOrEqual(ROUTE_STOP_MAX_DISTANCE_M);
      }
    }
  });

  it('cover the six traced routes', () => {
    expect([...new Set(GENERATED_LINES.map((line) => line.routeCode))].sort()).toEqual(['R1', 'R14', 'R2', 'R3', 'R4', 'R5']);
    for (const code of ['R1', 'R2', 'R3', 'R4', 'R5', 'R14']) expect(GENERATED_STATIONS.some((s) => s.routeCodes.includes(code))).toBe(true);
  });
});
