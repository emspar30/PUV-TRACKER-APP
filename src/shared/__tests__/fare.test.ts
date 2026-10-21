import { FARE_BASE_KM, FARE_BASE_PHP, FARE_DISCOUNT_MULTIPLIER, FARE_PER_KM_PHP } from '../config';
import { computeFare, discountMultiplier, type FareParams } from '../fare/fare';

// The PRD's S1 acceptance vectors (0.2) were written for ₱15.00 for 4 km and ₱2.00 a km; they test
// the formula with those parameters. The app's current defaults are tested below them.
const PARAMS: FareParams = { baseFare: 15, baseKm: 4, perKmRate: 2 };
const CURRENT: FareParams = { baseFare: FARE_BASE_PHP, baseKm: FARE_BASE_KM, perKmRate: FARE_PER_KM_PHP };
const REGULAR = discountMultiplier('regular');

describe('fare, the current Butuan default (traditional jeepney rate, Emjay 2026-10-22)', () => {
  it('is ₱14.00 for the first 4 km and ₱2.00 a km after', () => {
    expect(CURRENT).toEqual({ baseFare: 14, baseKm: 4, perKmRate: 2 });
  });

  it.each([
    [1.2, 14.0],
    [4.0, 14.0],
    [4.1, 16.0],
    [6.3, 20.0],
    [10.0, 26.0],
  ])('%p km gives %p', (km, expected) => {
    expect(computeFare(km, CURRENT, REGULAR).rounded).toBe(expected);
  });

  it('6.3 km discounted gives 16.00', () => {
    expect(computeFare(6.3, CURRENT, FARE_DISCOUNT_MULTIPLIER).rounded).toBe(16);
  });
});

describe('fare, regular', () => {
  it.each([
    [4.0, 15.0],
    [4.1, 17.0],
    [6.3, 21.0],
    [10.0, 27.0],
  ])('%p km gives %p', (km, expected) => {
    const fare = computeFare(km, PARAMS, REGULAR);
    expect(fare.gross).toBe(expected);
    expect(fare.unrounded).toBe(expected);
    expect(fare.rounded).toBe(expected);
  });

  it('charges the base fare below the base distance', () => {
    expect(computeFare(0, PARAMS, REGULAR).rounded).toBe(15.0);
    expect(computeFare(1.2, PARAMS, REGULAR).rounded).toBe(15.0);
  });

  it('does not add a kilometre for floating-point noise', () => {
    expect(computeFare(4.0 + 3.0000000000000004, PARAMS, REGULAR).gross).toBe(21.0);
  });

  it('rejects a negative or non-numeric distance', () => {
    expect(() => computeFare(-1, PARAMS, REGULAR)).toThrow(RangeError);
    expect(() => computeFare(Number.NaN, PARAMS, REGULAR)).toThrow(RangeError);
  });
});

describe('fare, discounted (multiplier 0.8)', () => {
  it('6.3 km gives 16.80 before rounding', () => {
    expect(computeFare(6.3, PARAMS, FARE_DISCOUNT_MULTIPLIER, null).unrounded).toBe(16.8);
    expect(computeFare(6.3, PARAMS, FARE_DISCOUNT_MULTIPLIER, null).rounded).toBe(16.8);
  });

  it('6.3 km gives 16.75 with the default rounding to the nearest 0.25', () => {
    const fare = computeFare(6.3, PARAMS, FARE_DISCOUNT_MULTIPLIER);
    expect(fare.unrounded).toBe(16.8);
    expect(fare.rounded).toBe(16.75);
  });
});

describe('fare rounding is a config setting', () => {
  it('follows the rounding step it is given', () => {
    expect(computeFare(6.3, PARAMS, FARE_DISCOUNT_MULTIPLIER, 1).rounded).toBe(17);
    expect(computeFare(6.3, PARAMS, FARE_DISCOUNT_MULTIPLIER, 0.5).rounded).toBe(17);
    expect(computeFare(6.3, PARAMS, FARE_DISCOUNT_MULTIPLIER, 0.05).rounded).toBe(16.8);
  });
});

describe('fare uses route parameters', () => {
  it('follows the formula for a different base fare, base distance and rate', () => {
    const other: FareParams = { baseFare: 13, baseKm: 5, perKmRate: 1.8 };
    // 13 + ceil(7.2 - 5) x 1.8 = 13 + 3 x 1.8 = 18.40
    expect(computeFare(7.2, other, REGULAR, null).rounded).toBe(18.4);
    expect(computeFare(5, other, REGULAR, null).rounded).toBe(13);
  });
});

describe('discount multiplier', () => {
  it('applies only to Student, Senior Citizen and PWD', () => {
    expect(discountMultiplier('regular')).toBe(1);
    expect(discountMultiplier('student')).toBe(0.8);
    expect(discountMultiplier('senior')).toBe(0.8);
    expect(discountMultiplier('pwd')).toBe(0.8);
  });
});
