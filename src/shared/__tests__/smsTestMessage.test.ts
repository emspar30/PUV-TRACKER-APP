import { hexToBytes } from '@noble/hashes/utils.js';

import { DATA_SMS_MAX_BYTES } from '../config';
import { decodeHeatmapBinary } from '../sms/binary';
import { manilaMinuteOfDay, validateHeatmap } from '../sms/protocol';
import { buildTestHeatmap, paddingCodes, parseNodeList } from '../sms/testMessage';

// DR5: the test messages of the gateway's carrier test and scripts/sms-sign.ts

const KEY = 'e'.repeat(64);
const AT_MS = Date.UTC(2026, 9, 12, 4, 0);

describe('test heatmap messages (DR5)', () => {
  it('signs a text the driver phone accepts, and the same message as data', () => {
    const message = buildTestHeatmap('R4', 12, [{ code: 'SMB', count: 3 }, { code: 'ZAM', count: 0 }], AT_MS, KEY);
    expect(message.text).toMatch(/^HM2\|R4\|0012\|1200\|SMB:3,ZAM:0\|[0-9A-F]{8}$/);
    expect(validateHeatmap(message.text, { key: KEY, lastSeq: 11, nowMinuteOfDay: manilaMinuteOfDay(new Date(AT_MS)) }).ok).toBe(true);
    expect(decodeHeatmapBinary(hexToBytes(message.dataHex))).toBe(message.text);
    expect(message.bytes).toBe(message.dataHex.length / 2);
    // Five pipes at 2 septets each
    expect(message.septets).toBe(message.text.length + 5);
  });

  it('reads a CODE:count list and refuses anything else', () => {
    expect(parseNodeList('SMB:3, ZAM:0')).toEqual([{ code: 'SMB', count: 3 }, { code: 'ZAM', count: 0 }]);
    expect(parseNodeList('smb:3')).toBeNull();
    expect(parseNodeList('SMB:1000')).toBeNull();
    expect(parseNodeList('')).toBeNull();
  });

  it('makes distinct padding codes that are valid stop codes', () => {
    const codes = paddingCodes(60);
    expect(new Set(codes).size).toBe(60);
    expect(codes.every((code) => /^Q[A-Z]{2}$/.test(code))).toBe(true);
  });

  it(`fits 20 three-letter stops in one data SMS of ${DATA_SMS_MAX_BYTES} bytes, not 21`, () => {
    const build = (n: number) => buildTestHeatmap('R4', 1, paddingCodes(n).map((code) => ({ code, count: 9 })), AT_MS, KEY);
    expect(build(20).bytes).toBeLessThanOrEqual(DATA_SMS_MAX_BYTES);
    expect(build(21).bytes).toBeGreaterThan(DATA_SMS_MAX_BYTES);
  });
});
