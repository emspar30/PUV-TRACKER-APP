// CA3: two ways to check in, at a stop or near the route, and the check-in ending by itself once
// the commuter leaves. The GPS gates still apply.

import { checkInGeofence, checkInNearRoute, type Place } from '../checkin/geofence';
import { checkLeave, stayArea } from '../checkin/leave';
import { parseStoredCheckIn, startCheckIn } from '../checkin/localCheckin';
import { CHECKIN_LEAVE_M, CHECKIN_LEAVE_READINGS, CHECKIN_LINE_M, CHECKIN_STOP_MAX_M, GPS_ACCURACY_GATE_CHECKIN_M, LOCATION_FIX_MAX_AGE_S } from '../config';

const M_PER_DEG = 111195;
const ORIGIN = { lat: 8.95, lon: 125.54 };
// East along the road, then north off it (metres; near enough to flat here)
const at = (eastM: number, northM = 0, extra: Partial<Place> = {}): Place => ({
  lat: ORIGIN.lat + northM / M_PER_DEG,
  lon: ORIGIN.lon + eastM / (M_PER_DEG * Math.cos((ORIGIN.lat * Math.PI) / 180)),
  source: 'gps',
  accuracyM: 10,
  ...extra,
});
// A straight east-west road, 2 km each way, with SM Butuan at 0 and Robinsons 1 km east
const LINE: [number, number][] = [
  [at(-2000).lon, ORIGIN.lat],
  [at(2000).lon, ORIGIN.lat],
];
const SMB = { code: 'SMB', ...at(0) };
const ROB = { code: 'ROB', ...at(1000) };
const STOPS = [SMB, ROB];

describe('check in near the route (CA3)', () => {
  it('counts a commuter between two stops near the nearer one', () => {
    expect(checkInNearRoute(at(400), [LINE], STOPS)).toEqual({ ok: true, stop: SMB, stopM: 400 });
    expect(checkInNearRoute(at(600, CHECKIN_LINE_M - 5), [LINE], STOPS)).toMatchObject({ ok: true, stop: ROB });
  });

  it('has no distance limit from the stop, only from the line', () => {
    expect(checkInNearRoute(at(-1500), [LINE], STOPS)).toMatchObject({ ok: true, stop: SMB, stopM: 1500 });
  });

  it('refuses a place off the route', () => {
    expect(checkInNearRoute(at(400, CHECKIN_LINE_M + 30), [LINE], STOPS)).toEqual({ ok: false, reason: 'too_far_from_line', lineM: CHECKIN_LINE_M + 30 });
  });

  it('measures against every pinged line', () => {
    const north: [number, number][] = [
      [ORIGIN.lon, at(0, -2000).lat],
      [ORIGIN.lon, at(0, 2000).lat],
    ];
    expect(checkInNearRoute(at(0, 500), [LINE], STOPS).ok).toBe(false);
    expect(checkInNearRoute(at(0, 500), [LINE, north], STOPS).ok).toBe(true);
  });

  it('needs a line and a stop', () => {
    expect(checkInNearRoute(at(0), [], STOPS)).toEqual({ ok: false, reason: 'no_stop' });
    expect(checkInNearRoute(at(0), [LINE], [])).toEqual({ ok: false, reason: 'no_stop' });
  });

  it('keeps the GPS gates: inaccurate, mocked, stale, no position', () => {
    expect(checkInNearRoute(at(100, 0, { accuracyM: GPS_ACCURACY_GATE_CHECKIN_M + 1 }), [LINE], STOPS)).toEqual({ ok: false, reason: 'inaccurate' });
    expect(checkInNearRoute(at(100, 0, { mocked: true }), [LINE], STOPS)).toEqual({ ok: false, reason: 'mocked' });
    expect(checkInNearRoute(at(100, 0, { ageS: LOCATION_FIX_MAX_AGE_S + 1 }), [LINE], STOPS)).toEqual({ ok: false, reason: 'stale' });
    expect(checkInNearRoute(null, [LINE], STOPS)).toEqual({ ok: false, reason: 'no_position' });
    expect(checkInNearRoute(at(100, 0, { source: 'pin' }), [LINE], STOPS)).toEqual({ ok: false, reason: 'no_position' });
  });

  it('trusts a simulated position, but still measures it', () => {
    expect(checkInNearRoute(at(150, 0, { source: 'simulated', accuracyM: null }), [LINE], STOPS).ok).toBe(true);
    expect(checkInNearRoute(at(150, 200, { source: 'simulated', accuracyM: null }), [LINE], STOPS).ok).toBe(false);
  });
});

