import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { ADMIN_PIN_DIGITS } from '../config';
import { normalizePhNumber } from './phone';

// The one-time setup code an admin shows as a QR on the PC (PRD 9.5; DR3, DR4, DR7):
//   TPV1.<base64url of the JSON payload>
// It carries the phone's secrets, so it is printed only in the provisioning script's terminal and
// never saved; the app hands the secrets straight to its native module. The payload is ASCII only.
// The admin PIN (Q12) is stored as a salted SHA-256: a 6-digit PIN can be found by trying them all,
// so the hash keeps the PIN out of plain sight on the phone; it is a lock against curious taps, not a vault.

const PREFIX = 'TPV1.';
const PAYLOAD_VERSION = 1;
const MS_PER_S = 1000;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const BITS_PER_CHAR = 6;
const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;
const CHAR_MASK = 0x3f;
// Keeps the bit buffer small; it never needs more than 14 bits
const BUFFER_MASK = 0xffffff;
const ASCII_MAX = 0x7f;
const PLATE_MAX = 16;

const HEX64_RE = /^[0-9a-f]{64}$/;
const SALT_RE = /^[0-9a-f]{32}$/;
const DEVICE_ID_RE = /^DRV-\d{4}$/;
const GATEWAY_ID_RE = /^GW-\d{2}$/;
const VEHICLE_ID_RE = /^[A-Z0-9][A-Z0-9-]{0,23}$/;
const ROUTE_RE = /^R\d{1,2}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const HTTPS_RE = /^https:\/\/[^\s/?#]+(\/[^\s]*)?$/;
const SHORT_ID_MAX = 0xffff;

type Common = {
  v: 1;
  // Unix seconds after which the code is refused
  exp: number;
  adminPinHash: string;
  adminPinSalt: string;
};

export type DriverProvisioning = Common & {
  kind: 'driver';
  deviceId: string;
  vehicleId: string;
  shortId: number;
  routeCode: string;
  plate: string;
  // 64 hex characters each
  beaconSecret: string;
  smsKey: string;
  // E.164 numbers the heatmap may come from
  gatewayNumbers: string[];
};

export type GatewayProvisioning = Common & {
  kind: 'gateway';
  gatewayId: string;
  workerUrl: string;
  token: string;
};

export type Provisioning = DriverProvisioning | GatewayProvisioning;

export type ProvisioningResult<P> =
  | { ok: true; payload: P }
  | { ok: false; reason: 'malformed' | 'wrong_version' | 'wrong_kind' | 'expired' | 'insecure_url' };

function toBase64Url(text: string): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < text.length; i++) {
    buffer = ((buffer << BITS_PER_BYTE) | (text.charCodeAt(i) & BYTE_MASK)) & BUFFER_MASK;
    bits += BITS_PER_BYTE;
    while (bits >= BITS_PER_CHAR) {
      bits -= BITS_PER_CHAR;
      out += ALPHABET[(buffer >> bits) & CHAR_MASK];
    }
  }
  if (bits > 0) out += ALPHABET[(buffer << (BITS_PER_CHAR - bits)) & CHAR_MASK];
  return out;
}

function fromBase64Url(encoded: string): string | null {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const char of encoded) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) return null;
    buffer = ((buffer << BITS_PER_CHAR) | value) & BUFFER_MASK;
    bits += BITS_PER_CHAR;
    if (bits >= BITS_PER_BYTE) {
      bits -= BITS_PER_BYTE;
      out += String.fromCharCode((buffer >> bits) & BYTE_MASK);
    }
  }
  return out;
}

const isAscii = (text: string) => [...text].every((char) => char.charCodeAt(0) <= ASCII_MAX);

export function encodeProvisioning(payload: Provisioning): string {
  const json = JSON.stringify(payload);
  if (!isAscii(json)) throw new RangeError('provisioning payload must be ASCII');
  return PREFIX + toBase64Url(json);
}

const isString = (value: unknown): value is string => typeof value === 'string';

function commonIssue(data: Record<string, unknown>, nowMs: number): ProvisioningResult<never> | null {
  if (data.v !== PAYLOAD_VERSION) return { ok: false, reason: 'wrong_version' };
  if (typeof data.exp !== 'number' || !isString(data.adminPinHash) || !isString(data.adminPinSalt)) return { ok: false, reason: 'malformed' };
  if (!HEX64_RE.test(data.adminPinHash) || !SALT_RE.test(data.adminPinSalt)) return { ok: false, reason: 'malformed' };
  if (data.exp * MS_PER_S <= nowMs) return { ok: false, reason: 'expired' };
  return null;
}

