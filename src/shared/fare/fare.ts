import {
  FARE_DISCOUNTED_CLASSES,
  FARE_DISCOUNT_MULTIPLIER,
  FARE_DISTANCE_DECIMALS,
  FARE_REGULAR_MULTIPLIER,
  FARE_ROUNDING_STEP_PHP,
  type Classification,
} from '../config';

const CENTAVOS_PER_PESO = 100;
const DECIMAL_BASE = 10;

// Per-route fare parameters, read from the franchise_routes row (PRD 12.1)
export type FareParams = {
  baseFare: number;
  baseKm: number;
  perKmRate: number;
};

export type FareResult = {
  // Fare before the discount multiplier
  gross: number;
  // gross x multiplier, before rounding
  unrounded: number;
  // Amount shown to the rider, after the configured rounding
  rounded: number;
};

export function discountMultiplier(classification: Classification): number {
  return FARE_DISCOUNTED_CLASSES.includes(classification) ? FARE_DISCOUNT_MULTIPLIER : FARE_REGULAR_MULTIPLIER;
}

// PRD 12.4: Fare = (F0 + max(0, ceil(D - D0)) x r) x M.
// Amounts are computed in whole centavos so the result has no floating-point drift.
export function computeFare(
  distanceKm: number,
  params: FareParams,
  multiplier: number,
  roundingStep: number | null = FARE_ROUNDING_STEP_PHP,
): FareResult {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError('distanceKm must be a non-negative number');
  }

  const precision = DECIMAL_BASE ** FARE_DISTANCE_DECIMALS;
  const extraKm = Math.round((distanceKm - params.baseKm) * precision) / precision;
  const chargedKm = Math.max(0, Math.ceil(extraKm));

  const grossCentavos = toCentavos(params.baseFare) + chargedKm * toCentavos(params.perKmRate);
  const unroundedCentavos = Math.round(grossCentavos * multiplier);

  const stepCentavos = roundingStep ? toCentavos(roundingStep) : 0;
  const roundedCentavos =
    stepCentavos > 0 ? Math.round(unroundedCentavos / stepCentavos) * stepCentavos : unroundedCentavos;

  return {
    gross: grossCentavos / CENTAVOS_PER_PESO,
    unrounded: unroundedCentavos / CENTAVOS_PER_PESO,
    rounded: roundedCentavos / CENTAVOS_PER_PESO,
  };
}

function toCentavos(pesos: number): number {
  return Math.round(pesos * CENTAVOS_PER_PESO);
}
