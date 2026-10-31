import { haversineMeters, type LatLon } from '../geo/haversine';
import { isFillStopCode } from '../routing/fillStops';
import { ageMinutes, displayCount, freshness, type Freshness, type HeatmapState, type StopDisplay } from './heatmap';

// What the driver's home screen shows (PRD 9.4; DR5), worked out here so the rules are tested in
// plain Node: the stops in riding order, each unknown (never sent since setup) or known with its
// band and, where allowed, the exact count; how fresh the whole heatmap is. A stale heatmap keeps
// its last values but is drawn grey, with its age. The screen never says "no one is waiting" when
// the truth is "no update" (PRD 2.3).

export type HeatmapStop = { code: string; name: string };

export type HeatmapRow = HeatmapStop & { display: StopDisplay };

export type HeatmapView<S extends HeatmapStop = HeatmapStop> = {
  freshness: Freshness;
  // Minutes since the last valid message, or null before the first
  ageMin: number | null;
  rows: (S & { display: StopDisplay })[];
  // True when no row shows an exact count (Q5, Q11): the list then says the counts are bands
  bandsOnly: boolean;
};

export function heatmapView<S extends HeatmapStop>(state: HeatmapState | null, stops: readonly S[], nowMs: number): HeatmapView<S> {
  const rows = stops.map((stop) => ({ ...stop, display: state ? displayCount(state, stop.code, nowMs) : ({ kind: 'unknown' } as const) }));
  const known = rows.filter((row) => row.display.kind === 'known');
  return {
    freshness: state ? freshness(state, nowMs) : 'never',
    ageMin: state ? ageMinutes(state, nowMs) : null,
    rows,
    bandsOnly: known.length > 0 && known.every((row) => row.display.kind === 'known' && row.display.exact === null),
  };
}

// Owner, 2026-10-31 (docs/superpowers/specs/2026-10-31-driver-near-subrows-design.md): the list
// keeps the real stops; a fill stop (CA2-0) shows under one only while someone is waiting there. It
// goes under the nearer of the two real stops it lies between in riding order (a tie: the earlier),
// never the nearest over the whole route, which on a loop can be the last stop. A route with no real
// stop lists its fill stops as plain rows.
export type HeatmapGroup<R extends HeatmapRow = HeatmapRow> = { stop: R; near: R[] };

const someoneWaiting = (display: StopDisplay) => display.kind === 'known' && display.band > 0;

export function groupRows<R extends HeatmapRow & LatLon>(rows: readonly R[]): HeatmapGroup<R>[] {
  const real = rows.filter((row) => !isFillStopCode(row.code));
  if (real.length === 0) return rows.map((stop) => ({ stop, near: [] }));
  const groups = real.map((stop) => ({ stop, near: [] as R[] }));
  let next = 0;
  for (const row of rows) {
    if (!isFillStopCode(row.code)) {
      next += 1;
      continue;
    }
    if (!someoneWaiting(row.display)) continue;
    const before = groups[next - 1];
    const after = groups[next];
    const under = !before || (after && haversineMeters(row, after.stop) < haversineMeters(row, before.stop)) ? after : before;
    under.near.push(row);
  }
  return groups;
}

export type BusiestStop = { code: string; name: string; band: number; exact: number | null };

// Owner, 2026-10-14: the stop with the most passengers waiting, named over the list so it stands out
// without reordering it (the list stays in riding order). By exact count, or by band where only bands
// are shown (Q11); the first in riding order wins a tie. Null when no stop has anyone waiting.
export function busiestStop(rows: readonly HeatmapRow[]): BusiestStop | null {
  let best: BusiestStop | null = null;
  for (const row of rows) {
    if (row.display.kind !== 'known' || row.display.band === 0) continue;
    const { band, exact } = row.display;
    const beats = !best || band > best.band || (band === best.band && exact !== null && best.exact !== null && exact > best.exact);
    if (beats) best = { code: row.code, name: row.name, band, exact };
  }
  return best;
}
