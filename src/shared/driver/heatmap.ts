import { DRIVER_NIGHT_BANDS_ONLY, DRIVER_SHOW_EXACT_COUNTS, HEATMAP_BAND_EDGES, SMS_STALE_HEATMAP_MIN } from '../config';
import { isNight } from '../backend/rules';
import type { HeatmapMessage } from '../sms/protocol';

// What the driver phone knows about waiting commuters on its route (PRD 9.3, 9.4; DR5). Built only
// from validated heatmap messages: a message lists stops and counts, and listed stops update while
// the others keep their value (a long route arrives in more than one message). A stop never listed
// since the phone was set up is unknown, never "0". After SMS_STALE_HEATMAP_MIN with no valid
// message the whole heatmap is stale (greyed, with its age).

const MS_PER_MIN = 60_000;

export type HeatmapState = {
  route: string;
  counts: Readonly<Record<string, number>>;
  // Sequence number of the last accepted message (validateHeatmap's lastSeq)
  lastSeq: number | null;
  lastAcceptedMs: number | null;
};

// The band index, 0 to HEATMAP_BAND_EDGES.length: 0 nobody, 1 for 1 to 4, 2 for 5 to 9, 3 for 10 or more
export type HeatmapBand = number;

export type Freshness = 'never' | 'fresh' | 'stale';

export type StopDisplay =
  | { kind: 'unknown' }
  | {
      kind: 'known';
      band: HeatmapBand;
      // The number for the list, or null where only the band may be shown (Q5, Q11)
      exact: number | null;
    };

export function emptyHeatmap(route: string): HeatmapState {
  return { route, counts: {}, lastSeq: null, lastAcceptedMs: null };
}

// Apply a message that validateHeatmap accepted. A message for another route changes nothing.
export function applyMessage(state: HeatmapState, message: HeatmapMessage, receivedAtMs: number): HeatmapState {
  if (message.route !== state.route) return state;
  const counts = { ...state.counts };
  for (const { code, count } of message.nodes) counts[code] = count;
  return { ...state, counts, lastSeq: message.seq, lastAcceptedMs: receivedAtMs };
}

export function heatmapBand(count: number): HeatmapBand {
  let band = 0;
  for (const edge of HEATMAP_BAND_EDGES) if (count >= edge) band += 1;
  return band;
}

export function freshness(state: HeatmapState, nowMs: number): Freshness {
  if (state.lastAcceptedMs === null) return 'never';
  return nowMs - state.lastAcceptedMs >= SMS_STALE_HEATMAP_MIN * MS_PER_MIN ? 'stale' : 'fresh';
}

// Minutes since the last valid message, for "Updated 3 min ago" and "No update for 17 min"
export function ageMinutes(state: HeatmapState, nowMs: number): number | null {
  return state.lastAcceptedMs === null ? null : Math.floor((nowMs - state.lastAcceptedMs) / MS_PER_MIN);
}

export function displayCount(state: HeatmapState, code: string, nowMs: number): StopDisplay {
  const count = state.counts[code];
  if (count === undefined) return { kind: 'unknown' };
  const bandsOnly = !DRIVER_SHOW_EXACT_COUNTS || (DRIVER_NIGHT_BANDS_ONLY && isNight(nowMs));
  return { kind: 'known', band: heatmapBand(count), exact: bandsOnly ? null : count };
}