function driverPayload(data: Record<string, unknown>): DriverProvisioning | null {
  const { deviceId, vehicleId, shortId, routeCode, plate, beaconSecret, smsKey, gatewayNumbers } = data;
  if (!isString(deviceId) || !DEVICE_ID_RE.test(deviceId)) return null;
  if (!isString(vehicleId) || !VEHICLE_ID_RE.test(vehicleId)) return null;
  if (typeof shortId !== 'number' || !Number.isInteger(shortId) || shortId < 1 || shortId > SHORT_ID_MAX) return null;
  if (!isString(routeCode) || !ROUTE_RE.test(routeCode)) return null;
  if (!isString(plate) || plate.trim().length === 0 || plate.length > PLATE_MAX) return null;
  if (!isString(beaconSecret) || !HEX64_RE.test(beaconSecret)) return null;
  if (!isString(smsKey) || !HEX64_RE.test(smsKey)) return null;
  if (!Array.isArray(gatewayNumbers) || gatewayNumbers.length === 0) return null;
  const numbers = gatewayNumbers.map((number) => (isString(number) ? normalizePhNumber(number) : null));
  if (numbers.some((number) => number === null)) return null;
  return { ...(data as DriverProvisioning), gatewayNumbers: numbers as string[] };
}

function gatewayPayload(data: Record<string, unknown>): GatewayProvisioning | 'insecure_url' | null {
  const { gatewayId, workerUrl, token } = data;
  if (!isString(gatewayId) || !GATEWAY_ID_RE.test(gatewayId)) return null;
  if (!isString(token) || !TOKEN_RE.test(token)) return null;
  if (!isString(workerUrl)) return null;
  if (!HTTPS_RE.test(workerUrl)) return 'insecure_url';
  return data as GatewayProvisioning;
}

export function parseProvisioning(text: string, kind: 'driver', nowMs: number): ProvisioningResult<DriverProvisioning>;
export function parseProvisioning(text: string, kind: 'gateway', nowMs: number): ProvisioningResult<GatewayProvisioning>;
export function parseProvisioning(text: string, kind: Provisioning['kind'], nowMs: number): ProvisioningResult<Provisioning> {
  const trimmed = text.trim();
  if (!trimmed.startsWith(PREFIX)) return { ok: false, reason: 'malformed' };
  const json = fromBase64Url(trimmed.slice(PREFIX.length));
  if (json === null) return { ok: false, reason: 'malformed' };

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, reason: 'malformed' };
  const record = data as Record<string, unknown>;

  const issue = commonIssue(record, nowMs);
  if (issue) return issue;
  if (record.kind !== kind) return { ok: false, reason: record.kind === 'driver' || record.kind === 'gateway' ? 'wrong_kind' : 'malformed' };

  if (kind === 'driver') {
    const payload = driverPayload(record);
    return payload ? { ok: true, payload } : { ok: false, reason: 'malformed' };
  }
  const payload = gatewayPayload(record);
  if (payload === 'insecure_url') return { ok: false, reason: 'insecure_url' };
  return payload ? { ok: true, payload } : { ok: false, reason: 'malformed' };
}

export function isValidPin(pin: string): boolean {
  return pin.length === ADMIN_PIN_DIGITS && /^\d+$/.test(pin);
}

// SHA-256 of the salt's bytes followed by the PIN's, as hex
export function hashAdminPin(pin: string, saltHex: string): string {
  if (!SALT_RE.test(saltHex)) throw new RangeError('the salt is 16 bytes as hex');
  const salt = hexToBytes(saltHex);
  const digits = utf8ToBytes(pin);
  const input = new Uint8Array(salt.length + digits.length);
  input.set(salt);
  input.set(digits, salt.length);
  return bytesToHex(sha256(input));
}

export function checkAdminPin(pin: string, provisioning: Pick<Common, 'adminPinHash' | 'adminPinSalt'>): boolean {
  return isValidPin(pin) && hashAdminPin(pin, provisioning.adminPinSalt) === provisioning.adminPinHash;
}
