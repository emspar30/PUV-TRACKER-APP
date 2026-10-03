import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';

import { R4_LINES } from '../../data/seed/r4.placeholder';
import { ROUTING_BENCHMARK_PAIRS, ROUTING_P95_BUDGET_MS } from '../config';
import { discountMultiplier } from '../fare/fare';
import { percentile, randomPairsNearLines, runRoutingBenchmark, seededRandom } from '../routing/benchmark';
import type { PlanLine } from '../routing/plan';

const LINES: PlanLine[] = R4_LINES.map((line) => ({
  routeId: line.routeId,
  routeCode: line.routeCode,
  routeName: line.routeName,
  routeColor: line.routeColor,
  coordinates: line.coordinates,
  fare: { baseFare: line.baseFare, baseKm: line.baseKm, perKmRate: line.perKmRate },
}));

describe('routing benchmark p95', () => {
  it(`plans and prices ${ROUTING_BENCHMARK_PAIRS} trips with p95 within the budget`, () => {
    const pairs = randomPairsNearLines(LINES, ROUTING_BENCHMARK_PAIRS, seededRandom(42));
    const result = runRoutingBenchmark(LINES, pairs, discountMultiplier('student'), () => performance.now());

    const machine = `${cpus()[0]?.model ?? 'unknown CPU'}, ${Math.round(totalmem() / 2 ** 30)} GB RAM, Node ${process.version}`;
    // A PC figure is indicative only; the PRD target is for a 3 GB phone (S3-M3)
    console.log(
      `routing benchmark on ${machine}: n=${result.count} p50=${result.p50Ms.toFixed(3)} ms ` +
        `p95=${result.p95Ms.toFixed(3)} ms max=${result.maxMs.toFixed(3)} ms`,
    );

    expect(result.count).toBe(ROUTING_BENCHMARK_PAIRS);
    expect(result.p95Ms).toBeLessThanOrEqual(ROUTING_P95_BUDGET_MS);
  });
});

describe('benchmark helpers', () => {
  it('generates the same pairs from the same seed', () => {
    const a = randomPairsNearLines(LINES, 5, seededRandom(7));
    const b = randomPairsNearLines(LINES, 5, seededRandom(7));
    expect(a).toEqual(b);
  });

  it('computes nearest-rank percentiles', () => {
    const values = [5, 1, 4, 2, 3, 6, 7, 8, 9, 10];
    expect(percentile(values, 50)).toBe(5);
    expect(percentile(values, 95)).toBe(10);
    expect(percentile(values, 10)).toBe(1);
    expect(percentile([], 50)).toBeNaN();
  });
});
