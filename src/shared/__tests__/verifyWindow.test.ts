// V1a (PRD 10.2, S8): the verification window on the R4 line from the route data.

import fs from 'node:fs';
import path from 'node:path';

import { DETOUR_LINES, ROUTE_LINES } from '../../../supabase/functions/_shared/routeLines.generated';
import { inVehicle, verifyWindow, type WindowFix } from '../../../supabase/functions/_shared/verifyWindow';
import { SEED_DETOURS } from '../../data/seed/detours';
import { SEED_LINES } from '../../data/seed/routes';
import { MIN_DISPLACEMENT_M, MOTION_IN_VEHICLE_SHARE, MOTION_MIN_ACTIVITY_SAMPLES, MOTION_SPEED_FALLBACK_KMH, VERIFY_WINDOW_MAX_S } from '../config';
import { pointAtChainage } from '../geo/line';
import { activeDetours } from '../routing/detours';

const R4 = SEED_LINES.filter((line) => line.routeCode === 'R4').map((line) => line.coordinates);
const LINE = R4[0];
const T0 = Date.UTC(2026, 10, 2, 2, 0, 0);
const MS_PER_S = 1000;
const KMH_TO_MPS = 1 / 3.6;
const OFF_ROUTE_M = 100;
const M_PER_DEG_LAT = 111_320;

// Fixes every `stepS` seconds for `seconds`, moving along the R4 line at `kmh` from 200 m in
function ride(kmh: number, seconds: number, stepS = 5, offsetM = 0): WindowFix[] {
  const fixes: WindowFix[] = [];
  for (let s = 0; s <= seconds; s += stepS) {
    const at = pointAtChainage(LINE, (200 + kmh * KMH_TO_MPS * s) / 1000);
    fixes.push({ lat: at.lat + offsetM / M_PER_DEG_LAT, lon: at.lon, atMs: T0 + s * MS_PER_S, accuracyM: 10 });
  }
  return fixes;
}

describe('V1a verification window', () => {
  it('a ride along R4 at 30 km/h passes once it held the speed for 20 s', () => {
    expect(verifyWindow({ fixes: ride(30, 25), lines: R4, beaconOk: true })).toEqual({ status: 'verified', reasons: [] });
    expect(verifyWindow({ fixes: ride(30, 10), lines: R4, beaconOk: true }).status).toBe('pending');
  });

  it('a stationary rider fails on motion and displacement, after the extended window', () => {
    expect(verifyWindow({ fixes: ride(0, 60), lines: R4, beaconOk: true })).toEqual({ status: 'pending', reasons: ['no_motion', 'no_displacement'] });
    expect(verifyWindow({ fixes: ride(0, VERIFY_WINDOW_MAX_S), lines: R4, beaconOk: true })).toEqual({ status: 'failed', reasons: ['no_motion', 'no_displacement'] });
  });

  it('a walk at 5 km/h fails on motion', () => {
    const result = verifyWindow({ fixes: ride(5, VERIFY_WINDOW_MAX_S), lines: R4, beaconOk: true });
    expect(result.status).toBe('failed');
    expect(result.reasons).toContain('no_motion');
  });

  it('a ride 100 m off the line fails on the route at once', () => {
    expect(verifyWindow({ fixes: ride(30, 10, 5, OFF_ROUTE_M), lines: R4, beaconOk: true })).toEqual({ status: 'failed', reasons: ['off_route'] });
  });

  it('a relay whose beacon was not verified fails; the server, which cannot know, does not test it', () => {
    expect(verifyWindow({ fixes: ride(30, 25), lines: R4, beaconOk: false })).toEqual({ status: 'failed', reasons: ['no_beacon'] });
    expect(verifyWindow({ fixes: ride(30, 25), lines: R4, beaconOk: null }).status).toBe('verified');
  });

  it('fixes worse than the accuracy gate are left out', () => {
    const fixes = ride(30, 25).map((fix, i) => (i % 2 === 1 ? { ...fix, lat: fix.lat + OFF_ROUTE_M / M_PER_DEG_LAT, accuracyM: 80 } : fix));
    expect(verifyWindow({ fixes, lines: R4, beaconOk: true }).status).toBe('verified');
  });

  it('uses the phone speed reading when present', () => {
    const fixes = ride(30, 25).map((fix) => ({ ...fix, speedKmh: MOTION_SPEED_FALLBACK_KMH - 1 }));
    expect(verifyWindow({ fixes, lines: R4, beaconOk: true }).reasons).toContain('no_motion');
  });

  it('needs the displacement along the line', () => {
    expect(MIN_DISPLACEMENT_M).toBeGreaterThan(0);
    expect(verifyWindow({ fixes: [], lines: R4, beaconOk: true })).toEqual({ status: 'pending', reasons: ['too_few_fixes'] });
  });

  it('the server copy of the route lines is current', () => {
    const routes = [...new Set(SEED_LINES.map((line) => line.routeCode))].sort();
    expect(Object.keys(ROUTE_LINES).sort()).toEqual(routes);
    for (const route of routes) {
      const app = SEED_LINES.filter((line) => line.routeCode === route).map((line) => line.coordinates.length);
      expect(ROUTE_LINES[route].map((line) => line.length)).toEqual(app);
    }
  });
});

