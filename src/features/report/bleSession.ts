import type { BeaconFailure, BeaconVerdict, BleVehicle } from '@/services/beacon';
import { decodeBeacon, payloadFromHex } from '@/shared/beacon/code';
import { pickBeacon, updateBeacon, type BeaconTrack } from '@/shared/beacon/presence';
import { ARMED_SCAN_MIN, BEACON_PAYLOAD_VERSION, BEACON_SCAN_MODE, BEACON_SERVICE_UUID } from '@/shared/config';

import type { BeaconReading, EventSubscription, ScanOptions, ScanStart, ScanStopped } from '../../../modules/tunton-beacon';

// DR8: one Bluetooth scan while the Relay panel is open (PRD 8.1 to 8.2, 10.1). Readings are tracked
// per beacon (its short id, which stays the same while the code rotates); a beacon present for
// BEACON_PRESENCE_S and the margin rule pick the multicab; the server checks its code once per slot.
// A verified multicab stays chosen while the panel is open, and its newest code goes with the relay.
// The native scanner and the server check are passed in, so this runs in tests without either.

const MS_PER_MIN = 60_000;
// The presence rule depends on time as well as readings: look again this often
export const BLE_TICK_MS = 1000;

export type BleScanner = {
  start(options: ScanOptions): Promise<ScanStart>;
  stop(): Promise<void>;
  onReading(listener: (reading: BeaconReading) => void): EventSubscription | null;
  onStopped(listener: (event: ScanStopped) => void): EventSubscription | null;
};

export type BleView =
  | { kind: 'starting' }
  // No scan: no Bluetooth, permission, module, or the scan ended (stopped) before a multicab was found
  | { kind: 'unavailable'; reason: Exclude<ScanStart, 'scanning'> | 'stopped' }
  | { kind: 'searching' }
  // Two multicabs within the margin (PRD 10.1): the rider picks
  | { kind: 'ambiguous' }
  | { kind: 'failed'; reason: BeaconFailure }
  | { kind: 'found'; vehicle: BleVehicle; payloadHex: string };

export type BleSessionDeps = {
  scanner: BleScanner;
  verify: (payloadHex: string) => Promise<BeaconVerdict>;
  now: () => number;
  onChange: (view: BleView) => void;
};

export type BleSession = {
  start(): Promise<void>;
  dispose(): void;
};

type Code = { payloadHex: string; slotLow: number };

export function createBleSession({ scanner, verify, now, onChange }: BleSessionDeps): BleSession {
  const tracks = new Map<number, BeaconTrack>();
  const latest = new Map<number, Code>();
  // The last answer per beacon, for the slot it was asked about
  const verdicts = new Map<number, { slotLow: number; verdict: BeaconVerdict }>();
  const asking = new Set<string>();
  const subscriptions: EventSubscription[] = [];
  let found: { shortId: number; vehicle: BleVehicle } | null = null;
  let shown = '';
  let scanning = false;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const show = (view: BleView) => {
    const key = JSON.stringify(view);
    if (disposed || key === shown) return;
    shown = key;
    onChange(view);
  };

  const ask = (shortId: number, code: Code) => {
    const key = `${shortId}:${code.slotLow}`;
    if (asking.has(key)) return;
    asking.add(key);
    verify(code.payloadHex)
      .catch((): BeaconVerdict => ({ ok: false, reason: 'network' }))
      .then((verdict) => {
        asking.delete(key);
        if (disposed) return;
        verdicts.set(shortId, { slotLow: code.slotLow, verdict });
        if (verdict.ok) found = { shortId, vehicle: verdict.vehicle };
        evaluate();
      });
  };

  const evaluate = () => {
    if (disposed) return;
    const pick = scanning ? pickBeacon(tracks, now()) : { kind: 'none' as const };
    let failure: BeaconFailure | null = null;
    if (pick.kind === 'one') {
      const code = latest.get(pick.key);
      const answer = verdicts.get(pick.key);
      // Once per beacon per slot: a new slot is a new code, asked about again
      if (code && answer?.slotLow !== code.slotLow) ask(pick.key, code);
      else if (answer && !answer.verdict.ok) failure = answer.verdict.reason;
    }

    if (found) {
      const code = latest.get(found.shortId);
      if (code) show({ kind: 'found', vehicle: found.vehicle, payloadHex: code.payloadHex });
    } else if (pick.kind === 'ambiguous') show({ kind: 'ambiguous' });
    else if (failure) show({ kind: 'failed', reason: failure });
    else if (scanning) show({ kind: 'searching' });
  };

  const onReading = (reading: BeaconReading) => {
    const payload = payloadFromHex(reading.payloadHex);
    const code = payload ? decodeBeacon(payload) : null;
    if (!code || code.version !== BEACON_PAYLOAD_VERSION || code.shortId === 0) return;
    tracks.set(code.shortId, updateBeacon(tracks.get(code.shortId), reading.rssi, reading.atMs));
    latest.set(code.shortId, { payloadHex: reading.payloadHex.toLowerCase(), slotLow: code.slotLow });
    evaluate();
  };

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const onStopped = () => {
    scanning = false;
    stopTimer();
    if (!found) show({ kind: 'unavailable', reason: 'stopped' });
  };

  const removeSubscriptions = () => {
    for (const subscription of subscriptions.splice(0)) subscription.remove();
  };

  return {
    async start() {
      show({ kind: 'starting' });
      for (const subscription of [scanner.onReading(onReading), scanner.onStopped(onStopped)]) {
        if (subscription) subscriptions.push(subscription);
      }
      const result = await scanner.start({ serviceUuid: BEACON_SERVICE_UUID, mode: BEACON_SCAN_MODE, durationMs: ARMED_SCAN_MIN * MS_PER_MIN });
      if (disposed) {
        if (result === 'scanning') void scanner.stop();
        return;
      }
      if (result !== 'scanning') {
        removeSubscriptions();
        show({ kind: 'unavailable', reason: result });
        return;
      }
      scanning = true;
      timer = setInterval(evaluate, BLE_TICK_MS);
      evaluate();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      stopTimer();
      removeSubscriptions();
      if (scanning) void scanner.stop();
      scanning = false;
    },
  };
}
