// Where the commuter may check in and when a report counts as "with GPS" (C1, RP1; PRD 7.5 and 19).
// The server does not see coordinates: the phone decides, and the result is unverified until
// Bluetooth boarding (D5). Pure: positions are passed in.

import { CHECKIN_RADIUS_M, GPS_ACCURACY_GATE_CHECKIN_M, GPS_ACCURACY_GATE_RELAY_M } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { acceptFix } from '../location/accuracyGate';

// gps: the phone's fix; simulated: a stop picked in Demo & simulation (trusted, no accuracy);
// pin: a point set by hand, which is not a position. A GPS fix also carries its mock flag and age
// (G0): a mock or stale fix fails the gates.
export type Place = LatLon & {
  source: 'gps' | 'simulated' | 'pin';
  accuracyM: number | null;
  mocked?: boolean;
  ageS?: number | null;
};

export type GeofenceResult =
  | { ok: true; distanceM: number }
  | { ok: false; reason: 'no_position' | 'inaccurate' | 'mocked' | 'stale' }
  | { ok: false; reason: 'too_far'; distanceM: number };

// Check-in needs a real or simulated position within the station's radius, and a GPS fix of
// GPS_ACCURACY_GATE_CHECKIN_M or better that is neither mocked nor stale
export function checkInGeofence(place: Place | null, station: LatLon, radiusM = CHECKIN_RADIUS_M): GeofenceResult {
  if (!place || place.source === 'pin') return { ok: false, reason: 'no_position' };
  if (place.source === 'gps') {
    const gate = acceptFix(gpsQuality(place), GPS_ACCURACY_GATE_CHECKIN_M);
    if (!gate.ok) return { ok: false, reason: gate.reason === 'poor_accuracy' ? 'inaccurate' : gate.reason };
  }
  const distanceM = Math.round(haversineMeters(place, station));
  return distanceM <= radiusM ? { ok: true, distanceM } : { ok: false, reason: 'too_far', distanceM };
}

// A report may go "with GPS" (+1.0 Energy instead of +0.5) when the phone has a good fix
// (GPS_ACCURACY_GATE_RELAY_M, not mocked or stale) or a simulated position
export function canReportWithGps(place: Place | null): boolean {
  if (!place || place.source === 'pin') return false;
  return place.source === 'simulated' || acceptFix(gpsQuality(place), GPS_ACCURACY_GATE_RELAY_M).ok;
}

// A place without a mock flag or age is taken as a fresh, real fix (the caller did not know them)
function gpsQuality(place: Place) {
  return { accuracyM: place.accuracyM, mocked: place.mocked ?? false, ageS: place.ageS === undefined ? 0 : place.ageS };
}
