import { createHmac } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { decodeBeacon, encodeBeacon, payloadFromHex, payloadToHex, slotOf, verifyBeacon } from '../beacon/code';
import { isPresent, pickBeacon, updateBeacon, type BeaconTrack } from '../beacon/presence';

type Vector = { secretHex: string; shortId: number; slot: number; payloadHex: string };
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'beacon-vectors.json'), 'utf8'));
const VECTORS: Vector[] = FIXTURE.vectors;

const SLOT_MS = 60_000;
// The middle of a slot, so a test never sits on a slot boundary
const msIn = (slot: number) => slot * SLOT_MS + SLOT_MS / 2;
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const A_2026_SLOT = 29_600_000;
const SECRET = VECTORS[6].secretHex;

describe('beacon code (PRD 8.2; DR2)', () => {
  it('matches every shared test vector', () => {
    expect(VECTORS.length).toBe(12);
    for (const vector of VECTORS) {
      expect(payloadToHex(encodeBeacon({ shortId: vector.shortId, slot: vector.slot }, vector.secretHex))).toBe(vector.payloadHex);
    }
  });

  it('agrees with an independent HMAC (Node crypto), so the vectors are right, not just stable', () => {
    for (const { secretHex, shortId, slot, payloadHex } of VECTORS) {
      const signed = Buffer.alloc(7);
      signed.writeUInt8(1, 0);
      signed.writeUInt16BE(shortId, 1);
      signed.writeUInt32BE(slot, 3);
      const mac = createHmac('sha256', Buffer.from(secretHex, 'hex')).update(signed).digest().subarray(0, 4);
      const header = Buffer.alloc(5);
      header.writeUInt8(1, 0);
      header.writeUInt16BE(shortId, 1);
      header.writeUInt16BE(slot & 0xffff, 3);
      expect(Buffer.concat([header, mac]).toString('hex')).toBe(payloadHex);
    }
  });

  it('decodes what it encodes', () => {
    const payload = encodeBeacon({ shortId: 4660, slot: A_2026_SLOT + 7 }, SECRET);
    const code = decodeBeacon(payload);
    expect(code).toMatchObject({ version: 1, shortId: 4660, slotLow: (A_2026_SLOT + 7) & 0xffff });
    expect(code?.mac.length).toBe(4);
    expect(payloadFromHex(payloadToHex(payload))).toEqual(payload);
  });

  it('counts slots of 60 s', () => {
    expect(slotOf(msIn(A_2026_SLOT))).toBe(A_2026_SLOT);
    expect(slotOf(A_2026_SLOT * SLOT_MS - 1)).toBe(A_2026_SLOT - 1);
  });

  it('is valid in its own slot and one slot either side (PRD 0.2 S1)', () => {
    const payload = encodeBeacon({ shortId: 4660, slot: A_2026_SLOT }, SECRET);
    expect(verifyBeacon(payload, SECRET, msIn(A_2026_SLOT))).toEqual({ ok: true, slot: A_2026_SLOT, slotOffset: 0 });
    // Heard one slot later: the code is one slot old
    expect(verifyBeacon(payload, SECRET, msIn(A_2026_SLOT + 1))).toEqual({ ok: true, slot: A_2026_SLOT, slotOffset: -1 });
    // The phone's clock a little ahead of the server's
    expect(verifyBeacon(payload, SECRET, msIn(A_2026_SLOT - 1))).toEqual({ ok: true, slot: A_2026_SLOT, slotOffset: 1 });
  });

  it('is invalid two or more slots away (PRD 0.2 S1, S7; PRD 13: no replay after 2 slots)', () => {
    const payload = encodeBeacon({ shortId: 4660, slot: A_2026_SLOT }, SECRET);
    for (const away of [2, 3, 60, -2, -3]) {
      expect(verifyBeacon(payload, SECRET, msIn(A_2026_SLOT + away))).toEqual({ ok: false, reason: 'expired' });
    }
  });

  it('handles the 16-bit wrap of the slot', () => {
    const { secretHex } = VECTORS[2];
    const payload = encodeBeacon({ shortId: 2, slot: 65535 }, secretHex);
    expect(verifyBeacon(payload, secretHex, msIn(65536))).toEqual({ ok: true, slot: 65535, slotOffset: -1 });
  });

  it('refuses a code from 65,536 slots ago although its low bits match now', () => {
    const payload = encodeBeacon({ shortId: 4660, slot: A_2026_SLOT }, SECRET);
    expect(verifyBeacon(payload, SECRET, msIn(A_2026_SLOT + 65536))).toEqual({ ok: false, reason: 'bad_mac' });
  });

  it('refuses a changed MAC, another vehicle\'s secret, another version and the wrong length', () => {
    const payload = encodeBeacon({ shortId: 4660, slot: A_2026_SLOT }, SECRET);
    const flipped = payload.slice();
    flipped[8] ^= 0x01;
    expect(verifyBeacon(flipped, SECRET, msIn(A_2026_SLOT))).toEqual({ ok: false, reason: 'bad_mac' });
    expect(verifyBeacon(payload, VECTORS[0].secretHex, msIn(A_2026_SLOT))).toEqual({ ok: false, reason: 'bad_mac' });

    const otherVersion = payload.slice();
    otherVersion[0] = 2;
    expect(verifyBeacon(otherVersion, SECRET, msIn(A_2026_SLOT))).toEqual({ ok: false, reason: 'bad_version' });

    expect(verifyBeacon(payload.slice(0, 8), SECRET, msIn(A_2026_SLOT))).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyBeacon(new Uint8Array([...payload, 0]), SECRET, msIn(A_2026_SLOT))).toEqual({ ok: false, reason: 'malformed' });
    const zeroId = payload.slice();
    zeroId[1] = 0;
    zeroId[2] = 0;
    expect(verifyBeacon(zeroId, SECRET, msIn(A_2026_SLOT))).toEqual({ ok: false, reason: 'malformed' });
  });

  it('refuses input it cannot carry', () => {
    expect(() => encodeBeacon({ shortId: 0, slot: 1 }, SECRET)).toThrow(RangeError);
    expect(() => encodeBeacon({ shortId: 65536, slot: 1 }, SECRET)).toThrow(RangeError);
    expect(() => encodeBeacon({ shortId: 1, slot: -1 }, SECRET)).toThrow(RangeError);
    expect(() => encodeBeacon({ shortId: 1, slot: 2 ** 32 }, SECRET)).toThrow(RangeError);
    expect(() => encodeBeacon({ shortId: 1, slot: 1 }, SECRET.slice(1))).toThrow(RangeError);
    expect(payloadFromHex('0100')).toBeNull();
    expect(hex(payloadFromHex(VECTORS[0].payloadHex.toUpperCase()) as Uint8Array)).toBe(VECTORS[0].payloadHex);
  });
});

