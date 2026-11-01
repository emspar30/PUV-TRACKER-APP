// DR6: everything the SMS worker needs from outside, so its logic runs in tests with fakes (the same
// pattern as supabase/functions/_shared/ingestCore.ts). supabaseDeps.ts is the real one, over the
// worker_* database functions (supabase/migrations/20261013000000_driver_side.sql).

import type { HeatmapEncoding } from '../../../src/shared/sms/pack';

// waiting: everyone checked in at the stop; near (CA3): the part of them checked in near it
// (absent before migration 20261030000000, worker_demand_near)
export type DemandRow = { routeId: string; stationCode: string; waiting: number; near?: number };

// An active driver phone. smsKey is a secret: never logged.
export type WorkerDevice = { deviceId: string; vehicleId: string; routeId: string; phoneE164: string; smsKey: string };

export type RouteDispatchState = { counts: Record<string, number>; sentAtMs: number };

export type QueuedMessage = { deviceId: string; seq: number; encoding: HeatmapEncoding; bodyText: string; bodyB64: string | null };

export type ClaimedMessage = { id: number; toE164: string; encoding: HeatmapEncoding; bodyText: string; bodyB64: string | null };

export type SendOutcome = 'sent' | 'delivered' | 'failed';

export type HealthStats = {
  // Active gateways and their last heartbeat (null: never seen)
  gateways: { gatewayId: string; lastHeartbeatMs: number | null }[];
  // Messages of the last hour, by outcome
  sent: number;
  failed: number;
  // Seconds from queued to sent, for the last hour's sent messages
  latenciesS: number[];
};

export type LogLevel = 'info' | 'warn' | 'error';

export type WorkerDeps = {
  nowMs(): number;
  demandSnapshot(): Promise<DemandRow[]>;
  devices(): Promise<WorkerDevice[]>;
  dispatchState(): Promise<Map<string, RouteDispatchState>>;
  // Reserves n consecutive sequence numbers for a phone and returns the first
  nextSeq(deviceId: string, n: number): Promise<number>;
  // Queues a route's messages and records what the route was sent, in one transaction
  enqueue(routeId: string, counts: Record<string, number>, messages: QueuedMessage[], ttlMin: number): Promise<number>;
  claim(gatewayId: string, max: number, leaseS: number, maxAttempts: number): Promise<ClaimedMessage[]>;
  result(messageId: number, gatewayId: string, outcome: SendOutcome, errorText: string | null, maxAttempts: number): Promise<boolean>;
  // The active gateway whose token has this SHA-256, or null
  gatewayAuth(tokenHash: string): Promise<string | null>;
  heartbeat(gatewayId: string, status: Record<string, unknown>): Promise<boolean>;
  healthStats(sinceMs: number): Promise<HealthStats>;
  // CA2c: messages queued since `sinceMs` that were not lost (queued, claimed, sent or delivered), and
  // the active gateways, for the daily cap
  smsUsage(sinceMs: number): Promise<{ used: number; gateways: number }>;
  // Records an alert unless the same kind is open from the last quietMin minutes; true if recorded
  alert(kind: string, detail: Record<string, unknown>, quietMin: number): Promise<boolean>;
  // Must not throw. Fields must already be masked (mask.ts).
  log(level: LogLevel, message: string, fields?: Record<string, unknown>): void;
};
