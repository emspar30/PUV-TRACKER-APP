import * as os from 'node:os';

import { ROUTING_P95_BUDGET_MS } from '../config';
import { benchmarkPlanner } from '../routing/benchmark';
import type { DirectedLine } from '../routing/types';

import { FIXTURE_OUTBOUND, FIXTURE_RETURN, KM_PER_DEG_LAT, KM_PER_DEG_LON } from './fixtures/routeFixture';

const RUNS = 1000;

// A winding line with many points, closer to a traced real route than the 4-point fixture
function denseLines(points: number): DirectedLine[] {
  const coordinates = Array.from({ length: points }, (_, i) => {
    const eastKm = (i / (points - 1)) * 12;
    const northKm = 0.15 * Math.sin(i / 6);
    return [125.5 + eastKm / KM_PER_DEG_LON, 9.0 + northKm / KM_PER_DEG_LAT];
  });
  const outbound: DirectedLine = { ...FIXTURE_OUTBOUND, id: 'B1-OUT', coordinates };
  return [outbound, { ...outbound, id: 'B1-RET', direction: 'return', coordinates: [...coordinates].reverse() }];
}

describe('routing benchmark p95', () => {
  it.each([
    ['4-point line', () => [FIXTURE_OUTBOUND, FIXTURE_RETURN]],
    ['400-point line', () => denseLines(400)],
    ['2000-point line', () => denseLines(2000)],
  ])('plan plus fare on a %s is inside the budget', (label, build) => {
    const lines = build();
    const now = () => performance.now();
    // Warm up, so the first-call cost of loading code is not counted
    benchmarkPlanner(lines, RUNS, now);
    const result = benchmarkPlanner(lines, RUNS, now);

    console.log(
      `[routing benchmark] ${label}: p50 ${result.p50Ms.toFixed(3)} ms, p95 ${result.p95Ms.toFixed(3)} ms, ` +
        `max ${result.maxMs.toFixed(3)} ms over ${RUNS} trips, ${result.found} found (budget ${ROUTING_P95_BUDGET_MS} ms). ` +
        `Machine: ${os.cpus()[0]?.model.trim()}, ${os.cpus().length} threads, ` +
        `${Math.round(os.totalmem() / 1024 ** 3)} GB RAM, Node ${process.version}, ${os.platform()}. ` +
        'This is the development PC, not a phone.',
    );
    expect(result.runs).toBe(RUNS);
    expect(result.found).toBeGreaterThan(0);
    expect(result.p95Ms).toBeLessThanOrEqual(ROUTING_P95_BUDGET_MS);
  });

  it('measures the same trips every time', () => {
    const lines = [FIXTURE_OUTBOUND, FIXTURE_RETURN];
    const now = () => performance.now();
    expect(benchmarkPlanner(lines, 200, now).found).toBe(benchmarkPlanner(lines, 200, now).found);
  });
});
