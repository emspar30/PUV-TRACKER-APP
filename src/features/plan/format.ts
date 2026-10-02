const METERS_PER_KM = 1000;
const WALK_ROUNDING_M = 10;
const KM_DECIMALS = 1;
const PESO_DECIMALS = 2;
const COORDINATE_DECIMALS = 4;

// "120 m", rounded to the nearest 10 m, because a walking distance is an estimate
export function formatWalk(distanceM: number): string {
  if (distanceM < WALK_ROUNDING_M) return 'under 10 m';
  if (distanceM >= METERS_PER_KM) return `${(distanceM / METERS_PER_KM).toFixed(KM_DECIMALS)} km`;
  return `${Math.round(distanceM / WALK_ROUNDING_M) * WALK_ROUNDING_M} m`;
}

export function formatKm(distanceKm: number): string {
  return `${distanceKm.toFixed(KM_DECIMALS)} km`;
}

export function formatPeso(amount: number): string {
  return `₱${amount.toFixed(PESO_DECIMALS)}`;
}

export function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(COORDINATE_DECIMALS)}, ${lon.toFixed(COORDINATE_DECIMALS)}`;
}
