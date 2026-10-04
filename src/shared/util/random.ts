// A small seeded random number generator (mulberry32), so demo data is the same for the same seed.
// Not for anything secret.

const UINT32 = 4294967296;
const MIX_1 = 0x6d2b79f5;
const SHIFT_A = 15;
const SHIFT_B = 7;
const SHIFT_C = 14;
const OR_A = 1;
const OR_B = 61;

export type Random = {
  // A number from 0 (included) to 1 (excluded)
  next(): number;
  // A whole number from min to max, both included
  int(min: number, max: number): number;
  // A number from min to max
  between(min: number, max: number): number;
};

export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + MIX_1) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> SHIFT_A), t | OR_A);
    t ^= t + Math.imul(t ^ (t >>> SHIFT_B), t | OR_B);
    return ((t ^ (t >>> SHIFT_C)) >>> 0) / UINT32;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    between: (min, max) => min + next() * (max - min),
  };
}

// A seed for one named part of the demo, so adding a route does not change the others
export function childSeed(seed: number, name: string): number {
  let hash = seed >>> 0;
  for (let i = 0; i < name.length; i += 1) hash = Math.imul(hash ^ name.charCodeAt(i), MIX_1) >>> 0;
  return hash;
}
