import {
  isNewerSeq,
  manilaMinuteOfDay,
  minutesApart,
  parseHeatmap,
  signHeatmap,
  validateHeatmap,
  type HeatmapMessage,
  type ValidationContext,
} from '../sms/protocol';

// Test-only key. Messages are generated with the signer; the sample MAC in the PRD is illustrative.
const KEY = 'test-driver-device-key';
const GATEWAY = '+639170000001';

// 19:30 Asia/Manila
const NOW = 19 * 60 + 30;

const MESSAGE: HeatmapMessage = {
  route: 'R4',
  seq: 42,
  minuteOfDay: NOW,
  nodes: [
    { code: 'RCA', count: 12 },
    { code: 'MCA', count: 5 },
    { code: 'JCA', count: 0 },
  ],
};

const context = (overrides: Partial<ValidationContext> = {}): ValidationContext => ({
  key: KEY,
  lastSeq: 41,
  nowMinuteOfDay: NOW,
  ...overrides,
});

describe('SMS signer', () => {
  it('produces the HM2 format with a zero-padded sequence and an 8 character signature', () => {
    const sms = signHeatmap(MESSAGE, KEY);
    expect(sms).toMatch(/^HM2\|R4\|0042\|1930\|RCA:12,MCA:5,JCA:0\|[0-9A-F]{8}$/);
    expect(sms.length).toBeLessThanOrEqual(160);
  });

  it('rejects input the format cannot carry', () => {
    expect(() => signHeatmap({ ...MESSAGE, route: 'ROUTE4' }, KEY)).toThrow(RangeError);
    expect(() => signHeatmap({ ...MESSAGE, seq: 10000 }, KEY)).toThrow(RangeError);
    expect(() => signHeatmap({ ...MESSAGE, minuteOfDay: 1440 }, KEY)).toThrow(RangeError);
    expect(() => signHeatmap({ ...MESSAGE, nodes: [] }, KEY)).toThrow(RangeError);
    expect(() => signHeatmap({ ...MESSAGE, nodes: [{ code: 'rca', count: 1 }] }, KEY)).toThrow(RangeError);
    expect(() => signHeatmap({ ...MESSAGE, nodes: [{ code: 'RCA', count: 1000 }] }, KEY)).toThrow(RangeError);
  });
});

describe('SMS parser', () => {
  it('returns all three stations, not only the last', () => {
    const parsed = parseHeatmap(signHeatmap(MESSAGE, KEY));
    expect(parsed).not.toBeNull();
    expect(parsed!.nodes).toEqual(MESSAGE.nodes);
    expect(parsed!.route).toBe('R4');
    expect(parsed!.seq).toBe(42);
    expect(parsed!.hhmm).toBe('1930');
    expect(parsed!.minuteOfDay).toBe(NOW);
  });

  it('returns null for text that does not match the format', () => {
    expect(parseHeatmap('hello')).toBeNull();
    expect(parseHeatmap('HM|R4|SM:12|CSU:5')).toBeNull();
    expect(parseHeatmap('HM2|R4|0042|2460|RCA:1|0123ABCD')).toBeNull();
    expect(parseHeatmap('HM2|R4|0042|1260|RCA:1|0123ABCD')).toBeNull();
  });
});

describe('SMS validation', () => {
  it('round trip: a signed message validates with the same key and fails with another', () => {
    const sms = signHeatmap(MESSAGE, KEY);
    const result = validateHeatmap(sms, context());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message.nodes).toHaveLength(3);

    expect(validateHeatmap(sms, context({ key: 'another-key' }))).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a changed signature character', () => {
    const sms = signHeatmap(MESSAGE, KEY);
    const last = sms[sms.length - 1];
    const tampered = sms.slice(0, -1) + (last === '0' ? '1' : '0');
    expect(validateHeatmap(tampered, context())).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a changed count under the original signature', () => {
    const tampered = signHeatmap(MESSAGE, KEY).replace('RCA:12', 'RCA:99');
    expect(validateHeatmap(tampered, context())).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a sequence number that is not newer', () => {
    const sms = signHeatmap(MESSAGE, KEY);
    expect(validateHeatmap(sms, context({ lastSeq: 42 }))).toEqual({ ok: false, reason: 'old_sequence' });
    expect(validateHeatmap(sms, context({ lastSeq: 43 }))).toEqual({ ok: false, reason: 'old_sequence' });
    expect(validateHeatmap(sms, context({ lastSeq: null })).ok).toBe(true);
  });

  it('accepts a newer sequence number across the wrap-around', () => {
    const wrapped = signHeatmap({ ...MESSAGE, seq: 1 }, KEY);
    expect(validateHeatmap(wrapped, context({ lastSeq: 9999 })).ok).toBe(true);
    expect(validateHeatmap(wrapped, context({ lastSeq: 2 }))).toEqual({ ok: false, reason: 'old_sequence' });
  });

  it('rejects a timestamp more than 30 minutes off', () => {
    const sms = signHeatmap(MESSAGE, KEY);
    expect(validateHeatmap(sms, context({ nowMinuteOfDay: NOW + 31 }))).toEqual({ ok: false, reason: 'stale_time' });
    expect(validateHeatmap(sms, context({ nowMinuteOfDay: NOW - 31 }))).toEqual({ ok: false, reason: 'stale_time' });
    expect(validateHeatmap(sms, context({ nowMinuteOfDay: NOW + 29 })).ok).toBe(true);
    expect(validateHeatmap(sms, context({ nowMinuteOfDay: NOW + 30 })).ok).toBe(true);
  });

  it('handles a time window that crosses midnight', () => {
    const beforeMidnight = signHeatmap({ ...MESSAGE, minuteOfDay: 23 * 60 + 50 }, KEY);
    expect(validateHeatmap(beforeMidnight, context({ nowMinuteOfDay: 10 })).ok).toBe(true);
    expect(validateHeatmap(beforeMidnight, context({ nowMinuteOfDay: 30 }))).toEqual({
      ok: false,
      reason: 'stale_time',
    });
  });

  it('rejects a wrong sender when the sender is part of the input', () => {
    const sms = signHeatmap(MESSAGE, KEY);
    expect(validateHeatmap(sms, context({ sender: '+639990000000', expectedSender: GATEWAY }))).toEqual({
      ok: false,
      reason: 'wrong_sender',
    });
    expect(validateHeatmap(sms, context({ sender: GATEWAY, expectedSender: GATEWAY })).ok).toBe(true);
  });

  it('rejects malformed text', () => {
    expect(validateHeatmap('not a heatmap', context())).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('SMS helpers', () => {
  it('isNewerSeq uses the 1 to 5,000 window, modulo 10,000', () => {
    expect(isNewerSeq(5, 4)).toBe(true);
    expect(isNewerSeq(5001, 1)).toBe(true);
    expect(isNewerSeq(5002, 1)).toBe(false);
    expect(isNewerSeq(4, 4)).toBe(false);
    expect(isNewerSeq(0, 9999)).toBe(true);
  });

  it('minutesApart is the shortest distance around the clock', () => {
    expect(minutesApart(10, 1430)).toBe(20);
    expect(minutesApart(600, 630)).toBe(30);
  });

  it('manilaMinuteOfDay converts UTC to Asia/Manila (UTC+8)', () => {
    expect(manilaMinuteOfDay(new Date('2026-10-02T11:30:00Z'))).toBe(19 * 60 + 30);
    expect(manilaMinuteOfDay(new Date('2026-10-02T16:05:00Z'))).toBe(5);
  });
});
