// CA3 (Emjay, 2026-10-30): a check-in ends by itself when the commuter leaves. At a stop: farther
// than CHECKIN_STOP_MAX_M from the stop (the range they checked in from). Near the route: farther
// than CHECKIN_LEAVE_M from where they checked in. It takes CHECKIN_LEAVE_READINGS readings outside
// in a row, so one jumpy GPS reading does not end it; a reading the check-in gates would refuse
// (no position, a pin, mocked, inaccurate, stale) neither counts nor resets. Pure: positions are passed in.

import { CHECKIN_LEAVE_M, CHECKIN_LEAVE_READINGS, CHECKIN_STOP_MAX_M, GPS_ACCURACY_GATE_CHECKIN_M } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { acceptFix } from '../location/accuracyGate';
import type { Place } from './geofence';

export type LeaveCheck = {
  // Readings outside in a row so far
  outside: number;
  leave: boolean;
};

// The circle the commuter must stay in: around the near check-in's point, else around the stop
export function stayArea(checkIn: { near?: boolean; point?: LatLon }, stop: LatLon): { center: LatLon; radiusM: number } {
  return checkIn.near && checkIn.point ? { center: checkIn.point, radiusM: CHECKIN_LEAVE_M } : { center: stop, radiusM: CHECKIN_STOP_MAX_M };
}

export function checkLeave(outside: number, checkIn: { near?: boolean; point?: LatLon }, stop: LatLon, place: Place | null): LeaveCheck {
  if (!place || place.source === 'pin') return { outside, leave: false };
  if (place.source === 'gps') {
    const quality = { accuracyM: place.accuracyM, mocked: place.mocked ?? false, ageS: place.ageS === undefined ? 0 : place.ageS };
    if (!acceptFix(quality, GPS_ACCURACY_GATE_CHECKIN_M).ok) return { outside, leave: false };
  }
  const area = stayArea(checkIn, stop);
  const next = haversineMeters(place, area.center) > area.radiusM ? outside + 1 : 0;
  return { outside: next, leave: next >= CHECKIN_LEAVE_READINGS };
}
