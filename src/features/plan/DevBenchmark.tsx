import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ROUTING_P95_BUDGET_MS } from '@/shared/config';
import { benchmarkPlanner, type BenchmarkResult } from '@/shared/routing/benchmark';
import type { DirectedLine } from '@/shared/routing/types';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

const RUNS = 1000;
const MS_DECIMALS = 3;

// Development builds only: times the trip planner on this device (test S3-M3).
export function DevBenchmark({ lines }: { lines: DirectedLine[] }) {
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  if (!__DEV__) return null;

  const run = () => {
    const now = () => performance.now();
    // One warm-up pass, so the first-call cost of loading code is not counted
    benchmarkPlanner(lines, RUNS, now);
    const measured = benchmarkPlanner(lines, RUNS, now);
    console.log(
      `[bench] p50 ${measured.p50Ms.toFixed(MS_DECIMALS)} ms, p95 ${measured.p95Ms.toFixed(MS_DECIMALS)} ms, ` +
        `max ${measured.maxMs.toFixed(MS_DECIMALS)} ms, ${measured.found} of ${measured.runs} trips found`,
    );
    setResult(measured);
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.button} onPress={run} accessibilityRole="button">
        <Text style={typography.caption}>DEV  Run routing benchmark ({RUNS} trips)</Text>
      </Pressable>
      {result ? (
        <Text style={typography.caption}>
          p50 {result.p50Ms.toFixed(MS_DECIMALS)} ms, p95 {result.p95Ms.toFixed(MS_DECIMALS)} ms, max{' '}
          {result.maxMs.toFixed(MS_DECIMALS)} ms. Budget {ROUTING_P95_BUDGET_MS} ms at p95. {result.found} of {result.runs}{' '}
          trips found.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
});
