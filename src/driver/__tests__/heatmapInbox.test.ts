// DR5: the driver app drains its native SMS inbox into the heatmap store (native modules mocked).
// The rules for each message are tested in src/shared/__tests__/driverInbox.test.ts; this checks the
// wiring: counters by reason, the log, the clock samples, the route, and the inbox left alone when
// the phone has lost its key.

import { bytesToHex } from '@noble/hashes/utils.js';

import { DRIVER_RECENT_LOG_MAX } from '@/shared/config';
import { encodeHeatmapBinary } from '@/shared/sms/binary';
import { manilaMinuteOfDay, signHeatmap } from '@/shared/sms/protocol';

import { drainAndApply, ensureInboxConfigured } from '../features/heatmap/inbox';
import { useDriverStore } from '../state/driverStore';
import { useHeatmapStore } from '../state/heatmapStore';
import type { InboxEntry } from '../../../modules/tunton-sms';

// jest.mock calls are hoisted above these imports

const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));

const mockInbox: { entries: InboxEntry[]; configured: boolean } = { entries: [], configured: false };
const mockConfigure = jest.fn(async (_prefix: string, _max: number) => {
  mockInbox.configured = true;
});
const mockDrain = jest.fn(async () => mockInbox.entries.splice(0));
jest.mock('../../../modules/tunton-sms', () => ({
  isSmsAvailable: () => true,
  isInboxConfigured: () => mockInbox.configured,
  configureInbox: (prefix: string, max: number) => mockConfigure(prefix, max),
  drainInbox: () => mockDrain(),
}));

const mockKey: { value: string | null } = { value: null };
jest.mock('../../../modules/tunton-beacon', () => ({
  isBeaconAvailable: () => true,
  getSmsKey: async () => mockKey.value,
}));

const KEY = 'd'.repeat(64);
const GATEWAY = '+639170000001';
// 12:00 Asia/Manila
const NOON_MS = Date.UTC(2026, 9, 12, 4, 0);

const signed = (seq: number, count: number, route = 'R4') =>
  signHeatmap({ route, seq, minuteOfDay: manilaMinuteOfDay(new Date(NOON_MS)), nodes: [{ code: 'SMB', count }] }, KEY);

const entry = (body: string, overrides: Partial<InboxEntry> = {}): InboxEntry => ({
  kind: 'text',
  sender: GATEWAY,
  body,
  smscMs: NOON_MS - 3000,
  receivedMs: NOON_MS,
  ...overrides,
});

beforeEach(() => {
  mockSaved.clear();
  mockInbox.entries = [];
  mockInbox.configured = false;
  mockKey.value = KEY;
  mockDrain.mockClear();
  useHeatmapStore.getState().resetHeatmap();
  useDriverStore.getState().setSetup({
    deviceId: 'DRV-0001',
    vehicleId: 'R4-TEST-01',
    shortId: 7,
    routeCode: 'R4',
    plate: 'TEST 001',
    gatewayNumbers: [GATEWAY],
    adminPinHash: 'a'.repeat(64),
    adminPinSalt: 'b'.repeat(32),
    provisionedAtMs: NOON_MS,
  });
});

describe('heatmap inbox (DR5)', () => {
  it('turns the native inbox on once, with the heatmap prefix', async () => {
    await ensureInboxConfigured();
    await ensureInboxConfigured();
    expect(mockConfigure).toHaveBeenCalledTimes(1);
    expect(mockConfigure).toHaveBeenCalledWith('HM', 50);
  });

  it('applies valid messages and counts each rejection by reason', async () => {
    mockInbox.entries = [
      entry(bytesToHex(encodeHeatmapBinary(signed(4, 6))), { kind: 'data', receivedMs: NOON_MS }),
      entry(signed(5, 9), { sender: '+639998887777', receivedMs: NOON_MS + 1 }),
      entry(signed(4, 6), { receivedMs: NOON_MS + 2 }),
      entry(signed(6, 1, 'R3'), { receivedMs: NOON_MS + 3 }),
    ];
    expect(await drainAndApply()).toBe(4);

    const state = useHeatmapStore.getState();
    expect(state.heatmap).toMatchObject({ route: 'R4', counts: { SMB: 6 }, lastSeq: 4, lastAcceptedMs: NOON_MS });
    expect(state.accepted).toBe(1);
    expect(state.rejected).toEqual({ wrong_sender: 1, old_sequence: 1, wrong_route: 1 });
    expect(state.recent.map((log) => log.outcome)).toEqual(['wrong_route', 'old_sequence', 'wrong_sender', 'accepted']);
    expect(state.recent[3]).toEqual({ receivedMs: NOON_MS, kind: 'data', outcome: 'accepted', seq: 4 });
    // Rejected messages give clock samples too (each arrived 1 ms after the one before)
    expect(state.driftSamples).toEqual([3, 3.001, 3.002, 3.003]);
  });

  it('keeps no message body anywhere it saves', async () => {
    mockInbox.entries = [entry(signed(1, 2))];
    await drainAndApply();
    expect([...mockSaved.values()].join('')).not.toContain('HM2|');
  });

  it('leaves the inbox alone when the phone has lost its key', async () => {
    mockKey.value = null;
    mockInbox.entries = [entry(signed(1, 2))];
    expect(await drainAndApply()).toBe(0);
    expect(mockDrain).not.toHaveBeenCalled();
    expect(mockInbox.entries).toHaveLength(1);
  });

  it('starts a new heatmap when the phone is set up for another route', async () => {
    mockInbox.entries = [entry(signed(1, 2))];
    await drainAndApply();
    const setup = useDriverStore.getState().setup;
    if (!setup) throw new Error('not set up');
    useDriverStore.getState().setSetup({ ...setup, routeCode: 'R3' });
    mockInbox.entries = [entry(signed(2, 5, 'R3'), { receivedMs: NOON_MS + 1 })];
    await drainAndApply();
    expect(useHeatmapStore.getState().heatmap).toMatchObject({ route: 'R3', counts: { SMB: 5 }, lastSeq: 2 });
  });

  it(`keeps only the last ${DRIVER_RECENT_LOG_MAX} results in the log`, async () => {
    mockInbox.entries = Array.from({ length: DRIVER_RECENT_LOG_MAX + 5 }, (_, i) => entry(signed(i + 1, 1), { receivedMs: NOON_MS + i }));
    await drainAndApply();
    const { recent, accepted } = useHeatmapStore.getState();
    expect(accepted).toBe(DRIVER_RECENT_LOG_MAX + 5);
    expect(recent).toHaveLength(DRIVER_RECENT_LOG_MAX);
    expect(recent[0].seq).toBe(DRIVER_RECENT_LOG_MAX + 5);
  });
});
