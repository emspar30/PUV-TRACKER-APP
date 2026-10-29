import { bytesToHex } from '@noble/hashes/utils.js';

import { DATA_SMS_PORT, SMS_STALE_HEATMAP_MIN } from '../config';
import { emptyHeatmap } from '../driver/heatmap';
import { heatmapView } from '../driver/heatmapView';
import { processEntry, processInbox, type InboxEntry } from '../driver/inbox';
import { encodeHeatmapBinary } from '../sms/binary';
import { HEATMAP_TEXT_PREFIX, manilaMinuteOfDay, signHeatmap, type HeatmapNode } from '../sms/protocol';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DATA_SMS_PORT: PLUGIN_PORT } = require('../../../plugins/withDriverAndroid');

// DR5: what the driver phone does with each stored SMS (src/shared/driver/inbox.ts) and what its
// home screen shows (heatmapView.ts).

const KEY = 'a'.repeat(64);
const GATEWAY = '+639171234567';
const CONTEXT = { key: KEY, gatewayNumbers: [GATEWAY] };
// 12:00 Asia/Manila
const NOON_MS = Date.UTC(2026, 9, 12, 4, 0);
const MS_PER_MIN = 60_000;
const ROUTE = 'R4';

function text(seq: number, nodes: HeatmapNode[], atMs = NOON_MS, key = KEY, route = ROUTE): string {
  return signHeatmap({ route, seq, minuteOfDay: manilaMinuteOfDay(new Date(atMs)), nodes }, key);
}

function entry(body: string, overrides: Partial<InboxEntry> = {}): InboxEntry {
  return { kind: 'text', sender: GATEWAY, body, smscMs: NOON_MS - 2000, receivedMs: NOON_MS, ...overrides };
}

const reasonOf = (result: ReturnType<typeof processEntry>) => (result.outcome.ok ? 'accepted' : result.outcome.reason);

describe('driver inbox (DR5)', () => {
  const start = emptyHeatmap(ROUTE);

  it('applies a valid text message and records the clock sample', () => {
    const result = processEntry(start, entry(text(12, [{ code: 'SMB', count: 3 }, { code: 'ZAM', count: 0 }])), CONTEXT);
    expect(result.outcome).toEqual({ ok: true, seq: 12 });
    expect(result.state.counts).toEqual({ SMB: 3, ZAM: 0 });
    expect(result.state.lastSeq).toBe(12);
    expect(result.state.lastAcceptedMs).toBe(NOON_MS);
    expect(result.driftS).toBe(2);
  });

  it('decodes and applies a data SMS', () => {
    const hex = bytesToHex(encodeHeatmapBinary(text(7, [{ code: 'SMB', count: 11 }])));
    const result = processEntry(start, entry(hex, { kind: 'data' }), CONTEXT);
    expect(result.outcome).toEqual({ ok: true, seq: 7 });
    expect(result.state.counts).toEqual({ SMB: 11 });
  });

  it('accepts the gateway number in local form (0917...)', () => {
    expect(reasonOf(processEntry(start, entry(text(1, [{ code: 'SMB', count: 1 }]), { sender: '09171234567' }), CONTEXT))).toBe('accepted');
  });

  it.each([
    ['another number', { sender: '+639998887777' }],
    ['a short code', { sender: '2600' }],
    ['no number', { sender: '' }],
  ])('drops a message from %s as wrong_sender', (_name, overrides) => {
    const result = processEntry(start, entry(text(1, [{ code: 'SMB', count: 5 }]), overrides), CONTEXT);
    expect(reasonOf(result)).toBe('wrong_sender');
    expect(result.state).toBe(start);
  });

  it('drops a changed signature, a message 40 min off, a repeat, another route and garbage', () => {
    const valid = text(5, [{ code: 'SMB', count: 2 }]);
    const tampered = valid.slice(0, -1) + (valid.endsWith('0') ? '1' : '0');
    expect(reasonOf(processEntry(start, entry(tampered), CONTEXT))).toBe('bad_signature');
    expect(reasonOf(processEntry(start, entry(text(5, [{ code: 'SMB', count: 2 }], NOON_MS - 40 * MS_PER_MIN)), CONTEXT))).toBe('stale_time');
    expect(reasonOf(processEntry(start, entry(text(5, [{ code: 'SMB', count: 2 }], NOON_MS, 'b'.repeat(64))), CONTEXT))).toBe('bad_signature');
    expect(reasonOf(processEntry(start, entry(text(5, [{ code: 'SMB', count: 2 }], NOON_MS, KEY, 'R3')), CONTEXT))).toBe('wrong_route');
    expect(reasonOf(processEntry(start, entry(`${HEATMAP_TEXT_PREFIX}hello`), CONTEXT))).toBe('malformed');
    expect(reasonOf(processEntry(start, entry('zz', { kind: 'data' }), CONTEXT))).toBe('malformed');
    expect(reasonOf(processEntry(start, entry('4802', { kind: 'data' }), CONTEXT))).toBe('malformed');

    const after = processEntry(start, entry(valid), CONTEXT).state;
    expect(reasonOf(processEntry(after, entry(valid), CONTEXT))).toBe('old_sequence');
  });

  it('applies a split pair, in the order the messages arrived', () => {
    const first = entry(text(20, [{ code: 'SMB', count: 4 }, { code: 'ZAM', count: 1 }]), { receivedMs: NOON_MS });
    const second = entry(text(21, [{ code: 'LEM', count: 9 }]), { receivedMs: NOON_MS + 1000 });
    // Drained newest first: still applied oldest first, so 21 is not refused after 20
    const { state, results } = processInbox(start, [second, first], CONTEXT);
    expect(results.map((result) => result.outcome.ok)).toEqual([true, true]);
    expect(state.counts).toEqual({ SMB: 4, ZAM: 1, LEM: 9 });
    expect(state.lastSeq).toBe(21);
  });

  it('keeps unlisted stops when a later message updates others', () => {
    const one = processEntry(start, entry(text(1, [{ code: 'SMB', count: 4 }, { code: 'ZAM', count: 2 }])), CONTEXT).state;
    const two = processEntry(one, entry(text(2, [{ code: 'ZAM', count: 0 }]), { receivedMs: NOON_MS + MS_PER_MIN }), CONTEXT).state;
    expect(two.counts).toEqual({ SMB: 4, ZAM: 0 });
  });

  it('records the clock from a message the wrong clock made stale', () => {
    // The phone is 40 min fast: the message looks old, and the carrier time shows why
    const fastMs = NOON_MS + 40 * MS_PER_MIN;
    const result = processEntry(start, entry(text(3, [{ code: 'SMB', count: 1 }]), { smscMs: NOON_MS, receivedMs: fastMs }), CONTEXT);
    expect(reasonOf(result)).toBe('stale_time');
    expect(result.driftS).toBe(40 * 60);
  });

  it('takes no clock sample from a message without a carrier time', () => {
    expect(processEntry(start, entry(text(3, [{ code: 'SMB', count: 1 }]), { smscMs: 0 }), CONTEXT).driftS).toBeNull();
  });

  it('listens on the same data port in the manifest as in the config', () => {
    expect(Number(PLUGIN_PORT)).toBe(DATA_SMS_PORT);
  });
});

