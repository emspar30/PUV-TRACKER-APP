import { ageMinutes, displayCount, freshness, type Freshness, type HeatmapState, type StopDisplay } from './heatmap';

// What the driver's home screen shows (PRD 9.4; DR5), worked out here so the rules are tested in
// plain Node: the stops in riding order, each unknown (never sent since setup) or known with its
// band and, where allowed, the exact count; how fresh the whole heatmap is. A stale heatmap keeps
// its last values but is drawn grey, with its age. The screen never says "no one is waiting" when
// the truth is "no update" (PRD 2.3).

export type HeatmapStop = { code: string; name: string };

export type HeatmapRow = HeatmapStop & { display: StopDisplay };

export type HeatmapView = {
  freshness: Freshness;
  // Minutes since the last valid message, or null before the first
  ageMin: number | null;
  rows: HeatmapRow[];
  // True when no row shows an exact count (Q5, Q11): the list then says the counts are bands
  bandsOnly: boolean;
};

export function heatmapView(state: HeatmapState | null, stops: readonly HeatmapStop[], nowMs: number): HeatmapView {
  const rows = stops.map((stop) => ({ ...stop, display: state ? displayCount(state, stop.code, nowMs) : ({ kind: 'unknown' } as const) }));
  const known = rows.filter((row) => row.display.kind === 'known');
  return {
    freshness: state ? freshness(state, nowMs) : 'never',
    ageMin: state ? ageMinutes(state, nowMs) : null,
    rows,
    bandsOnly: known.length > 0 && known.every((row) => row.display.kind === 'known' && row.display.exact === null),
  };
}
