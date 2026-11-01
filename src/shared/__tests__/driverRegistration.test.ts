import { createHash } from 'node:crypto';

import { bytesToHex } from '@noble/hashes/utils.js';

import { decodeHeatmapBinary } from '../sms/binary';
import { parseHeatmap } from '../sms/protocol';
import {
  canMove,
  checkAllowed,
  checkText,
  decodeCheckData,
  encodeCheckData,
  installTokenHash,
  isCheckCode,
  isInstallToken,
  normalizePlate,
  parseCheckText,
  readCheckCode,
  setupExpired,
  vehicleIdFor,
  type CheckSent,
} from '../driver/registration';

// Made-up test values only. 2026-10-27 10:00 in Manila is 02:00 UTC.
const NOW = Date.UTC(2026, 9, 27, 2, 0);
const MIN = 60000;
const DAY = 86400000;
const PHONE = '+639171234567';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456';

describe('plate', () => {
  it.each([
    ['ABC 1234', 'ABC 1234'],
    ['abc 1234', 'ABC 1234'],
    ['abc-1234', 'ABC 1234'],
    ['  ABC   1234 ', 'ABC 1234'],
    ['ABC1234', 'ABC1234'],
    ['123 ABC', '123 ABC'],
    ['TEST 001', 'TEST 001'],
  ])('%j is %j', (raw, plate) => {
    expect(normalizePlate(raw)).toBe(plate);
  });

  it.each(['', 'AB', '12', 'ABCDEF', '123456', 'ABC 12345678', 'ABC_123', 'ÑAB 123'])('%j is refused', (raw) => {
    expect(normalizePlate(raw)).toBeNull();
  });

  it('makes the vehicle id from route and plate', () => {
    expect(vehicleIdFor('R4', 'abc-1234')).toBe('R4-ABC1234');
    expect(vehicleIdFor('R12', 'TEST 001')).toBe('R12-TEST001');
  });

  it('refuses a bad route or plate for the vehicle id', () => {
    expect(vehicleIdFor('4', 'ABC 1234')).toBeNull();
    expect(vehicleIdFor('R0', 'ABC 1234')).toBeNull();
    expect(vehicleIdFor('R4', 'AB')).toBeNull();
  });
});

describe('number check message', () => {
  it('round-trips the data form', () => {
    const bytes = encodeCheckData('042917');
    expect(bytesToHex(bytes)).toBe('5601303432393137');
    expect(decodeCheckData(bytes)).toBe('042917');
  });

  it('round-trips the text form under the heatmap prefix the receiver already keeps', () => {
    expect(checkText('042917')).toBe('HM2|V|042917');
    expect(parseCheckText('HM2|V|042917')).toBe('042917');
    expect(parseCheckText(' HM2|V|042917\n')).toBe('042917');
  });

  it('refuses other messages', () => {
    expect(decodeCheckData(Uint8Array.from([0x48, 0x01, 0x30, 0x34, 0x32, 0x39, 0x31, 0x37]))).toBeNull();
    expect(decodeCheckData(Uint8Array.from([0x56, 0x02, 0x30, 0x34, 0x32, 0x39, 0x31, 0x37]))).toBeNull();
    expect(decodeCheckData(Uint8Array.from([0x56, 0x01, 0x30, 0x34, 0x32, 0x39, 0x31, 0x41]))).toBeNull();
    expect(decodeCheckData(Uint8Array.from([0x56, 0x01, 0x30]))).toBeNull();
    expect(parseCheckText('HM2|V|04291')).toBeNull();
    expect(parseCheckText('HM2|R4|0001|1201|TAL:0')).toBeNull();
    expect(() => encodeCheckData('12345')).toThrow(RangeError);
    expect(() => checkText('abcdef')).toThrow(RangeError);
  });

  it('reads the code from an inbox entry of either kind', () => {
    expect(readCheckCode({ kind: 'data', body: '5601303432393137' })).toBe('042917');
    expect(readCheckCode({ kind: 'text', body: 'HM2|V|042917' })).toBe('042917');
    expect(readCheckCode({ kind: 'data', body: 'zz' })).toBeNull();
    expect(readCheckCode({ kind: 'text', body: 'hello' })).toBeNull();
  });

  it('is never taken for a heatmap message', () => {
    expect(decodeHeatmapBinary(encodeCheckData('042917'))).toBeNull();
    expect(parseHeatmap(checkText('042917'))).toBeNull();
  });

  it('checks the code format', () => {
    expect(isCheckCode('000000')).toBe(true);
    expect(isCheckCode('12345')).toBe(false);
    expect(isCheckCode('1234567')).toBe(false);
  });
});

