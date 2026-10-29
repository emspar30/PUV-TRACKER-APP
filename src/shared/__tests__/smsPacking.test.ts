import { SEED_STATIONS } from '../../data/seed/routes';
import { decodeHeatmapBinary, encodeHeatmapBinary, fitsDataSms, heatmapBinarySize } from '../sms/binary';
import { fitsSingleSms, gsm7Septets } from '../sms/gsm';
import { applyMessage, displayCount, emptyHeatmap } from '../driver/heatmap';
import { buildHeatmapMessages, buildHeatmapUpdate, chunkHeatmapNodes, heatmapUpdateSize } from '../sms/pack';
import { parseHeatmap, validateHeatmap, type HeatmapNode } from '../sms/protocol';

// Test-only key, in the form the worker uses (64 hex characters as text)
const KEY = 'a1'.repeat(32);
const MINUTE = 19 * 60 + 30;

const stopsOf = (route: string) => SEED_STATIONS.filter((station) => station.routeCodes.includes(route)).map((station) => station.code);
const ROUTES = [...new Set(SEED_STATIONS.flatMap((station) => station.routeCodes))].sort();
const withCount = (codes: readonly string[], count: number): HeatmapNode[] => codes.map((code) => ({ code, count }));
const synthetic = (n: number) => Array.from({ length: n }, (_, i) => `S${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);

describe('GSM-7 length (DR2)', () => {
  it('counts the extension characters, the heatmap pipe among them, as two', () => {
    expect(gsm7Septets('HM2')).toBe(3);
    expect(gsm7Septets('|')).toBe(2);
    expect(gsm7Septets('HM2|R4')).toBe(7);
    expect(gsm7Septets('€[]{}')).toBe(10);
    expect(gsm7Septets('ñé@')).toBe(3);
  });

  it('refuses characters GSM-7 cannot carry', () => {
    expect(gsm7Septets('Señor ₱15')).toBeNull();
    expect(gsm7Septets('ok 👍')).toBeNull();
  });

  it('fits 160 septets in one SMS', () => {
    expect(fitsSingleSms('A'.repeat(160))).toBe(true);
    expect(fitsSingleSms('A'.repeat(161))).toBe(false);
    expect(fitsSingleSms('|'.repeat(80))).toBe(true);
    expect(fitsSingleSms('|'.repeat(81))).toBe(false);
  });
});

describe('heatmap binary form (DR2)', () => {
  const text = buildHeatmapMessages({ route: 'R4', firstSeq: 42, minuteOfDay: MINUTE, nodes: withCount(['SMB', 'ZAM', 'CSU'], 7) }, KEY, 'text')[0].text;

  it('round-trips to the identical text, whose signature still validates', () => {
    const bytes = encodeHeatmapBinary(text);
    expect(decodeHeatmapBinary(bytes)).toBe(text);
    expect(validateHeatmap(decodeHeatmapBinary(bytes) as string, { key: KEY, lastSeq: 41, nowMinuteOfDay: MINUTE }).ok).toBe(true);
  });

  it('takes 8 + 6 bytes a three-letter stop + 4 (18 stops: 120 bytes)', () => {
    expect(heatmapBinarySize(['SMB', 'ZAM', 'CSU'])).toBe(30);
    expect(encodeHeatmapBinary(text).length).toBe(30);
    expect(heatmapBinarySize(synthetic(18))).toBe(120);
  });

  it('refuses bytes that are not a heatmap message', () => {
    const bytes = encodeHeatmapBinary(text);
    expect(decodeHeatmapBinary(bytes.slice(0, bytes.length - 1))).toBeNull();
    expect(decodeHeatmapBinary(new Uint8Array([...bytes, 0]))).toBeNull();
    const badMagic = bytes.slice();
    badMagic[0] = 0x49;
    expect(decodeHeatmapBinary(badMagic)).toBeNull();
    const routeZero = bytes.slice();
    routeZero[2] = 0;
    expect(decodeHeatmapBinary(routeZero)).toBeNull();
    const lowerCase = bytes.slice();
    lowerCase[9] = 'a'.charCodeAt(0);
    expect(decodeHeatmapBinary(lowerCase)).toBeNull();
    expect(decodeHeatmapBinary(new Uint8Array(3))).toBeNull();
  });

  it('refuses to encode a malformed text or a non-canonical route', () => {
    expect(() => encodeHeatmapBinary('hello')).toThrow(RangeError);
    const zeroPadded = text.replace('|R4|', '|R04|');
    expect(parseHeatmap(zeroPadded)).not.toBeNull();
    expect(() => encodeHeatmapBinary(zeroPadded)).toThrow(RangeError);
  });

  it('fits a data SMS up to 133 bytes', () => {
    expect(fitsDataSms(new Uint8Array(133))).toBe(true);
    expect(fitsDataSms(new Uint8Array(134))).toBe(false);
  });
});

describe('packing a route into messages (DR2)', () => {
  // CA2-1: with the fill stops a whole route no longer fits one v2 message; v3 lists only the stops
  // with someone waiting, so five busy stops of any route are one SMS
  it.each(ROUTES)('fits %s with 5 stops waiting (up to 99 each) in one v3 text message and one data message', (route) => {
    const stops = stopsOf(route);
    expect(stops.length).toBeGreaterThan(5);
    const update = stops.map((code, i) => ({ code, count: i < 5 ? 99 : 0 }));
    expect(heatmapUpdateSize(route, update, 'text')).toBe(1);
    expect(heatmapUpdateSize(route, update, 'data')).toBe(1);
  });

  it('signs messages the driver validates, in one SMS each', () => {
    const [message] = buildHeatmapMessages({ route: 'R2', firstSeq: 7, minuteOfDay: MINUTE, nodes: withCount(stopsOf('R2'), 3) }, KEY, 'text');
    expect(fitsSingleSms(message.text)).toBe(true);
    expect(message.seq).toBe(7);
    expect(message.data).toBeNull();
    expect(validateHeatmap(message.text, { key: KEY, lastSeq: 6, nowMinuteOfDay: MINUTE })).toMatchObject({ ok: true });
  });

  it('splits a long list over messages with consecutive sequence numbers, each stop once, in order', () => {
    const codes = synthetic(24);
    const messages = buildHeatmapMessages({ route: 'R2', firstSeq: 100, minuteOfDay: MINUTE, nodes: withCount(codes, 123) }, KEY, 'text');
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.map((message) => message.seq)).toEqual(messages.map((_, i) => 100 + i));
    const listed = messages.flatMap((message) => (parseHeatmap(message.text) as NonNullable<ReturnType<typeof parseHeatmap>>).nodes.map((node) => node.code));
    expect(listed).toEqual(codes);
    let lastSeq = 99;
    for (const message of messages) {
      expect(fitsSingleSms(message.text)).toBe(true);
      expect(validateHeatmap(message.text, { key: KEY, lastSeq, nowMinuteOfDay: MINUTE }).ok).toBe(true);
      lastSeq = message.seq;
    }
  });

  it('wraps the sequence number from 9999 to 0', () => {
    const messages = buildHeatmapMessages({ route: 'R2', firstSeq: 9999, minuteOfDay: MINUTE, nodes: withCount(synthetic(24), 123) }, KEY, 'text');
    expect(messages.slice(0, 2).map((message) => message.seq)).toEqual([9999, 0]);
    expect(validateHeatmap(messages[1].text, { key: KEY, lastSeq: 9999, nowMinuteOfDay: MINUTE }).ok).toBe(true);
  });

  it('caps a count at 999, the most the format carries', () => {
    const [message] = buildHeatmapMessages({ route: 'R4', firstSeq: 1, minuteOfDay: MINUTE, nodes: [{ code: 'SMB', count: 1500 }] }, KEY, 'text');
    expect(parseHeatmap(message.text)?.nodes).toEqual([{ code: 'SMB', count: 999 }]);
  });

  it('packs the data form by bytes: 20 stops is one message (128 bytes), 21 is two', () => {
    expect(chunkHeatmapNodes('R2', withCount(synthetic(19), 5), 'data')).toHaveLength(1);
    expect(chunkHeatmapNodes('R2', withCount(synthetic(20), 5), 'data')).toHaveLength(1);
    expect(chunkHeatmapNodes('R2', withCount(synthetic(21), 5), 'data')).toHaveLength(2);
    const messages = buildHeatmapMessages({ route: 'R2', firstSeq: 1, minuteOfDay: MINUTE, nodes: withCount(synthetic(21), 5) }, KEY, 'data');
    for (const message of messages) {
      expect(message.data).not.toBeNull();
      expect(fitsDataSms(message.data as Uint8Array)).toBe(true);
      expect(decodeHeatmapBinary(message.data as Uint8Array)).toBe(message.text);
    }
  });

  it('sends nothing for no stops', () => {
    expect(buildHeatmapMessages({ route: 'R4', firstSeq: 1, minuteOfDay: MINUTE, nodes: [] }, KEY, 'text')).toEqual([]);
  });
});

describe('v3: only the stops with someone waiting (CA2-1)', () => {
  const nodes = [
    { code: 'SMB', count: 3 },
    { code: 'ZAM', count: 0 },
    { code: 'CSU', count: 2 },
  ];

  it('lists only the waiting stops, marks the update whole, and validates', () => {
    const [message] = buildHeatmapUpdate({ route: 'R4', firstSeq: 5, minuteOfDay: MINUTE, nodes }, KEY, 'text');
    expect(message.text.startsWith('HM3|R4|0005|1930|F|SMB:3,CSU:2|')).toBe(true);
    const parsed = validateHeatmap(message.text, { key: KEY, lastSeq: 4, nowMinuteOfDay: MINUTE });
    expect(parsed).toMatchObject({ ok: true, message: { full: true, nodes: [{ code: 'SMB', count: 3 }, { code: 'CSU', count: 2 }] } });
  });

  it('round-trips through the data form, whole flag and all', () => {
    for (const update of [nodes, nodes.map((node) => ({ ...node, count: 0 }))]) {
      const [message] = buildHeatmapUpdate({ route: 'R4', firstSeq: 5, minuteOfDay: MINUTE, nodes: update }, KEY, 'data');
      expect(decodeHeatmapBinary(message.data as Uint8Array)).toBe(message.text);
      expect(validateHeatmap(message.text, { key: KEY, lastSeq: 4, nowMinuteOfDay: MINUTE }).ok).toBe(true);
    }
  });

  it('nobody waiting is one message with an empty list, which clears every stop on the driver phone', () => {
    const [message] = buildHeatmapUpdate({ route: 'R4', firstSeq: 9, minuteOfDay: MINUTE, nodes: nodes.map((node) => ({ ...node, count: 0 })) }, KEY, 'text');
    expect(message.text.startsWith('HM3|R4|0009|1930|F|-|')).toBe(true);
    const parsed = parseHeatmap(message.text);
    expect(parsed?.nodes).toEqual([]);
    const before = applyMessage(emptyHeatmap('R4'), { route: 'R4', seq: 1, minuteOfDay: MINUTE, nodes: [{ code: 'SMB', count: 4 }] }, 1);
    const after = applyMessage(before, parsed as NonNullable<typeof parsed>, 2);
    expect(displayCount(after, 'SMB', 2)).toMatchObject({ kind: 'known', band: 0 });
    expect(displayCount(after, 'ZAM', 2)).toMatchObject({ kind: 'known', band: 0 });
  });

  it('a long update is F then P: the second part adds to the first instead of clearing it', () => {
    const many = synthetic(40).map((code) => ({ code, count: 5 }));
    const messages = buildHeatmapUpdate({ route: 'R2', firstSeq: 100, minuteOfDay: MINUTE, nodes: many }, KEY, 'text');
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.map((message) => parseHeatmap(message.text)?.full)).toEqual(messages.map((_, i) => i === 0));
    let state = emptyHeatmap('R2');
    for (const message of messages) state = applyMessage(state, parseHeatmap(message.text) as NonNullable<ReturnType<typeof parseHeatmap>>, 1);
    expect(Object.keys(state.counts)).toHaveLength(40);
  });

  it('the driver phone still reads v2, where the stops not listed keep their value', () => {
    const [v2] = buildHeatmapMessages({ route: 'R4', firstSeq: 1, minuteOfDay: MINUTE, nodes: [{ code: 'SMB', count: 1 }] }, KEY, 'text');
    expect(validateHeatmap(v2.text, { key: KEY, lastSeq: null, nowMinuteOfDay: MINUTE }).ok).toBe(true);
    const state = applyMessage(emptyHeatmap('R4'), parseHeatmap(v2.text) as NonNullable<ReturnType<typeof parseHeatmap>>, 1);
    expect(displayCount(state, 'ZAM', 1)).toEqual({ kind: 'unknown' });
  });
});
