import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

import { BEACON_PAYLOAD_VERSION, BEACON_SLOT_S, BEACON_SLOT_TOLERANCE } from '../config';

// The driver beacon's rotating code (PRD 8.2; docs/IMPLEMENTATION_PLAN_DRIVER.md section 6.1).
// Payload, 9 bytes, big-endian, carried as service data:
//   version (1) | shortId (2) | low 16 bits of the slot (2) | mac (4)
// slot = floor(unix seconds / BEACON_SLOT_S); the secret is 32 random bytes per vehicle, written as
// 64 hex characters. mac = first 4 bytes of HMAC-SHA256(secret, version | shortId | slot), where the
// slot is the FULL 32-bit number: only its low 16 bits travel, so a captured code never becomes valid
// again when the 16-bit counter wraps (every 45 days).
// The same rule runs in Kotlin (the driver phone) and SQL (verify_beacon); all three are checked
// against tests/fixtures/beacon-vectors.json.

const PAYLOAD_BYTES = 9;
const SIGNED_BYTES = 7;
const MAC_BYTES = 4;
const SECRET_BYTES = 32;
const SHORT_ID_MAX = 0xffff;
const SLOT_MAX = 0xffffffff;
const SLOT_LOW_MASK = 0xffff;
const BYTE = 8;
const BYTE_MASK = 0xff;
const MS_PER_S = 1000;
const SECRET_RE = /^[0-9a-f]{64}$/i;

// Byte offsets
const AT_VERSION = 0;
const AT_SHORT_ID = 1;
const AT_SLOT = 3;
const AT_MAC = 5;
const SIGNED_AT_SLOT = 3;

export type BeaconCode = {
  version: number;
  shortId: number;
  // Low 16 bits of the slot
  slotLow: number;
  mac: Uint8Array;
};

export type BeaconCheck =
  | { ok: true; slot: number; slotOffset: number }
  | { ok: false; reason: 'malformed' | 'bad_version' | 'bad_mac' | 'expired' };

export function slotOf(ms: number): number {
  return Math.floor(ms / MS_PER_S / BEACON_SLOT_S);
}

export function isBeaconSecret(secretHex: string): boolean {
  return SECRET_RE.test(secretHex);
}

function secretBytes(secretHex: string): Uint8Array {
  if (!isBeaconSecret(secretHex)) throw new RangeError(`a beacon secret is ${SECRET_BYTES} bytes as hex`);
  return hexToBytes(secretHex.toLowerCase());
}

function writeUint16(bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = (value >>> BYTE) & BYTE_MASK;
  bytes[at + 1] = value & BYTE_MASK;
}

function readUint16(bytes: Uint8Array, at: number): number {
  return (bytes[at] << BYTE) | bytes[at + 1];
}

function macFor(secret: Uint8Array, version: number, shortId: number, slot: number): Uint8Array {
  const signed = new Uint8Array(SIGNED_BYTES);
  signed[AT_VERSION] = version;
  writeUint16(signed, AT_SHORT_ID, shortId);
  new DataView(signed.buffer).setUint32(SIGNED_AT_SLOT, slot);
  return hmac(sha256, secret, signed).slice(0, MAC_BYTES);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

// The payload a driver phone advertises during one slot
export function encodeBeacon(input: { shortId: number; slot: number }, secretHex: string): Uint8Array {
  const { shortId, slot } = input;
  if (!Number.isInteger(shortId) || shortId < 1 || shortId > SHORT_ID_MAX) throw new RangeError(`invalid shortId: ${shortId}`);
  if (!Number.isInteger(slot) || slot < 0 || slot > SLOT_MAX) throw new RangeError(`invalid slot: ${slot}`);
  const payload = new Uint8Array(PAYLOAD_BYTES);
  payload[AT_VERSION] = BEACON_PAYLOAD_VERSION;
  writeUint16(payload, AT_SHORT_ID, shortId);
  writeUint16(payload, AT_SLOT, slot & SLOT_LOW_MASK);
  payload.set(macFor(secretBytes(secretHex), BEACON_PAYLOAD_VERSION, shortId, slot), AT_MAC);
  return payload;
}

export function decodeBeacon(payload: Uint8Array): BeaconCode | null {
  if (payload.length !== PAYLOAD_BYTES) return null;
  return {
    version: payload[AT_VERSION],
    shortId: readUint16(payload, AT_SHORT_ID),
    slotLow: readUint16(payload, AT_SLOT),
    mac: payload.slice(AT_MAC),
  };
}

// The server's rule (PRD 0.2 S1, S7): valid in its own slot and BEACON_SLOT_TOLERANCE either side of
// now; invalid two or more slots away. The full slot is the candidate whose low 16 bits match.
export function verifyBeacon(payload: Uint8Array, secretHex: string, nowMs: number): BeaconCheck {
  const code = decodeBeacon(payload);
  if (!code || code.shortId === 0) return { ok: false, reason: 'malformed' };
  if (code.version !== BEACON_PAYLOAD_VERSION) return { ok: false, reason: 'bad_version' };

  const secret = secretBytes(secretHex);
  const now = slotOf(nowMs);
  for (let offset = -BEACON_SLOT_TOLERANCE; offset <= BEACON_SLOT_TOLERANCE; offset++) {
    const slot = now + offset;
    if ((slot & SLOT_LOW_MASK) !== code.slotLow) continue;
    // Within the tolerance at most one candidate has these low bits
    return sameBytes(macFor(secret, code.version, code.shortId, slot), code.mac)
      ? { ok: true, slot, slotOffset: offset }
      : { ok: false, reason: 'bad_mac' };
  }
  return { ok: false, reason: 'expired' };
}

export function payloadToHex(payload: Uint8Array): string {
  return bytesToHex(payload);
}

export function payloadFromHex(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]{18}$/i.test(hex)) return null;
  return hexToBytes(hex.toLowerCase());
}
