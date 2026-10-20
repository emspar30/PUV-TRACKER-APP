// T1: store and forward (PRD 8.4). Every packet a broadcasting phone makes goes into a buffer on the
// phone (the newest OFFLINE_BUFFER_SIZE are kept) and is sent from there, oldest first, as one batch
// per vehicle. These are the decisions; the buffer itself is SQLite (data/db/telemetryOutbox).

import { TELEMETRY_BATCH_MAX_POINTS, TELEMETRY_RETRY_MAX_S, TELEMETRY_RETRY_MIN_S } from '../config';

import type { TelemetryPacket } from './packet';

const HTTP_OK_MIN = 200;
const HTTP_OK_END = 300;
const HTTP_SERVER_ERROR_MIN = 500;
// Worth trying again: the session is being refreshed, the request timed out, too many requests
const HTTP_UNAUTHORIZED = 401;
const HTTP_TIMEOUT = 408;
const HTTP_TOO_MANY = 429;
const HTTP_TRY_AGAIN: readonly number[] = [HTTP_UNAUTHORIZED, HTTP_TIMEOUT, HTTP_TOO_MANY];
const BACKOFF_FACTOR = 2;

export type OutboxRow = { id: number; packet: TelemetryPacket };

export type OutboxBatch = { vehicleId: string; ids: number[]; points: TelemetryPacket[] };

// The next batch to send: the oldest row's vehicle and its rows (a rider may have changed vehicle
// between two relays while offline), at most TELEMETRY_BATCH_MAX_POINTS. Null when empty.
export function nextBatch(rows: readonly OutboxRow[]): OutboxBatch | null {
  const first = rows[0];
  if (!first) return null;
  const vehicleId = first.packet.vehicle_id;
  const mine = rows.filter((row) => row.packet.vehicle_id === vehicleId).slice(0, TELEMETRY_BATCH_MAX_POINTS);
  return { vehicleId, ids: mine.map((row) => row.id), points: mine.map((row) => row.packet) };
}

// The result of sending a batch: the HTTP status, or null when the server could not be reached
export type SendOutcome = 'sent' | 'retry' | 'drop';

// 2xx: the server has it. No answer, 401 (the session is being refreshed), 408, 429 and 5xx: keep it
// and try again. Any other 4xx will never be accepted (not a team account, unknown vehicle, a bad
// packet), so it is dropped instead of blocking the buffer.
export function sendOutcome(status: number | null): SendOutcome {
  if (status === null) return 'retry';
  if (status >= HTTP_OK_MIN && status < HTTP_OK_END) return 'sent';
  if (HTTP_TRY_AGAIN.includes(status) || status >= HTTP_SERVER_ERROR_MIN) return 'retry';
  return 'drop';
}

// Seconds to wait before the next try after `failures` failed sends in a row (1 or more)
export function retryDelayS(failures: number): number {
  return Math.min(TELEMETRY_RETRY_MIN_S * BACKOFF_FACTOR ** Math.max(0, failures - 1), TELEMETRY_RETRY_MAX_S);
}

// A stored row back into a packet; null for a row that cannot be read (it is dropped)
export function parseOutboxPayload(payload: string): TelemetryPacket | null {
  try {
    const value = JSON.parse(payload) as Partial<TelemetryPacket>;
    const numbers = [value.lat, value.lon, value.speed, value.heading, value.seats, value.ts];
    if (typeof value.vehicle_id !== 'string' || !numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    return value as TelemetryPacket;
  } catch {
    return null;
  }
}
