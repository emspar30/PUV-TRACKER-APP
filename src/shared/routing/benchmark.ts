import { discountMultiplier } from '../fare/fare';
import { boundsOfLines } from '../geo/bounds';

import { fareForItinerary, planTrip } from './plan';
import type { DirectedLine } from './types';

// Linear congruential generator constants (Numerical Recipes), so every run measures the same trips
const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const LCG_MODULUS = 4294967296;
const DEFAULT_SEED = 42;
const MEDIAN = 0.5;
const P95 = 0.95;

export type BenchmarkResult = {
  runs: number;
  found: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

// Times "plan a trip and compute its fare" for many pseudo-random origin and destination pairs
// spread over the area the lines cover. Used by the unit benchmark and by the on-device benchmark,
// so both measure exactly the same work (PRD 3.3: 250 ms or less at the 95th percentile).
export function benchmarkPlanner(lines: DirectedLine[], runs: number, now: () => number): BenchmarkResult {
  const [west, south, east, north] = boundsOfLines(lines.map((line) => line.coordinates));
  let state = DEFAULT_SEED;
  const random = () => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return state / LCG_MODULUS;
  };
  const point = () => ({ lon: west + random() * (east - west), lat: south + random() * (north - south) });
  const multiplier = discountMultiplier('student');

  const durations: number[] = [];
  let found = 0;
  for (let i = 0; i < runs; i += 1) {
    const origin = point();
    const destination = point();
    const start = now();
    const result = planTrip(lines, origin, destination);
    if (result.ok) {
      fareForItinerary(lines, result.itinerary, multiplier);
      found += 1;
    }
    durations.push(now() - start);
  }

  durations.sort((a, b) => a - b);
  const at = (fraction: number) => durations[Math.min(runs - 1, Math.floor(runs * fraction))];
  return { runs, found, p50Ms: at(MEDIAN), p95Ms: at(P95), maxMs: durations[runs - 1] };
}
