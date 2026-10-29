// CA2a: check in anywhere along a route. Near the line of a pinged route and within the stop limit
// of the stop it counts at; at the stop itself the line does not matter. The GPS gates still apply.

import { checkInAlongRoute, type Place } from '../checkin/geofence';
import { CHECKIN_LINE_M, CHECKIN_RADIUS_M, CHECKIN_STOP_MAX_M, GPS_ACCURACY_GATE_CHECKIN_M, LOCATION_FIX_MAX_AGE_S } from '../config';

const M_PER_DEG = 111195;
const STOP = { lat: 8.95, lon: 125.54 };
// A straight east-west road through the stop, 2 km each way
const LINE: [number, number][] = [
  [STOP.lon - 2000 / M_PER_DEG, STOP.lat],
  [STOP.lon + 2000 / M_PER_DEG, STOP.lat],
];
// East along the road, then north off it (metres; near enough to flat here)
const at = (eastM: number, northM = 0, extra: Partial<Place> = {}): Place => ({
  lat: STOP.lat + northM / M_PER_DEG,
  lon: STOP.lon + eastM / (M_PER_DEG * Math.cos((STOP.lat * Math.PI) / 180)),
  source: 'gps',
  accuracyM: 10,
  ...extra,
});

describe('check in anywhere along a route (CA2a)', () => {
  it('counts a commuter on the road between stops at the stop', () => {
    expect(checkInAlongRoute(at(180), STOP, [LINE])).toEqual({ ok: true, stopM: 180 });
    expect(checkInAlongRoute(at(CHECKIN_STOP_MAX_M - 5, CHECKIN_LINE_M - 5), STOP, [LINE]).ok).toBe(true);
  });

  it('refuses the road too far from any stop', () => {
    expect(checkInAlongRoute(at(CHECKIN_STOP_MAX_M + 30), STOP, [LINE])).toEqual({ ok: false, reason: 'too_far_from_stop', stopM: CHECKIN_STOP_MAX_M + 30 });
  });

  it('refuses a place off the route, even close to the stop', () => {
    const result = checkInAlongRoute(at(100, CHECKIN_LINE_M + 30), STOP, [LINE]);
    expect(result).toMatchObject({ ok: false, reason: 'too_far_from_line' });
    expect(result.ok === false && result.reason === 'too_far_from_line' && result.lineM).toBe(CHECKIN_LINE_M + 30);
  });

  it('lets anyone at the stop itself check in, on the road or not', () => {
    expect(checkInAlongRoute(at(0, CHECKIN_RADIUS_M - 5), STOP, [LINE]).ok).toBe(true);
  });

  it('measures against every pinged line', () => {
    const other: [number, number][] = [
      [STOP.lon, STOP.lat - 2000 / M_PER_DEG],
      [STOP.lon, STOP.lat + 2000 / M_PER_DEG],
    ];
    expect(checkInAlongRoute(at(0, 200), STOP, [LINE]).ok).toBe(false);
    expect(checkInAlongRoute(at(0, 200), STOP, [LINE, other]).ok).toBe(true);
  });

  it('keeps the GPS gates: inaccurate, mocked, stale, no position', () => {
    expect(checkInAlongRoute(at(100, 0, { accuracyM: GPS_ACCURACY_GATE_CHECKIN_M + 1 }), STOP, [LINE])).toEqual({ ok: false, reason: 'inaccurate' });
    expect(checkInAlongRoute(at(100, 0, { mocked: true }), STOP, [LINE])).toEqual({ ok: false, reason: 'mocked' });
    expect(checkInAlongRoute(at(100, 0, { ageS: LOCATION_FIX_MAX_AGE_S + 1 }), STOP, [LINE])).toEqual({ ok: false, reason: 'stale' });
    expect(checkInAlongRoute(null, STOP, [LINE])).toEqual({ ok: false, reason: 'no_position' });
    expect(checkInAlongRoute(at(100, 0, { source: 'pin' }), STOP, [LINE])).toEqual({ ok: false, reason: 'no_position' });
  });

  it('trusts a simulated position, but still measures it', () => {
    expect(checkInAlongRoute(at(150, 0, { source: 'simulated', accuracyM: null }), STOP, [LINE]).ok).toBe(true);
    expect(checkInAlongRoute(at(500, 0, { source: 'simulated', accuracyM: null }), STOP, [LINE]).ok).toBe(false);
  });
});
