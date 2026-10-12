// DR6: the real WorkerDeps, over the worker_* database functions (DR3) with the service role.
// The active driver phones (with their SMS keys, from Vault) are cached for WORKER_DEVICE_REFRESH_MIN,
// so a newly set up phone starts getting texts within that time. The health figures are read from
// the tables directly (the service role may; no client role can).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { WORKER_DEVICE_REFRESH_MIN } from '../../../src/shared/config';

import type { ClaimedMessage, DemandRow, HealthStats, LogLevel, RouteDispatchState, WorkerDeps, WorkerDevice } from './deps';
import { maskPhonesIn } from './mask';

const MS_PER_MIN = 60_000;
const MS_PER_S = 1000;

type Rows<T> = { data: T[] | null; error: { message: string } | null };

function rows<T>({ data, error }: Rows<T>, what: string): T[] {
  // Database messages can quote a value; mask any phone number in them
  if (error) throw new Error(`${what}: ${maskPhonesIn(error.message)}`);
  return data ?? [];
}

function value<T>({ data, error }: { data: T | null; error: { message: string } | null }, what: string): T {
  if (error) throw new Error(`${what}: ${maskPhonesIn(error.message)}`);
  return data as T;
}

export function consoleLog(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  try {
    const line = JSON.stringify({ at: new Date().toISOString(), level, message, ...fields });
    (level === 'error' ? console.error : console.log)(maskPhonesIn(line));
  } catch {
    // Logging must never stop the worker
  }
}

export function supabaseDeps(url: string, serviceRoleKey: string, log = consoleLog): WorkerDeps {
  const db: SupabaseClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let deviceCache: { atMs: number; devices: WorkerDevice[] } | null = null;

  return {
    nowMs: () => Date.now(),

    async demandSnapshot(): Promise<DemandRow[]> {
      const data = rows<{ route_id: string; station_code: string; waiting: number }>(await db.rpc('worker_demand_snapshot'), 'demand snapshot');
      return data.map((row) => ({ routeId: row.route_id, stationCode: row.station_code, waiting: Number(row.waiting) }));
    },

    async devices(): Promise<WorkerDevice[]> {
      if (deviceCache && Date.now() - deviceCache.atMs < WORKER_DEVICE_REFRESH_MIN * MS_PER_MIN) return deviceCache.devices;
      const data = rows<{ device_id: string; vehicle_id: string; route_id: string; phone_e164: string; sms_key: string }>(
        await db.rpc('worker_devices'),
        'devices',
      );
      const devices = data.map((row) => ({
        deviceId: row.device_id,
        vehicleId: row.vehicle_id,
        routeId: row.route_id,
        phoneE164: row.phone_e164,
        smsKey: row.sms_key,
      }));
      deviceCache = { atMs: Date.now(), devices };
      return devices;
    },

    async dispatchState(): Promise<Map<string, RouteDispatchState>> {
      const data = rows<{ route_id: string; last_counts: Record<string, number>; last_sent_at: string }>(await db.rpc('worker_dispatch_state'), 'dispatch state');
      return new Map(data.map((row) => [row.route_id, { counts: row.last_counts, sentAtMs: Date.parse(row.last_sent_at) }]));
    },

    async nextSeq(deviceId, n) {
      return value<number>(await db.rpc('worker_next_seq', { device: deviceId, n }), 'next sequence number');
    },

    async enqueue(routeId, counts, messages, ttlMin) {
      const payload = messages.map((message) => ({
        device_id: message.deviceId,
        seq: message.seq,
        encoding: message.encoding,
        body_text: message.bodyText,
        body_b64: message.bodyB64,
      }));
      return value<number>(await db.rpc('worker_enqueue', { route: routeId, counts, messages: payload, ttl_min: ttlMin }), 'enqueue');
    },

    async claim(gatewayId, max, leaseS, maxAttempts): Promise<ClaimedMessage[]> {
      const data = rows<{ id: number; to_e164: string; encoding: 'data' | 'text'; body_text: string; body_b64: string | null }>(
        await db.rpc('worker_claim', { gateway: gatewayId, max_rows: max, lease_s: leaseS, max_attempts: maxAttempts }),
        'claim',
      );
      return data.map((row) => ({ id: Number(row.id), toE164: row.to_e164, encoding: row.encoding, bodyText: row.body_text, bodyB64: row.body_b64 }));
    },

    async result(messageId, gatewayId, outcome, errorText, maxAttempts) {
      return value<boolean>(
        await db.rpc('worker_result', { message_id: messageId, gateway: gatewayId, result: outcome, error_text: errorText, max_attempts: maxAttempts }),
        'result',
      );
    },

    async gatewayAuth(tokenHash) {
      return value<string | null>(await db.rpc('worker_gateway_auth', { hash: tokenHash }), 'gateway auth');
    },

    async heartbeat(gatewayId, status) {
      return value<boolean>(await db.rpc('worker_heartbeat', { gateway: gatewayId, status }), 'heartbeat');
    },

    async healthStats(sinceMs): Promise<HealthStats> {
      const since = new Date(sinceMs).toISOString();
      const gateways = rows<{ gateway_id: string; last_heartbeat_at: string | null }>(
        await db.from('gateways').select('gateway_id, last_heartbeat_at').eq('active', true),
        'gateways',
      );
      const outbox = rows<{ status: string; created_at: string; sent_at: string | null }>(
        await db.from('sms_outbox').select('status, created_at, sent_at').gte('created_at', since).in('status', ['sent', 'delivered', 'failed']),
        'outbox',
      );
      const sentRows = outbox.filter((row) => row.sent_at !== null);
      return {
        gateways: gateways.map((row) => ({ gatewayId: row.gateway_id, lastHeartbeatMs: row.last_heartbeat_at ? Date.parse(row.last_heartbeat_at) : null })),
        sent: sentRows.length,
        failed: outbox.filter((row) => row.status === 'failed').length,
        latenciesS: sentRows.map((row) => (Date.parse(row.sent_at as string) - Date.parse(row.created_at)) / MS_PER_S),
      };
    },

    async alert(kind, detail, quietMin) {
      return value<boolean>(await db.rpc('worker_alert', { kind, detail, quiet_min: quietMin }), 'alert');
    },

    log,
  };
}