describe('check in at a stop (CA3)', () => {
  it(`takes anyone within ${CHECKIN_STOP_MAX_M} m of the stop, on the road or not`, () => {
    expect(checkInGeofence(at(0, CHECKIN_STOP_MAX_M - 5), SMB, CHECKIN_STOP_MAX_M).ok).toBe(true);
    expect(checkInGeofence(at(CHECKIN_STOP_MAX_M + 30), SMB, CHECKIN_STOP_MAX_M)).toEqual({ ok: false, reason: 'too_far', distanceM: CHECKIN_STOP_MAX_M + 30 });
  });
});

describe('the check-in ends when the commuter leaves (CA3)', () => {
  const nearCheckIn = startCheckIn('R4', 'SMB', 0, 1, at(400), true);
  const stopCheckIn = startCheckIn('R4', 'SMB', 0, 1, at(100));

  // Feeds the readings in turn and says after which one (1-based) the check-in ended, or null
  const endsAfter = (checkIn: typeof nearCheckIn, places: (Place | null)[]) => {
    let outside = 0;
    for (const [index, place] of places.entries()) {
      const result = checkLeave(outside, checkIn, SMB, place);
      if (result.leave) return index + 1;
      outside = result.outside;
    }
    return null;
  };

  it(`a near check-in stays within ${CHECKIN_LEAVE_M} m of its spot`, () => {
    expect(stayArea(nearCheckIn, SMB)).toEqual({ center: nearCheckIn.point, radiusM: CHECKIN_LEAVE_M });
    expect(endsAfter(nearCheckIn, [at(400 + CHECKIN_LEAVE_M - 10), at(400 - CHECKIN_LEAVE_M + 10)])).toBeNull();
    expect(endsAfter(nearCheckIn, [at(400 + CHECKIN_LEAVE_M + 20), at(400 + CHECKIN_LEAVE_M + 40)])).toBe(CHECKIN_LEAVE_READINGS);
  });

  it(`a stop check-in stays within ${CHECKIN_STOP_MAX_M} m of the stop, wherever it was made`, () => {
    expect(stayArea(stopCheckIn, SMB)).toEqual({ center: SMB, radiusM: CHECKIN_STOP_MAX_M });
    // Walking to the stop and past it a little is fine
    expect(endsAfter(stopCheckIn, [at(0), at(-CHECKIN_STOP_MAX_M + 20)])).toBeNull();
    expect(endsAfter(stopCheckIn, [at(CHECKIN_STOP_MAX_M + 20), at(CHECKIN_STOP_MAX_M + 50)])).toBe(CHECKIN_LEAVE_READINGS);
  });

  it('one jumpy reading outside does not end it', () => {
    expect(endsAfter(nearCheckIn, [at(900), at(400), at(900), at(400)])).toBeNull();
  });

  it('skips readings the gates would refuse, without resetting the count', () => {
    const far = at(900);
    expect(endsAfter(nearCheckIn, [far, at(900, 0, { accuracyM: GPS_ACCURACY_GATE_CHECKIN_M + 1 }), null, at(400, 0, { source: 'pin' }), far])).toBe(5);
    expect(endsAfter(nearCheckIn, [far, at(900, 0, { mocked: true })])).toBeNull();
  });

  it('keeps the near flag and spot through a restart', () => {
    expect(nearCheckIn).toMatchObject({ near: true, point: { lat: at(400).lat, lon: at(400).lon } });
    expect(parseStoredCheckIn(JSON.parse(JSON.stringify(nearCheckIn)))).toEqual(nearCheckIn);
    expect(parseStoredCheckIn(JSON.parse(JSON.stringify(stopCheckIn)))?.near).toBeUndefined();
  });
});
