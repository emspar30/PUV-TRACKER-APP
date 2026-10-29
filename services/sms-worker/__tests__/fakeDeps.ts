// DR6: an in-memory WorkerDeps for the worker's tests: devices with their own sequence counters, a
// queue that claim and result work on the way the database functions do, and recorded calls.

import type { ClaimedMessage, DemandRow, HealthStats, QueuedMessage, RouteDispatchState, WorkerDeps, WorkerDevice } from '../src/deps';

export type FakeRow = QueuedMessage & { id: number; routeId: string; status: 'queued' | 'claimed' | 'sent' | 'delivered' | 'failed'; attempts: number; gatewayId: string | null };

export type Fake = WorkerDeps & {
  now: number;
  snapshot: DemandRow[];
  deviceList: WorkerDevice[];
  state: Map<string, RouteDispatchState>;
  lastSeq: Map<string, number | null>;
  queue: FakeRow[];
  tokens: Map<string, string>;
  heartbeats: { gatewayId: string; status: Record<string, unknown> }[];
  stats: HealthStats;
  alerts: { kind: string; detail: Record<string, unknown>; quietMin: number }[];
  openAlerts: Set<string>;
  logs: { level: string; message: string; fields?: Record<string, unknown> }[];
  failSeqFor: Set<string>;
  // CA2c: messages already sent today before the test's queue, and the active gateways
  usedBefore: number;
  gatewayCount: number;
};

export function fakeDeps(nowMs: number): Fake {
  const fake: Fake = {
    now: nowMs,
    snapshot: [],
    deviceList: [],
    state: new Map(),
    lastSeq: new Map(),
    queue: [],
    tokens: new Map(),
    heartbeats: [],
    stats: { gateways: [], sent: 0, failed: 0, latenciesS: [] },
    alerts: [],
    openAlerts: new Set(),
    logs: [],
    failSeqFor: new Set(),
    usedBefore: 0,
    gatewayCount: 1,

    nowMs: () => fake.now,
    demandSnapshot: async () => fake.snapshot,
    devices: async () => fake.deviceList,
    dispatchState: async () => fake.state,

    async nextSeq(deviceId, n) {
      if (fake.failSeqFor.has(deviceId)) throw new Error(`no active driver device ${deviceId}`);
      const previous = fake.lastSeq.get(deviceId) ?? null;
      fake.lastSeq.set(deviceId, ((previous ?? -1) + n) % 10000);
      return ((previous ?? -1) + 1) % 10000;
    },

    async enqueue(routeId, counts, messages) {
      for (const message of messages) {
        fake.queue.push({ ...message, id: fake.queue.length + 1, routeId, status: 'queued', attempts: 0, gatewayId: null });
      }
      fake.state.set(routeId, { counts: { ...counts }, sentAtMs: fake.now });
      return messages.length;
    },

    async claim(gatewayId, max): Promise<ClaimedMessage[]> {
      const picked = fake.queue.filter((row) => row.status === 'queued').slice(0, max);
      for (const row of picked) {
        row.status = 'claimed';
        row.gatewayId = gatewayId;
        row.attempts += 1;
      }
      return picked.map((row) => ({
        id: row.id,
        toE164: fake.deviceList.find((device) => device.deviceId === row.deviceId)?.phoneE164 ?? '',
        encoding: row.encoding,
        bodyText: row.bodyText,
        bodyB64: row.bodyB64,
      }));
    },

    async result(messageId, gatewayId, outcome, _errorText, maxAttempts) {
      const row = fake.queue.find((candidate) => candidate.id === messageId && candidate.gatewayId === gatewayId);
      if (!row) return false;
      if (outcome === 'sent' && row.status === 'claimed') row.status = 'sent';
      else if (outcome === 'delivered' && (row.status === 'claimed' || row.status === 'sent')) row.status = 'delivered';
      else if (outcome === 'failed' && row.status === 'claimed') row.status = row.attempts >= maxAttempts ? 'failed' : 'queued';
      else return false;
      return true;
    },

    gatewayAuth: async (hash) => fake.tokens.get(hash) ?? null,

    async heartbeat(gatewayId, status) {
      fake.heartbeats.push({ gatewayId, status });
      return true;
    },

    healthStats: async () => fake.stats,

    // Every queued row counts as today's (the tests run within one day)
    smsUsage: async () => ({ used: fake.usedBefore + fake.queue.filter((row) => row.status !== 'failed').length, gateways: fake.gatewayCount }),

    async alert(kind, detail, quietMin) {
      if (fake.openAlerts.has(kind)) return false;
      fake.openAlerts.add(kind);
      fake.alerts.push({ kind, detail, quietMin });
      return true;
    },

    log(level, message, fields) {
      fake.logs.push({ level, message, fields });
    },
  };
  return fake;
}