describe('check limits (D6)', () => {
  const at = (minutesAgo: number, phone = PHONE): CheckSent => ({ phone, atMs: NOW - minutesAgo * MIN });

  it('allows the first check and gives the number in E.164', () => {
    expect(checkAllowed('0917 123 4567', [], NOW)).toEqual({ ok: true, phone: PHONE });
  });

  it('refuses a number that is not a Philippine mobile number', () => {
    expect(checkAllowed('12345', [], NOW)).toEqual({ ok: false, reason: 'invalid_number' });
  });

  it('waits 10 minutes before sending to the same number again', () => {
    expect(checkAllowed(PHONE, [at(9)], NOW)).toEqual({ ok: false, reason: 'too_soon', retryAtMs: NOW + MIN });
    expect(checkAllowed(PHONE, [at(10)], NOW)).toEqual({ ok: true, phone: PHONE });
    expect(checkAllowed('09171234567', [at(9, '639171234567')], NOW).ok).toBe(false);
  });

  it('allows 3 checks per number a day', () => {
    expect(checkAllowed(PHONE, [at(30), at(60)], NOW).ok).toBe(true);
    expect(checkAllowed(PHONE, [at(30), at(60), at(90)], NOW)).toEqual({ ok: false, reason: 'number_limit' });
  });

  it('allows 20 checks a day in total', () => {
    const others = Array.from({ length: 20 }, (_, i) => at(30, `+63918000${String(i).padStart(4, '0')}`));
    expect(checkAllowed(PHONE, others.slice(0, 19), NOW).ok).toBe(true);
    expect(checkAllowed(PHONE, others, NOW)).toEqual({ ok: false, reason: 'daily_limit' });
  });

  it('starts counting again at midnight in Manila', () => {
    // 2026-10-27 00:05 Manila; the three checks were on the 26th, before midnight Manila
    const justAfterMidnight = Date.UTC(2026, 9, 26, 16, 5);
    const yesterday = [15, 60, 120].map((minutes) => ({ phone: PHONE, atMs: justAfterMidnight - minutes * MIN }));
    expect(checkAllowed(PHONE, yesterday, justAfterMidnight).ok).toBe(true);
    expect(checkAllowed(PHONE, yesterday, justAfterMidnight - 10 * MIN)).toEqual({ ok: false, reason: 'number_limit' });
  });
});

describe('install token and status', () => {
  it('hashes the token as SHA-256 hex', () => {
    expect(installTokenHash(TOKEN)).toBe(createHash('sha256').update(TOKEN).digest('hex'));
  });

  it('refuses a token of the wrong shape', () => {
    expect(isInstallToken(TOKEN)).toBe(true);
    expect(isInstallToken(TOKEN.slice(1))).toBe(false);
    expect(isInstallToken(`${TOKEN.slice(1)}=`)).toBe(false);
    expect(() => installTokenHash('short')).toThrow(RangeError);
  });

  it('moves pending to a decision (or expired by a newer registration) and approved to collected or expired', () => {
    expect(canMove('pending', 'approved')).toBe(true);
    expect(canMove('pending', 'rejected')).toBe(true);
    expect(canMove('pending', 'expired')).toBe(true);
    expect(canMove('approved', 'collected')).toBe(true);
    expect(canMove('approved', 'expired')).toBe(true);
    expect(canMove('pending', 'collected')).toBe(false);
    expect(canMove('rejected', 'approved')).toBe(false);
    expect(canMove('collected', 'approved')).toBe(false);
    expect(canMove('expired', 'collected')).toBe(false);
  });

  it('expires an approved setup after 7 days', () => {
    expect(setupExpired(NOW, NOW + 7 * DAY - 1)).toBe(false);
    expect(setupExpired(NOW, NOW + 7 * DAY)).toBe(true);
  });
});
