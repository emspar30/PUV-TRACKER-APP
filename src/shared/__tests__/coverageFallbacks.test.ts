// CF1 coverage fallbacks (PRD 7.3 as amended 2026-10-17): Estimated markers moved along the line
// by dead reckoning between 90 s and 5 minutes of silence, the overlapping route suggested when the
// picked one has no Live vehicle, and the demo route left empty so the nudge can be seen.

import { createDemoVehicles, type DemoClock } from '../../data/demo/demoVehicles';
import { DEMO_EMPTY_ROUTES, GHOST_MAX_DISTANCE_KM } from '../config';
import { haversineMeters } from '../geo/haversine';
import { lineEndKm, projectOntoLine } from '../geo/line';
import { bestAlternative, overlappingRoutes } from '../routing/alternatives';
import type { DirectedLine, RouteStop } from '../routing/types';
import { displayPosition, ghostSpeedKmh, isGhostAge } from '../telemetry/deadReckoning';
import { vehicleMarkerFeatures } from '../telemetry/markers';
import type { VehicleSnapshot } from '../telemetry/vehicle';
import { FIXTURE_OUTBOUND, FIXTURE_STOPS, pointAt } from './fixtures/routeFixture';

const NOW = 1_000_000_000;
const LINE = FIXTURE_OUTBOUND.coordinates;
const END_KM = lineEndKm(LINE);

// Speed samples every 5 s over the 90 s before the last packet
const speeds = (ageS: number, kmh: number | number[]) =>
  Array.from({ length: 19 }, (_v, index) => ({
    atMs: NOW - ageS * 1000 - (90 - index * 5) * 1000,
    speedKmh: Array.isArray(kmh) ? kmh[index % kmh.length] : kmh,
  }));

const vehicle = (ageS: number, extra: Partial<VehicleSnapshot> = {}): VehicleSnapshot => ({
  id: 'v1',
  label: 'DEMO 01',
  routeCode: 'T1',
  lineId: 'T1-OUT',
  ...pointAt(1),
  headingDeg: 90,
  speedKmh: 30,
  seatsTaken: 3,
  lastPacketMs: NOW - ageS * 1000,
  recentSpeeds: speeds(ageS, 30),
  demo: true,
  ...extra,
});

const kmAlong = (at: { lat: number; lon: number }) => projectOntoLine(LINE, at).chainageKm;

describe('Estimated window', () => {
  it('89 s no, 90 s yes, 299 s yes, 300 s no', () => {
    expect([89, 90, 299, 300].map(isGhostAge)).toEqual([false, true, true, false]);
  });
});

describe('dead reckoning along the line', () => {
  it('a Live vehicle stays at its fix', () => {
    const at = displayPosition(vehicle(10), LINE, NOW);
    expect(at).toEqual({ ...pointAt(1), headingDeg: 90, ghost: false });
  });

  it('120 s silent at 30 km/h: moved 1 km along the line, facing along it', () => {
    const at = displayPosition(vehicle(120), LINE, NOW);
    expect(at.ghost).toBe(true);
    expect(kmAlong(at) - 1).toBeCloseTo(1, 1);
    expect(haversineMeters(at, pointAt(2))).toBeLessThan(20);
    expect(at.headingDeg).toBeCloseTo(90, 0);
  });

  it('moves with the clock: further at 200 s than at 100 s', () => {
    const early = displayPosition(vehicle(100), LINE, NOW);
    const later = displayPosition({ ...vehicle(100) }, LINE, NOW + 100_000);
    expect(kmAlong(later)).toBeGreaterThan(kmAlong(early));
  });

  it('uses the median speed, so one fast sample does not throw it', () => {
    expect(ghostSpeedKmh(vehicle(120, { recentSpeeds: speeds(120, [20, 20, 90]) }))).toBe(20);
  });

  it('caps the speed at 40 km/h', () => {
    expect(ghostSpeedKmh(vehicle(120, { recentSpeeds: speeds(120, 80) }))).toBe(40);
  });

  it('never moves more than the maximum distance', () => {
    const at = displayPosition(vehicle(290, { recentSpeeds: speeds(290, 40) }), LINE, NOW);
    expect(kmAlong(at) - 1).toBeCloseTo(GHOST_MAX_DISTANCE_KM, 1);
  });

  it('stops at the end of the line', () => {
    const near = vehicle(290, { ...pointAt(END_KM - 0.2), recentSpeeds: speeds(290, 40) });
    const at = displayPosition(near, LINE, NOW);
    expect(kmAlong(at)).toBeCloseTo(END_KM, 2);
  });

  it('a stopped vehicle is Estimated but not moved', () => {
    const at = displayPosition(vehicle(120, { recentSpeeds: speeds(120, 0), speedKmh: 0 }), LINE, NOW);
    expect(at).toEqual({ ...pointAt(1), headingDeg: 90, ghost: true });
  });

  it('a vehicle laying over is not moved', () => {
    expect(displayPosition(vehicle(120, { layover: true }), LINE, NOW)).toEqual({ ...pointAt(1), headingDeg: 90, ghost: true });
  });

  it('without its line it stays at the fix, still Estimated', () => {
    expect(displayPosition(vehicle(120), undefined, NOW)).toEqual({ ...pointAt(1), headingDeg: 90, ghost: true });
  });

  it('after 5 minutes it is plain Stale, back at its last fix', () => {
    expect(displayPosition(vehicle(400), LINE, NOW)).toEqual({ ...pointAt(1), headingDeg: 90, ghost: false });
  });
});

