import { createHash } from 'node:crypto';

import {
  checkAdminPin,
  encodeProvisioning,
  hashAdminPin,
  isValidPin,
  parseProvisioning,
  type DriverProvisioning,
  type GatewayProvisioning,
} from '../driver/provisioning';

// Made-up test values only
const NOW = Date.UTC(2026, 9, 12, 2, 0);
const EXP = NOW / 1000 + 15 * 60;
const SALT = '0123456789abcdef0123456789abcdef';
const PIN = '482916';

const DRIVER: DriverProvisioning = {
  v: 1,
  kind: 'driver',
  exp: EXP,
  adminPinHash: hashAdminPin(PIN, SALT),
  adminPinSalt: SALT,
  deviceId: 'DRV-0001',
  vehicleId: 'R4-TEST-01',
  shortId: 1,
  routeCode: 'R4',
  plate: 'TEST 001',
  beaconSecret: 'b'.repeat(64),
  smsKey: 'c'.repeat(64),
  gatewayNumbers: ['+639170000001'],
};

const GATEWAY: GatewayProvisioning = {
  v: 1,
  kind: 'gateway',
  exp: EXP,
  adminPinHash: hashAdminPin(PIN, SALT),
  adminPinSalt: SALT,
  gatewayId: 'GW-01',
  workerUrl: 'https://worker.example.org',
  token: 'A'.repeat(43),
};

const reencode = (payload: object) => `TPV1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;

describe('provisioning codes (PRD 9.5; DR2)', () => {
  it('round-trips a driver code, and is standard base64url', () => {
    const text = encodeProvisioning(DRIVER);
    expect(text).toBe(reencode(DRIVER));
    expect(parseProvisioning(text, 'driver', NOW)).toEqual({ ok: true, payload: DRIVER });
  });

  it('round-trips a gateway code', () => {
    expect(parseProvisioning(encodeProvisioning(GATEWAY), 'gateway', NOW)).toEqual({ ok: true, payload: GATEWAY });
  });

  it('writes the gateway numbers as E.164', () => {
    const result = parseProvisioning(reencode({ ...DRIVER, gatewayNumbers: ['0917 000 0001'] }), 'driver', NOW);
    expect(result).toEqual({ ok: true, payload: { ...DRIVER, gatewayNumbers: ['+639170000001'] } });
  });

  it('refuses an expired code', () => {
    expect(parseProvisioning(encodeProvisioning(DRIVER), 'driver', EXP * 1000)).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses the other kind of code, and another version', () => {
    expect(parseProvisioning(encodeProvisioning(GATEWAY), 'driver', NOW)).toEqual({ ok: false, reason: 'wrong_kind' });
    expect(parseProvisioning(encodeProvisioning(DRIVER), 'gateway', NOW)).toEqual({ ok: false, reason: 'wrong_kind' });
    expect(parseProvisioning(reencode({ ...DRIVER, v: 2 }), 'driver', NOW)).toEqual({ ok: false, reason: 'wrong_version' });
  });

  it('refuses a worker address without HTTPS', () => {
    expect(parseProvisioning(reencode({ ...GATEWAY, workerUrl: 'http://worker.example.org' }), 'gateway', NOW)).toEqual({
      ok: false,
      reason: 'insecure_url',
    });
  });

  it.each([
    ['a short beacon secret', { beaconSecret: 'b'.repeat(63) }],
    ['an upper-case SMS key', { smsKey: 'C'.repeat(64) }],
    ['no gateway number', { gatewayNumbers: [] }],
    ['a landline as the gateway', { gatewayNumbers: ['0852251234'] }],
    ['short id 0', { shortId: 0 }],
    ['a bad device id', { deviceId: 'DRV-1' }],
    ['a bad route', { routeCode: 'Route 4' }],
    ['an empty plate', { plate: ' ' }],
    ['no expiry', { exp: undefined }],
  ])('refuses %s', (_name, change) => {
    expect(parseProvisioning(reencode({ ...DRIVER, ...change }), 'driver', NOW)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('refuses text that is not a setup code', () => {
    for (const text of ['', 'hello', 'TPV1.', 'TPV1.!!!', `TPV1.${Buffer.from('not json').toString('base64url')}`, reencode([1, 2])]) {
      expect(parseProvisioning(text, 'driver', NOW)).toEqual({ ok: false, reason: 'malformed' });
    }
  });

  it('refuses to encode a payload that is not ASCII', () => {
    expect(() => encodeProvisioning({ ...DRIVER, plate: 'ÑCB 123' })).toThrow(RangeError);
  });
});

describe('admin PIN (Q12; DR2)', () => {
  it('takes exactly 6 digits', () => {
    expect(isValidPin('482916')).toBe(true);
    for (const pin of ['48291', '4829167', '48291a', '', '４８２９１６']) expect(isValidPin(pin)).toBe(false);
  });

  it('hashes salt then PIN with SHA-256', () => {
    const expected = createHash('sha256').update(Buffer.concat([Buffer.from(SALT, 'hex'), Buffer.from(PIN)])).digest('hex');
    expect(hashAdminPin(PIN, SALT)).toBe(expected);
    expect(() => hashAdminPin(PIN, 'short')).toThrow(RangeError);
  });

  it('checks a PIN against the stored hash', () => {
    expect(checkAdminPin(PIN, DRIVER)).toBe(true);
    expect(checkAdminPin('482917', DRIVER)).toBe(false);
    expect(checkAdminPin('48291', DRIVER)).toBe(false);
  });
});
