// S10 (PRD 0.2 S10, 3.3, 17.1): the field test log. While recording is on, the app notes what the field
// experiments measure: relays and their length, battery while relaying (E4), bytes sent (E6), gaps
// when the phone stopped Tunton in the background (E5), Bluetooth signal readings (E1, E2), verification
// results and their time (V1a, E9), baton roles (BT1), the delay from a position's measurement to this
// phone's map (N1), and the tracked multicab's predicted ETA against its arrival (ETA accuracy).
// summarize() gives the per-hour figures the targets in PRD 3.3 use; toCsv() is what the Export button
// shares. Pure.

import { FIELD_DELAY_TARGET_S } from '../config';

const MS_PER_S = 1000;
const MS_PER_H = 3_600_000;
const BYTES_PER_KB = 1024;
const PERCENT = 100;
const HALF = 0.5;
const EVEN = 2;
// A battery drop needs a first and a last reading
const MIN_READINGS = 2;
const P90 = 0.9;

export type FieldEventKind =
  | 'relay_start'
  | 'relay_end'
  | 'battery'
  | 'sent'
  | 'gap'
  | 'rssi'
  | 'verified'
  | 'not_verified'
  | 'primary'
  | 'secondary'
  | 'delay'
  | 'track_start'
  | 'eta'
  | 'arrived';

// value: battery %, bytes, gap minutes, RSSI dBm, seconds to the verification result, delay ms, or
// predicted ETA seconds
export type FieldEvent = { atMs: number; kind: FieldEventKind; value?: number; note?: string };

export type FieldSummary = {
  relays: number;
  relayHours: number;
  batteryPctPerHour: number | null;
  kbPerHour: number | null;
  gaps: number;
  rssi: { count: number; median: number; min: number; max: number } | null;
  verifyPassRate: number | null;
  medianVerifyS: number | null;
  handoffs: number;
  // N1: from the position's measurement to this phone's map, in seconds; underTargetPct is the share
  // under FIELD_DELAY_TARGET_S
  delay: { count: number; medianS: number; p90S: number; underTargetPct: number } | null;
  // Predicted arrival minus the actual arrival, in seconds: positive means it came earlier than shown
  eta: { count: number; medianAbsErrorS: number; medianErrorS: number } | null;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length * HALF);
  return sorted.length % EVEN === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) * HALF;
};

// The relays' time spans: each start to its end (or to the last event when it has none)
function relaySpans(events: readonly FieldEvent[]): { fromMs: number; toMs: number }[] {
  const spans: { fromMs: number; toMs: number }[] = [];
  let open: number | null = null;
  const lastMs = events.length > 0 ? events[events.length - 1].atMs : 0;
  for (const event of events) {
    if (event.kind === 'relay_start') {
      if (open !== null) spans.push({ fromMs: open, toMs: event.atMs });
      open = event.atMs;
    } else if (event.kind === 'relay_end' && open !== null) {
      spans.push({ fromMs: open, toMs: event.atMs });
      open = null;
    }
  }
  if (open !== null) spans.push({ fromMs: open, toMs: lastMs });
  return spans;
}

// The value at fraction q of the sorted values (nearest rank)
const quantile = (values: number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
};

// Each ETA shown while tracking, paired with the arrival that ended that tracking session. ETAs of a
// session that ended without an arrival (stopped, timed out) are dropped at the next track_start.
function etaErrorsS(events: readonly FieldEvent[]): number[] {
  const errors: number[] = [];
  let pending: FieldEvent[] = [];
  for (const event of events) {
    if (event.kind === 'track_start') pending = [];
    else if (event.kind === 'eta' && typeof event.value === 'number') pending.push(event);
    else if (event.kind === 'arrived') {
      for (const eta of pending) errors.push((eta.atMs + (eta.value as number) * MS_PER_S - event.atMs) / MS_PER_S);
      pending = [];
    }
  }
  return errors;
}

