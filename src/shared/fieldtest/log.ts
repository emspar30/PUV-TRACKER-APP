// S10 (PRD 0.2 S10, 3.3, 17.1): the field test log. While recording is on, the app notes what the field
// experiments measure: relays and their length, battery while relaying (E4), bytes sent (E6), gaps
// when the phone stopped Tunton in the background (E5), Bluetooth signal readings (E1, E2), verification
// results and their time (V1a, E9), and baton roles (BT1). summarize() gives the per-hour figures the
// targets in PRD 3.3 use; toCsv() is what the Export button shares. Pure.

const MS_PER_S = 1000;
const MS_PER_H = 3_600_000;
const BYTES_PER_KB = 1024;
const PERCENT = 100;
const HALF = 0.5;
const EVEN = 2;
// A battery drop needs a first and a last reading
const MIN_READINGS = 2;

export type FieldEventKind = 'relay_start' | 'relay_end' | 'battery' | 'sent' | 'gap' | 'rssi' | 'verified' | 'not_verified' | 'primary' | 'secondary';

// value: battery %, bytes, gap minutes, RSSI dBm, or seconds to the verification result
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
