import { ageMinutes, displayCount, freshness, heatmapBand, type Freshness, type HeatmapState, type StopDisplay } from './heatmap';

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

export type BusiestStop = { code: string; name: string; band: number; exact: number | null };

// Owner, 2026-10-14: the stop with the most passengers waiting, named over the list so it stands out
// without reordering it (the list stays in riding order). By exact count, or by band where only bands
// are shown (Q11); the first in riding order wins a tie. Null when no stop has anyone waiting.
// Emjay, 2026-11-16: those checked in near a stop count for it too, so a stop with only "Near 1" is
// named over the list. At night only the bands are known, so the stop's band is the higher of the
// at-stop band and the near band.
export function busiestStop(rows: readonly HeatmapRow[]): BusiestStop | null {
  let best: BusiestStop | null = null;
  for (const row of rows) {
    if (row.display.kind !== 'known') continue;
    const { near } = row.display;
    const exact = row.display.exact !== null ? row.display.exact + near : null;
    const band = exact !== null ? heatmapBand(exact) : Math.max(row.display.band, heatmapBand(near));
    if (band === 0) continue;
    const beats = !best || band > best.band || (band === best.band && exact !== null && best.exact !== null && exact > best.exact);
    if (beats) best = { code: row.code, name: row.name, band, exact };
  }
  return best;
}
