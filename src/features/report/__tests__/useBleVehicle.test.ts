// DR8: the Bluetooth session behind useBleVehicle, with the native scanner and the server check
// mocked (docs/IMPLEMENTATION_PLAN_DRIVER.md DR8, Tests).

import type { BeaconVerdict } from '@/services/beacon';
import { encodeBeacon, payloadToHex, slotOf } from '@/shared/beacon/code';
import { ARMED_SCAN_MIN, BEACON_SCAN_MODE, BEACON_SERVICE_UUID, BEACON_SLOT_S } from '@/shared/config';

import type { BeaconReading, ScanStart, ScanStopped } from '../../../../modules/tunton-beacon';
import { createBleSession, type BleView } from '../bleSession';

const SECRET = 'ab'.repeat(32);
const STEP_MS = 250;
const MS_PER_S = 1000;
// Just after a slot boundary, so a test has most of a minute before the code rotates
const START_MS = 1_700_000_040_000 + MS_PER_S;
const STRONG = -50;
const WEAK = -80;
const R4: BeaconVerdict = { ok: true, vehicle: { routeCode: 'R4', vehicleId: 'R4-001', plate: 'MCB 123' } };

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function setUp(scanResult: ScanStart = 'scanning', verdict: BeaconVerdict = R4) {
  let nowMs = START_MS;
  let onReading: ((reading: BeaconReading) => void) | null = null;
  let onStopped: ((event: ScanStopped) => void) | null = null;
  const views: BleView[] = [];
  const scanner = {
    start: jest.fn(async () => scanResult),
    stop: jest.fn(async () => undefined),
    onReading: jest.fn((listener: (reading: BeaconReading) => void) => {
      onReading = listener;
      return { remove: () => (onReading = null) };
    }),
    onStopped: jest.fn((listener: (event: ScanStopped) => void) => {
      onStopped = listener;
      return { remove: () => (onStopped = null) };
    }),
  };
  const verify = jest.fn(async (_payloadHex: string) => verdict);
  const session = createBleSession({ scanner, verify, now: () => nowMs, onChange: (view) => views.push(view) });

  const codeAt = (shortId: number, atMs: number) => payloadToHex(encodeBeacon({ shortId, slot: slotOf(atMs) }, SECRET));
  // Each beacon heard every STEP_MS for durationMs, at its signal strength
  const hear = async (beacons: { shortId: number; rssi: number }[], durationMs: number) => {
    for (let elapsed = 0; elapsed < durationMs; elapsed += STEP_MS) {
      nowMs += STEP_MS;
      jest.advanceTimersByTime(STEP_MS);
      for (const { shortId, rssi } of beacons) onReading?.({ payloadHex: codeAt(shortId, nowMs), rssi, atMs: nowMs });
      await flush();
    }
  };
  const last = () => views[views.length - 1];
  return { session, scanner, verify, views, hear, last, codeAt, now: () => nowMs, stopScan: (reason: string) => onStopped?.({ reason }), listening: () => onReading !== null };
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'Date'] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useBleVehicle session (DR8)', () => {
  it('scans for Tunton beacons only, at low latency, for ARMED_SCAN_MIN', async () => {
    const { session, scanner, last } = setUp();
    await session.start();
    expect(scanner.start).toHaveBeenCalledWith({ serviceUuid: BEACON_SERVICE_UUID, mode: BEACON_SCAN_MODE, durationMs: ARMED_SCAN_MIN * 60_000 });
    expect(last()).toEqual({ kind: 'searching' });
  });

  it('asks the server once, after the beacon has been present for 3 s, then shows the multicab', async () => {
    const { session, verify, hear, last, codeAt, now } = setUp();
    await session.start();
    await hear([{ shortId: 7, rssi: STRONG }], 2500);
    expect(verify).not.toHaveBeenCalled();
    await hear([{ shortId: 7, rssi: STRONG }], 5000);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(last()).toEqual({ kind: 'found', vehicle: R4.ok ? R4.vehicle : null, payloadHex: codeAt(7, now()) });
  });

  it('asks again when the code rotates to a new slot, and sends the newest code', async () => {
    const { session, verify, hear, last, codeAt, now } = setUp();
    await session.start();
    await hear([{ shortId: 7, rssi: STRONG }], BEACON_SLOT_S * MS_PER_S);
    expect(verify).toHaveBeenCalledTimes(2);
    expect(verify.mock.calls[1][0]).not.toBe(verify.mock.calls[0][0]);
    expect(last()).toMatchObject({ kind: 'found', payloadHex: codeAt(7, now()) });
  });

  it('never asks about a weak signal: the rider is not inside that multicab', async () => {
    const { session, verify, hear, last } = setUp();
    await session.start();
    await hear([{ shortId: 7, rssi: WEAK }], 10_000);
    expect(verify).not.toHaveBeenCalled();
    expect(last()).toEqual({ kind: 'searching' });
  });

  it('two multicabs within the margin: ambiguous, the rider picks by hand, nothing is asked', async () => {
    const { session, verify, hear, last } = setUp();
    await session.start();
    await hear([{ shortId: 7, rssi: -50 }, { shortId: 8, rssi: -53 }], 6000);
    expect(verify).not.toHaveBeenCalled();
    expect(last()).toEqual({ kind: 'ambiguous' });
  });

  it('a code the server refuses: the manual pickers, with the reason', async () => {
    const { session, verify, hear, last } = setUp('scanning', { ok: false, reason: 'beacon_invalid' });
    await session.start();
    await hear([{ shortId: 7, rssi: STRONG }], 6000);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(last()).toEqual({ kind: 'failed', reason: 'beacon_invalid' });
  });

  it('a failed server call counts as a failure, not a crash', async () => {
    const { session, verify, hear, last } = setUp();
    verify.mockImplementationOnce(async () => Promise.reject(new Error('offline')));
    await session.start();
    await hear([{ shortId: 7, rssi: STRONG }], 6000);
    expect(last()).toEqual({ kind: 'failed', reason: 'network' });
  });

  it('closing the panel stops the scan and ignores a late answer', async () => {
    const { session, scanner, verify, hear, views, listening } = setUp();
    let answer: (verdict: BeaconVerdict) => void = () => undefined;
    verify.mockImplementationOnce(() => new Promise<BeaconVerdict>((resolve) => (answer = resolve)));
    await session.start();
    await hear([{ shortId: 7, rssi: STRONG }], 4000);
    session.dispose();
    expect(scanner.stop).toHaveBeenCalledTimes(1);
    expect(listening()).toBe(false);
    const shown = views.length;
    answer(R4);
    await flush();
    expect(views).toHaveLength(shown);
  });

  it('says why it cannot scan, and listens to nothing', async () => {
    const { session, last, listening } = setUp('bluetooth_off');
    await session.start();
    expect(last()).toEqual({ kind: 'unavailable', reason: 'bluetooth_off' });
    expect(listening()).toBe(false);
  });

  it('keeps a verified multicab when the scan times out; says it stopped when none was found', async () => {
    const found = setUp();
    await found.session.start();
    await found.hear([{ shortId: 7, rssi: STRONG }], 5000);
    found.stopScan('timeout');
    expect(found.last()).toMatchObject({ kind: 'found' });

    const none = setUp();
    await none.session.start();
    none.stopScan('timeout');
    expect(none.last()).toEqual({ kind: 'unavailable', reason: 'stopped' });
  });
});
