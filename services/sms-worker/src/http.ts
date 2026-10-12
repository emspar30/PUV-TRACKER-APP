// DR6: the gateway's HTTP API (docs/IMPLEMENTATION_PLAN_DRIVER.md section 6.4), as a plain function
// of the request so it is tested without a server; main.ts wires it to node:http.
//   GET  /healthz       no token, no data: "ok"
//   POST /v1/pull       { max }                         -> { messages: [{ id, to, encoding, text | dataB64, port }] }
//   POST /v1/result     { id, status, errorCode?, atMs } -> 204 (409 if the message is not this gateway's to report)
//   POST /v1/heartbeat  { batteryPct, charging, simReady, signalLevel, queueLocal, appVersion } -> { pullEveryS }
// Every /v1 route needs "Authorization: Bearer <gateway token>"; the worker knows the gateway by the
// token's SHA-256 only. A request without a valid token gets 401 with no detail.

import { createHash } from 'node:crypto';

import {
  DATA_SMS_PORT,
  GATEWAY_PULL_MAX,
  GATEWAY_PULL_S,
  SMS_CLAIM_LEASE_S,
  SMS_SEND_MAX_ATTEMPTS,
  WORKER_BODY_MAX_BYTES,
} from '../../../src/shared/config';

import type { SendOutcome, WorkerDeps } from './deps';
import { errorText } from './cycle';

export type WorkerRequest = { method: string; path: string; authorization: string | undefined; body: string };
export type WorkerResponse = { status: number; body: unknown };

const BEARER_RE = /^Bearer ([A-Za-z0-9_-]{16,128})$/;
const OUTCOMES: readonly SendOutcome[] = ['sent', 'delivered', 'failed'];
const ERROR_TEXT_MAX = 200;
// The heartbeat fields kept, and their types; anything else is dropped
const HEARTBEAT_FIELDS = {
  batteryPct: 'number',
  charging: 'boolean',
  simReady: 'boolean',
  signalLevel: 'number',
  queueLocal: 'number',
  appVersion: 'string',
} as const;
const APP_VERSION_MAX = 32;

const json = (status: number, body: unknown): WorkerResponse => ({ status, body });
const UNAUTHORIZED = json(401, { error: 'unauthorized' });

export const tokenHash = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');

function parse(body: string): Record<string, unknown> | null {
  if (body.trim() === '') return {};
  try {
    const value: unknown = JSON.parse(body);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function handleRequest(request: WorkerRequest, deps: WorkerDeps): Promise<WorkerResponse> {
  const { method, path } = request;
  if (path === '/healthz') return method === 'GET' ? { status: 200, body: 'ok' } : json(405, { error: 'method_not_allowed' });
  if (!['/v1/pull', '/v1/result', '/v1/heartbeat'].includes(path)) return json(404, { error: 'not_found' });
  if (method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (Buffer.byteLength(request.body, 'utf8') > WORKER_BODY_MAX_BYTES) return json(413, { error: 'too_large' });

  const token = BEARER_RE.exec(request.authorization ?? '')?.[1];
  if (!token) return UNAUTHORIZED;
  const gatewayId = await deps.gatewayAuth(tokenHash(token));
  if (!gatewayId) return UNAUTHORIZED;

  const body = parse(request.body);
  if (!body) return json(400, { error: 'bad_json' });

  try {
    if (path === '/v1/pull') return await pull(gatewayId, body, deps);
    if (path === '/v1/result') return await result(gatewayId, body, deps);
    return await heartbeat(gatewayId, body, deps);
  } catch (error) {
    deps.log('error', 'request failed', { path, gatewayId, error: errorText(error) });
    return json(500, { error: 'server_error' });
  }
}

async function pull(gatewayId: string, body: Record<string, unknown>, deps: WorkerDeps): Promise<WorkerResponse> {
  const asked = typeof body.max === 'number' && Number.isInteger(body.max) ? body.max : GATEWAY_PULL_MAX;
  const max = Math.min(GATEWAY_PULL_MAX, Math.max(1, asked));
  const claimed = await deps.claim(gatewayId, max, SMS_CLAIM_LEASE_S, SMS_SEND_MAX_ATTEMPTS);
  return json(200, {
    messages: claimed.map((message) =>
      message.encoding === 'data' && message.bodyB64
        ? { id: message.id, to: message.toE164, encoding: 'data', dataB64: message.bodyB64, port: DATA_SMS_PORT }
        : { id: message.id, to: message.toE164, encoding: 'text', text: message.bodyText },
    ),
  });
}

async function result(gatewayId: string, body: Record<string, unknown>, deps: WorkerDeps): Promise<WorkerResponse> {
  const { id, status, errorCode } = body;
  if (typeof id !== 'number' || !Number.isInteger(id) || !OUTCOMES.includes(status as SendOutcome)) return json(400, { error: 'bad_request' });
  const error = errorCode === undefined || errorCode === null ? null : String(errorCode).slice(0, ERROR_TEXT_MAX);
  const changed = await deps.result(id, gatewayId, status as SendOutcome, error, SMS_SEND_MAX_ATTEMPTS);
  return changed ? { status: 204, body: null } : json(409, { error: 'not_applicable' });
}

async function heartbeat(gatewayId: string, body: Record<string, unknown>, deps: WorkerDeps): Promise<WorkerResponse> {
  const status: Record<string, unknown> = {};
  for (const [field, type] of Object.entries(HEARTBEAT_FIELDS)) {
    const value = body[field];
    if (typeof value === type) status[field] = type === 'string' ? String(value).slice(0, APP_VERSION_MAX) : value;
  }
  await deps.heartbeat(gatewayId, status);
  return json(200, { pullEveryS: GATEWAY_PULL_S });
}