describe('Estimated marker features', () => {
  const cone = { lengthPx: 22, halfAngleDeg: 28, zoom: 14 };

  it('an Estimated vehicle is drawn moved and flagged ghost and stale; a Live one is not', () => {
    const live = { ...vehicle(10), id: 'live' };
    const ghost = { ...vehicle(120), id: 'ghost' };
    const { points } = vehicleMarkerFeatures([live, ghost], NOW, cone, (id) => (id === 'T1-OUT' ? LINE : undefined));
    const [a, b] = points.features;
    expect([a.properties.ghost, a.properties.stale]).toEqual([false, false]);
    expect([b.properties.ghost, b.properties.stale]).toEqual([true, true]);
    const [lon, lat] = b.geometry.coordinates;
    expect(kmAlong({ lat, lon }) - 1).toBeCloseTo(1, 1);
  });

  it('without a line lookup, markers stay at their fixes', () => {
    const { points } = vehicleMarkerFeatures([vehicle(120)], NOW, cone);
    expect(points.features[0].geometry.coordinates).toEqual([pointAt(1).lon, pointAt(1).lat]);
  });
});

describe('smart alternatives', () => {
  // T2 crosses T1 at its 2 km stop (SHR), running north to south; T3 runs beside T1 with no shared stop
  const T2: DirectedLine = {
    ...FIXTURE_OUTBOUND,
    id: 'T2-OUT',
    routeCode: 'T2',
    coordinates: [pointAt(2, 3000), pointAt(2, -3000)].map(({ lat, lon }) => [lon, lat]),
  };
  const T3: DirectedLine = { ...FIXTURE_OUTBOUND, id: 'T3-OUT', routeCode: 'T3' };
  const LINES = [FIXTURE_OUTBOUND, T2, T3];
  const STOPS: RouteStop[] = [
    { code: 'AAA', name: 'West end', ...pointAt(0), routeCodes: ['T1'] },
    { code: 'SHR', name: 'Shared', ...pointAt(2), routeCodes: ['T1', 'T2'] },
    { code: 'TTT', name: 'Third', ...pointAt(4), routeCodes: ['T3'] },
  ];
  const on = (routeCode: string, at: { lat: number; lon: number }, ageS = 5): VehicleSnapshot => ({
    ...vehicle(ageS, at),
    id: `${routeCode}-${at.lat}`,
    routeCode,
    lineId: `${routeCode}-OUT`,
  });
  const best = (vehicles: VehicleSnapshot[], anchor: { lat: number; lon: number } | null = pointAt(2, 50)) =>
    bestAlternative({ routeCode: 'T1', lines: LINES, stops: STOPS, vehicles, nowMs: NOW, anchor });

  it('overlapping routes share a stop with the picked one', () => {
    expect(overlappingRoutes(STOPS, 'T1')).toEqual(['T2']);
    expect(overlappingRoutes(FIXTURE_STOPS, 'T1')).toEqual([]);
  });

  it('suggests the overlapping route with a Live vehicle near the commuter', () => {
    expect(best([on('T2', pointAt(2, 500))])).toEqual({ routeCode: 'T2', distanceM: 450 });
  });

  it('a route that shares no stop is not suggested, even with a vehicle beside the commuter', () => {
    expect(best([on('T3', pointAt(2, 0))])).toBeNull();
  });

  it('a Stale vehicle does not count', () => {
    expect(best([on('T2', pointAt(2, 500), 120)])).toBeNull();
  });

  it('a vehicle more than 2 km away does not count', () => {
    expect(best([on('T2', pointAt(2, 2200))])).toBeNull();
  });

  it('a route the commuter cannot walk to is not suggested', () => {
    expect(best([on('T2', pointAt(2, 500))], pointAt(6))).toBeNull();
  });

  it('without a position, the distance is to the nearest shared or own stop', () => {
    expect(best([on('T2', pointAt(2, 500))], null)).toEqual({ routeCode: 'T2', distanceM: 500 });
  });
});

describe('demo empty route', () => {
  const clock: DemoClock = { now: () => NOW, setInterval: () => 0, clearInterval: () => undefined };
  const R14: DirectedLine = { ...FIXTURE_OUTBOUND, id: 'R14-OUT', routeCode: 'R14' };

  it('R14 is listed and has no demo vehicles; other routes do', () => {
    expect(DEMO_EMPTY_ROUTES).toContain('R14');
    const repository = createDemoVehicles([FIXTURE_OUTBOUND, R14], FIXTURE_STOPS, { seed: 42, clock });
    const seen: Record<string, number> = {};
    repository.subscribe('R14', (vehicles) => (seen.R14 = vehicles.length));
    repository.subscribe('T1', (vehicles) => (seen.T1 = vehicles.length));
    expect(seen.R14).toBe(0);
    expect(seen.T1).toBeGreaterThan(0);
  });

  it('the stress setting still fills it', () => {
    const repository = createDemoVehicles([R14], FIXTURE_STOPS, { seed: 42, clock, stress: true });
    let count = 0;
    repository.subscribe('R14', (vehicles) => (count = vehicles.length));
    expect(count).toBeGreaterThan(0);
  });
});
