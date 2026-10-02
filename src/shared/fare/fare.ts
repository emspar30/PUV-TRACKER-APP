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

// Every step of the fare, so the screen can show how the amount was reached
export type FareBreakdown = {
  // Covers the first `baseKm` kilometres
  baseFare: number;
  baseKm: number;
  // Whole kilometres charged beyond the base distance (a started kilometre counts as one)
  extraKm: number;
  perKmRate: number;
  extraCost: number;
  multiplier: number;
  // Amount taken off by the discount, before rounding
  discount: number;
  // Null when rounding is switched off
  roundingStep: number | null;
  // rounded minus unrounded: negative when the fare was rounded down
  roundingAdjustment: number;
};

export type FareResult = {
  // Fare before the discount multiplier
  gross: number;
  // gross x multiplier, before rounding
  unrounded: number;
  // Amount shown to the rider, after the configured rounding
  rounded: number;
  breakdown: FareBreakdown;
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
  const beyondBaseKm = Math.round((distanceKm - params.baseKm) * precision) / precision;
  const extraKm = Math.max(0, Math.ceil(beyondBaseKm));

  const extraCostCentavos = extraKm * toCentavos(params.perKmRate);
  const grossCentavos = toCentavos(params.baseFare) + extraCostCentavos;
  const unroundedCentavos = Math.round(grossCentavos * multiplier);

  const stepCentavos = roundingStep ? toCentavos(roundingStep) : 0;
  const roundedCentavos =
    stepCentavos > 0 ? Math.round(unroundedCentavos / stepCentavos) * stepCentavos : unroundedCentavos;

  return {
    gross: toPesos(grossCentavos),
    unrounded: toPesos(unroundedCentavos),
    rounded: toPesos(roundedCentavos),
    breakdown: {
      baseFare: params.baseFare,
      baseKm: params.baseKm,
      extraKm,
      perKmRate: params.perKmRate,
      extraCost: toPesos(extraCostCentavos),
      multiplier,
      discount: toPesos(grossCentavos - unroundedCentavos),
      roundingStep: stepCentavos > 0 ? roundingStep : null,
      roundingAdjustment: toPesos(roundedCentavos - unroundedCentavos),
    },
  };
}

function toCentavos(pesos: number): number {
  return Math.round(pesos * CENTAVOS_PER_PESO);
}

function toPesos(centavos: number): number {
  return centavos / CENTAVOS_PER_PESO;
}
