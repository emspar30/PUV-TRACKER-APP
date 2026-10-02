export type LatLon = {
  lat: number;
  lon: number;
};

const EARTH_RADIUS_M = 6371008.8;
const HALF_TURN_DEG = 180;
const DEG_TO_RAD = Math.PI / HALF_TURN_DEG;
const HALF = 0.5;
const DOUBLE = 2;

// Great-circle distance in metres between two coordinates (PRD 12.4, geofence distance)
export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat * HALF);
  const sinLon = Math.sin(dLon * HALF);
  const h = sinLat * sinLat + Math.cos(a.lat * DEG_TO_RAD) * Math.cos(b.lat * DEG_TO_RAD) * sinLon * sinLon;
  return DOUBLE * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