const inSpans = (atMs: number, spans: readonly { fromMs: number; toMs: number }[]) => spans.some((span) => atMs >= span.fromMs && atMs <= span.toMs);

export function summarize(unsorted: readonly FieldEvent[]): FieldSummary {
  const events = [...unsorted].sort((a, b) => a.atMs - b.atMs);
  const spans = relaySpans(events);
  const relayMs = spans.reduce((sum, span) => sum + (span.toMs - span.fromMs), 0);
  const relayHours = relayMs / MS_PER_H;
  const valuesOf = (kind: FieldEventKind, during = false) =>
    events.filter((event) => event.kind === kind && typeof event.value === 'number' && (!during || inSpans(event.atMs, spans))).map((event) => event.value as number);

  // Battery: the drop within each relay, over the time between its first and last reading
  let dropPct = 0;
  let measuredMs = 0;
  for (const span of spans) {
    const readings = events.filter((event) => event.kind === 'battery' && typeof event.value === 'number' && event.atMs >= span.fromMs && event.atMs <= span.toMs);
    if (readings.length < MIN_READINGS) continue;
    dropPct += Math.max(0, (readings[0].value as number) - (readings[readings.length - 1].value as number));
    measuredMs += readings[readings.length - 1].atMs - readings[0].atMs;
  }
  const bytes = valuesOf('sent', true).reduce((sum, value) => sum + value, 0);
  const rssi = valuesOf('rssi');
  const passed = events.filter((event) => event.kind === 'verified').length;
  const failed = events.filter((event) => event.kind === 'not_verified').length;
  const verifyTimes = valuesOf('verified');
  let handoffs = 0;
  let lastRole: FieldEventKind | null = null;
  for (const event of events) {
    if (event.kind !== 'primary' && event.kind !== 'secondary') continue;
    if (lastRole === 'secondary' && event.kind === 'primary') handoffs += 1;
    lastRole = event.kind;
  }
  const delaysS = valuesOf('delay').map((ms) => ms / MS_PER_S);
  const etaErrors = etaErrorsS(events);

  return {
    relays: spans.length,
    relayHours,
    batteryPctPerHour: measuredMs > 0 ? dropPct / (measuredMs / MS_PER_H) : null,
    kbPerHour: relayHours > 0 ? bytes / BYTES_PER_KB / relayHours : null,
    gaps: events.filter((event) => event.kind === 'gap').length,
    rssi: rssi.length > 0 ? { count: rssi.length, median: median(rssi), min: Math.min(...rssi), max: Math.max(...rssi) } : null,
    verifyPassRate: passed + failed > 0 ? (PERCENT * passed) / (passed + failed) : null,
    medianVerifyS: verifyTimes.length > 0 ? median(verifyTimes) : null,
    handoffs,
    delay:
      delaysS.length > 0
        ? {
            count: delaysS.length,
            medianS: median(delaysS),
            p90S: quantile(delaysS, P90),
            underTargetPct: (PERCENT * delaysS.filter((value) => value < FIELD_DELAY_TARGET_S).length) / delaysS.length,
          }
        : null,
    eta: etaErrors.length > 0 ? { count: etaErrors.length, medianAbsErrorS: median(etaErrors.map(Math.abs)), medianErrorS: median(etaErrors) } : null,
  };
}

const csvCell = (text: string) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

// One line per event: ISO time, kind, value, note
export function toCsv(events: readonly FieldEvent[]): string {
  const rows = [...events]
    .sort((a, b) => a.atMs - b.atMs)
    .map((event) => [new Date(event.atMs).toISOString(), event.kind, event.value === undefined ? '' : String(event.value), csvCell(event.note ?? '')].join(','));
  return ['time,kind,value,note', ...rows].join('\n');
}

export const secondsBetween = (fromMs: number, toMs: number) => Math.round((toMs - fromMs) / MS_PER_S);
