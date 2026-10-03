// Shared by the Node benchmark test and the in-app development benchmark (S3-M3),
// so both time exactly the same work.

import { ROUTING_BENCHMARK_SPREAD_M } from '../config';
import type { LatLon } from '../geo/haversine';
import { pointAtChainage, lineLengthKm } from '../geo/line';
import { planTrip, type PlanLine } from './plan';

const METERS_PER_DEGREE_LAT = 111320;
const HALF_TURN_DEG = 180;
const DEG_TO_RAD = Math.PI / HALF_TURN_DEG;
const HALF = 0.5;
const UINT32_RANGE = 4294967296;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_SHIFT_A = 15;
const MULBERRY_SHIFT_B = 7;
const MULBERRY_SHIFT_C = 14;
const MULBERRY_OR_B = 61;
const PERCENT = 100;
const P50 = 50;
const P95 = 95;

// Small deterministic random number generator (mulberry32), so runs are repeatable
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + MULBERRY_INCREMENT) | 0;
    let t = Math.imul(state ^ (state >>> MULBERRY_SHIFT_A), 1 | state);
    t = (t + Math.imul(t ^ (t >>> MULBERRY_SHIFT_B), MULBERRY_OR_B | t)) ^ t;
    return ((t ^ (t >>> MULBERRY_SHIFT_C)) >>> 0) / UINT32_RANGE;
  };
}

function jitter(p: LatLon, spreadM: number, random: () => number): LatLon {
  const dLat = ((random() - HALF) * spreadM) / METERS_PER_DEGREE_LAT;
  const dLon = ((random() - HALF) * spreadM) / (METERS_PER_DEGREE_LAT * Math.cos(p.lat * DEG_TO_RAD));
  return { lat: p.lat + dLat, lon: p.lon + dLon };
}

// Random origin and destination pairs scattered around the lines
export function randomPairsNearLines(
  lines: PlanLine[],
  count: number,
  random: () => number,
  spreadM: number = ROUTING_BENCHMARK_SPREAD_M,
): [LatLon, LatLon][] {
  const pairs: [LatLon, LatLon][] = [];
  for (let i = 0; i < count; i++) {
    const line = lines[Math.floor(random() * lines.length)];
    const length = lineLengthKm(line.coordinates);
    const a = pointAtChainage(line.coordinates, random() * length);
    const b = pointAtChainage(line.coordinates, random() * length);
    pairs.push([jitter(a, spreadM, random), jitter(b, spreadM, random)]);
  }
  return pairs;
}

// Nearest-rank percentile of a list of numbers, p from 0 to 100
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / PERCENT) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export type BenchmarkResult = {
  count: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

// Times plan plus fare for each pair. `now` returns milliseconds (performance.now on both runtimes).
export function runRoutingBenchmark(
  lines: PlanLine[],
  pairs: [LatLon, LatLon][],
  multiplier: number,
  now: () => number,
): BenchmarkResult {
  const times = pairs.map(([origin, destination]) => {
    const start = now();
    planTrip(origin, destination, lines, multiplier);
    return now() - start;
  });
  return {
    count: times.length,
    p50Ms: percentile(times, P50),
    p95Ms: percentile(times, P95),
    maxMs: Math.max(...times),
  };
}