describe('beacon presence (PRD 10.1; DR2)', () => {
  const heard = (readings: [atMs: number, dbm: number][], start?: BeaconTrack) =>
    readings.reduce<BeaconTrack | undefined>((track, [atMs, dbm]) => updateBeacon(track, dbm, atMs), start) as BeaconTrack;

  it('smooths the signal (PRD 0.2 S1: -60 then -70 gives -63.0)', () => {
    expect(heard([[0, -60], [500, -70]]).smoothedDbm).toBeCloseTo(-63.0, 10);
  });

  it('is present only after 3 s above the threshold', () => {
    const track = heard([[0, -50], [1000, -50], [2000, -50], [2900, -50]]);
    expect(isPresent(track, 2900)).toBe(false);
    expect(isPresent(track, 2999)).toBe(false);
    expect(isPresent(track, 3000)).toBe(true);
  });

  it('starts the 3 s again after a dip below the threshold', () => {
    // -50, then -100 smooths to -65.0: not above -65
    const track = heard([[0, -50], [1000, -100], [2000, -50]]);
    expect(track.aboveSinceMs).toBe(2000);
    expect(isPresent(track, 4999)).toBe(false);
    expect(isPresent(track, 5000)).toBe(true);
  });

  it('is gone after 10 s unheard, and starts over when heard again', () => {
    const track = heard([[0, -50], [3000, -50]]);
    expect(isPresent(track, 13000)).toBe(true);
    expect(isPresent(track, 13001)).toBe(false);
    const again = updateBeacon(track, -90, 20000);
    expect(again.smoothedDbm).toBe(-90);
    expect(again.aboveSinceMs).toBeNull();
  });

  const track = (smoothedDbm: number): BeaconTrack => ({ smoothedDbm, aboveSinceMs: 0, lastHeardMs: 5000 });

  it('picks the stronger beacon only when it leads by 8 dB or more', () => {
    expect(pickBeacon(new Map([['A', track(-50)], ['B', track(-59)]]), 5000)).toEqual({ kind: 'one', key: 'A' });
    expect(pickBeacon(new Map([['A', track(-50)], ['B', track(-58)]]), 5000)).toEqual({ kind: 'one', key: 'A' });
    expect(pickBeacon(new Map([['A', track(-50)], ['B', track(-57)]]), 5000)).toEqual({ kind: 'ambiguous', keys: ['A', 'B'] });
  });

  it('lists only the beacons within the margin as candidates', () => {
    const tracks = new Map([['A', track(-52)], ['B', track(-50)], ['C', track(-60)]]);
    expect(pickBeacon(tracks, 5000)).toEqual({ kind: 'ambiguous', keys: ['B', 'A'] });
  });

  it('ignores beacons that are not present', () => {
    const notYet: BeaconTrack = { smoothedDbm: -40, aboveSinceMs: 4000, lastHeardMs: 5000 };
    expect(pickBeacon(new Map([['A', notYet], ['B', track(-60)]]), 5000)).toEqual({ kind: 'one', key: 'B' });
    expect(pickBeacon(new Map([['A', notYet]]), 5000)).toEqual({ kind: 'none' });
    expect(pickBeacon(new Map(), 5000)).toEqual({ kind: 'none' });
  });
});
