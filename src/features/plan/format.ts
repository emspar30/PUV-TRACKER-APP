const METERS_PER_KM = 1000;
const WALK_ROUNDING_M = 10;
const MONEY_DECIMALS = 2;
const KM_DECIMALS = 2;
const PERCENT = 100;

export function formatPeso(amount: number): string {
  return `₱${amount.toFixed(MONEY_DECIMALS)}`;
}

export function formatKm(km: number): string {
  return `${km.toFixed(KM_DECIMALS)} km`;
}

// Walking distances to the nearest 10 m; longer ones in km
export function formatWalk(meters: number): string {
  const rounded = Math.round(meters / WALK_ROUNDING_M) * WALK_ROUNDING_M;
  return rounded >= METERS_PER_KM ? formatKm(rounded / METERS_PER_KM) : `${rounded} m`;
}

export function formatMeters(meters: number): string {
  return `${meters} m`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * PERCENT)}%`;
}