describe('DT1: detours in the verification window', () => {
  // A made-up detour: the R4 line moved 100 m north, so a ride on it is off the R4 line
  const DETOUR = LINE.map(([lon, lat]) => [lon, lat + OFF_ROUTE_M / M_PER_DEG_LAT] as const);
  const onDetour = ride(30, 25, 5, OFF_ROUTE_M);

  it('a ride on an active detour passes, and says it is on a detour', () => {
    expect(verifyWindow({ fixes: onDetour, lines: R4, beaconOk: true, detours: [DETOUR] })).toEqual({ status: 'verified', reasons: [], onDetour: true });
  });

  it('the same ride without the detour active fails on the route', () => {
    expect(verifyWindow({ fixes: onDetour, lines: R4, beaconOk: true })).toEqual({ status: 'failed', reasons: ['off_route'] });
  });

  it('a ride on the route itself is not on a detour, even with one active', () => {
    expect(verifyWindow({ fixes: ride(30, 25), lines: R4, beaconOk: true, detours: [DETOUR] })).toEqual({ status: 'verified', reasons: [] });
  });

  it('the server copy of the detour lines matches the app data, and fares never read detours', () => {
    expect(Object.keys(DETOUR_LINES).sort()).toEqual(SEED_DETOURS.map((detour) => detour.id).sort());
    for (const detour of SEED_DETOURS) expect(DETOUR_LINES[detour.id].route).toBe(detour.routeCode);
    expect(fs.readFileSync(path.join(__dirname, '..', 'routing', 'plan.ts'), 'utf8')).not.toMatch(/detour/i);
    expect(fs.readFileSync(path.join(__dirname, '..', 'fare', 'fare.ts'), 'utf8')).not.toMatch(/detour/i);
  });

  it('only active detours of the route are used', () => {
    const detours = [
      { id: 'R4-bypass', routeCode: 'R4', name: 'Bypass', coordinates: [] },
      { id: 'R5-bypass', routeCode: 'R5', name: 'Bypass', coordinates: [] },
    ];
    expect(activeDetours(detours, ['R4-bypass', 'R5-bypass'], 'R4').map((d) => d.id)).toEqual(['R4-bypass']);
    expect(activeDetours(detours, [], 'R4')).toEqual([]);
    expect(activeDetours(detours, ['R5-bypass']).map((d) => d.id)).toEqual(['R5-bypass']);
  });
});

describe('V1b: the in-vehicle signal in the motion test', () => {
  // Stop-and-go traffic: 15 km/h, never the 25 km/h fallback, but 75 m along the line
  const crawl = ride(15, 20);
  const reports = (inVehicle: boolean[]) => inVehicle.map((value, i) => ({ atMs: T0 + i * 5 * MS_PER_S, inVehicle: value }));

  it('speed alone fails a stop-and-go ride', () => {
    expect(verifyWindow({ fixes: crawl, lines: R4, beaconOk: true }).reasons).toContain('no_motion');
  });

  it('it passes when the phone says "in a vehicle" for most of its reports', () => {
    expect(verifyWindow({ fixes: crawl, lines: R4, beaconOk: true, activity: reports([true, true, false, true]) })).toEqual({ status: 'verified', reasons: [] });
  });

  it('too few reports, or mostly not in a vehicle, do not count', () => {
    expect(verifyWindow({ fixes: crawl, lines: R4, beaconOk: true, activity: reports([true, true]) }).reasons).toContain('no_motion');
    expect(verifyWindow({ fixes: crawl, lines: R4, beaconOk: true, activity: reports([true, false, false, false]) }).reasons).toContain('no_motion');
  });

  it('the share and the minimum come from the config', () => {
    expect(inVehicle(reports([true, true, true]))).toBe(MOTION_MIN_ACTIVITY_SAMPLES <= 3 && MOTION_IN_VEHICLE_SHARE <= 1);
  });
});
