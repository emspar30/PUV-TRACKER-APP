// V1a (PRD 10.2, S8): the verification window on the R4 line from the route data.

import { ROUTE_LINES } from '../../../supabase/functions/_shared/routeLines.generated';
import { verifyWindow, type WindowFix } from '../../../supabase/functions/_shared/verifyWindow';
import { SEED_LINES } from '../../data/seed/routes';
import { MIN_DISPLACEMENT_M, MOTION_SPEED_FALLBACK_KMH, VERIFY_WINDOW_MAX_S } from '../config';
import { pointAtChainage } from '../geo/line';

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