describe('driver heatmap screen (DR5)', () => {
  const stops = [
    { code: 'SMB', name: 'Sample Bus Stop' },
    { code: 'ZAM', name: 'Zamora' },
    { code: 'LEM', name: 'Lemon' },
  ];
  const applied = processEntry(emptyHeatmap(ROUTE), entry(text(1, [{ code: 'SMB', count: 7 }, { code: 'ZAM', count: 0 }])), CONTEXT).state;

  it('shows nothing as known before the first message', () => {
    const view = heatmapView(null, stops, NOON_MS);
    expect(view.freshness).toBe('never');
    expect(view.ageMin).toBeNull();
    expect(view.rows.every((row) => row.display.kind === 'unknown')).toBe(true);
    expect(view.bandsOnly).toBe(false);
  });

  it('keeps a stop never sent unknown, never 0', () => {
    const view = heatmapView(applied, stops, NOON_MS);
    expect(view.rows.map((row) => row.display)).toEqual([
      { kind: 'known', band: 2, exact: 7, near: 0 },
      { kind: 'known', band: 0, exact: 0, near: 0 },
      { kind: 'unknown' },
    ]);
    expect(view.freshness).toBe('fresh');
  });

  it(`goes stale after ${SMS_STALE_HEATMAP_MIN} min with no message, keeping its age`, () => {
    const justBefore = heatmapView(applied, stops, NOON_MS + (SMS_STALE_HEATMAP_MIN * MS_PER_MIN - 1));
    expect(justBefore.freshness).toBe('fresh');
    const after = heatmapView(applied, stops, NOON_MS + 17 * MS_PER_MIN);
    expect(after.freshness).toBe('stale');
    expect(after.ageMin).toBe(17);
  });

  it('shows bands only at night (Q11)', () => {
    // 22:00 Asia/Manila
    const nightMs = Date.UTC(2026, 9, 12, 14, 0);
    const atNight = processEntry(emptyHeatmap(ROUTE), entry(text(1, [{ code: 'SMB', count: 7 }], nightMs), { smscMs: nightMs, receivedMs: nightMs }), CONTEXT).state;
    const view = heatmapView(atNight, stops, nightMs);
    expect(view.rows[0].display).toEqual({ kind: 'known', band: 2, exact: null, near: 0 });
    expect(view.bandsOnly).toBe(true);
  });
});
