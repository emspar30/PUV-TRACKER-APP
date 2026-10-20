// The rules of the telemetry ingest endpoint, with every database and auth call passed in.
// Pure TypeScript: the Edge Function wires it to Supabase, and unit tests wire it to fakes.

import { isBatch, validateBatch, validatePacket, type PacketError, type TelemetryPacket } from './packet.ts';
import { PACKET_MAX_AGE_S, PACKET_MAX_BYTES, STATIONARY_SPEED_KMH, TELEMETRY_BATCH_MAX_BYTES } from './serverConfig.ts';
import { verifyReport } from './verifyReport.ts';

const MS_PER_S = 1000;
const BEARER_RE = /^Bearer\s+(\S+)$/i;

export type TelemetryLatestRow = {
  vehicle_id: string;
  lat: number;
  lon: number;
  speed_kmh: number;
  heading_deg: number;
  seats_taken: number;
  // ISO timestamps
  packet_ts: string;
  // Start of the current unbroken run of stopped packets, or null while moving
  stopped_since: string | null;
  verified: boolean;
  verification_reasons: string[];
};

// One row of telemetry_raw, the server-only position history (speed samples, tracing)
export type TelemetryHistoryRow = {
  vehicle_id: string;
  lat: number;
  lon: number;
  speed_kmh: number;
  // ISO timestamp
  packet_ts: string;
};

export type IngestLogEntry = {
  user_id: string;
  vehicle_id: string | null;
  accepted: boolean;
  reason: string;
};

export type IngestDeps = {
  nowMs(): number;
  // The signed-in user the access token belongs to, or null if the token is not valid
  getUserId(accessToken: string): Promise<string | null>;
  // Whether the user is on the team allowlist of telemetry writers
  isAllowedWriter(userId: string): Promise<boolean>;
  getVehicle(vehicleId: string): Promise<{ active: boolean } | null>;
  getLatest(vehicleId: string): Promise<Pick<TelemetryLatestRow, 'packet_ts' | 'stopped_since'> | null>;
  upsertLatest(row: TelemetryLatestRow): Promise<void>;
  // The newest packet_ts in the vehicle's history, or null when it has none
  getHistoryNewest(vehicleId: string): Promise<string | null>;
  // Throws when the rows could not be stored
  insertHistory(rows: TelemetryHistoryRow[]): Promise<void>;
  // Audit trail of allowlisted writers only; must not throw
  log(entry: IngestLogEntry): Promise<void>;
};

export type IngestRequest = {
  method: string;
  // Value of the Authorization header
  authorization: string | null;
  body: string;
};

export type IngestError =
  | 'method_not_allowed'
  | 'unauthorized'
  | 'forbidden'
  | 'packet_too_large'
  | 'invalid_json'
  | 'unknown_vehicle'
  | PacketError;

// What a batch did to the marker: moved it, or not, because its newest position is not newer than the
// marker's or is older than PACKET_MAX_AGE_S
export type BatchLatest = 'accepted' | 'not_newer' | 'too_old';

export type IngestResponse =
  | { status: 200; body: { status: 'accepted'; verified: boolean; verification_reasons: string[] } }
  | { status: 200; body: { status: 'ignored'; reason: 'not_newer' } }
  // stored: positions added to the history; skipped: stored already, or too old to keep
  | { status: 200; body: { status: 'batch'; stored: number; skipped: number; latest: BatchLatest } }
  | { status: 400 | 401 | 403 | 404 | 405 | 413; body: { error: IngestError; field?: string } };

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;
const isoOf = (packet: TelemetryPacket) => new Date(packet.ts * MS_PER_S).toISOString();
const historyRow = (packet: TelemetryPacket): TelemetryHistoryRow => ({
  vehicle_id: packet.vehicle_id,
  lat: packet.lat,
  lon: packet.lon,
  speed_kmh: packet.speed,
  packet_ts: isoOf(packet),
});

// The start of the current unbroken run of stopped packets after these packets (oldest first),
// carried on from `since`; null once the vehicle moves
function stoppedSinceAfter(since: string | null, packets: readonly TelemetryPacket[]): string | null {
  let current = since;
  for (const packet of packets) current = packet.speed < STATIONARY_SPEED_KMH ? (current ?? isoOf(packet)) : null;
  return current;
}

function latestRow(packet: TelemetryPacket, stoppedSince: string | null): TelemetryLatestRow {
  // Verification hook: always "unverified" while verification is off
  const verification = verifyReport(packet);
  return {
    vehicle_id: packet.vehicle_id,
    lat: packet.lat,
    lon: packet.lon,
    speed_kmh: packet.speed,
    heading_deg: packet.heading,
    seats_taken: packet.seats,
    packet_ts: isoOf(packet),
    stopped_since: stoppedSince,
    verified: verification.status === 'verified',
    verification_reasons: verification.reasons,
  };
}

type Reject = (
  status: 400 | 404 | 413,
  error: IngestError,
  vehicleId: string | null,
  field?: string,
) => Promise<IngestResponse>;

export async function handleIngest(request: IngestRequest, deps: IngestDeps): Promise<IngestResponse> {
  if (request.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } };

  // 1. Who is calling: the signed-in user's access token, never the publishable key
  const token = BEARER_RE.exec(request.authorization ?? '')?.[1];
  if (!token) return { status: 401, body: { error: 'unauthorized' } };
  const userId = await deps.getUserId(token);
  if (!userId) return { status: 401, body: { error: 'unauthorized' } };

  // 2. Verification is off in v0, so only team accounts on the allowlist may write (PRD 0.7 safety rule)
  if (!(await deps.isAllowedWriter(userId))) return { status: 403, body: { error: 'forbidden' } };

  const reject: Reject = async (status, error, vehicleId, field) => {
    await deps.log({ user_id: userId, vehicle_id: vehicleId, accepted: false, reason: error });
    return { status, body: field ? { error, field } : { error } };
  };

  // 3. The packet itself, or a batch of buffered positions (T1), which may be larger
  const bytes = utf8Bytes(request.body);
  if (bytes > TELEMETRY_BATCH_MAX_BYTES) return reject(413, 'packet_too_large', null);

  let parsed: unknown;
  try {
    parsed = JSON.parse(request.body);
  } catch {
    return reject(400, 'invalid_json', null);
  }

  const nowMs = deps.nowMs();
  if (isBatch(parsed)) return handleBatch(userId, parsed, nowMs, deps, reject);
  if (bytes > PACKET_MAX_BYTES) return reject(413, 'packet_too_large', null);

  const validation = validatePacket(parsed, nowMs / MS_PER_S);
  if (!validation.ok) return reject(400, validation.error, null, validation.field);
  const packet = validation.packet;

  const vehicle = await deps.getVehicle(packet.vehicle_id);
  if (!vehicle || !vehicle.active) return reject(404, 'unknown_vehicle', packet.vehicle_id);

  // 4. Keep only the newest position: a late or repeated packet never overwrites a newer one
  const packetTime = new Date(packet.ts * MS_PER_S);
  const latest = await deps.getLatest(packet.vehicle_id);
  if (latest && new Date(latest.packet_ts).getTime() >= packetTime.getTime()) {
    await deps.log({ user_id: userId, vehicle_id: packet.vehicle_id, accepted: false, reason: 'not_newer' });
    return { status: 200, body: { status: 'ignored', reason: 'not_newer' } };
  }

  // 5. Stopped tracking: remember when the current run of stopped packets began
  const row = latestRow(packet, stoppedSinceAfter(latest?.stopped_since ?? null, [packet]));
  await deps.upsertLatest(row);
  // SB1: every accepted position is kept for speed samples. The marker has moved already, so a
  // failed history insert does not fail the request.
  try {
    await deps.insertHistory([historyRow(packet)]);
  } catch {
    // Reported by the Edge Function
  }
  await deps.log({ user_id: userId, vehicle_id: packet.vehicle_id, accepted: true, reason: 'accepted' });

  return {
    status: 200,
    body: { status: 'accepted', verified: row.verified, verification_reasons: row.verification_reasons },
  };
}

// T1: a phone's buffered positions. Each one newer than the vehicle's history is added to it, so a
// batch sent again after a lost answer is not stored twice. The newest moves the marker only if it
// is within PACKET_MAX_AGE_S and newer than the marker. History is stored first: when anything
// fails, the phone keeps its buffer and sends it again.
async function handleBatch(
  userId: string,
  parsed: unknown,
  nowMs: number,
  deps: IngestDeps,
  reject: Reject,
): Promise<IngestResponse> {
  const validation = validateBatch(parsed, nowMs / MS_PER_S);
  if (!validation.ok) return reject(400, validation.error, null, validation.field);
  const { vehicle_id: vehicleId, points } = validation.batch;

  const vehicle = await deps.getVehicle(vehicleId);
  if (!vehicle || !vehicle.active) return reject(404, 'unknown_vehicle', vehicleId);

  const historyNewest = await deps.getHistoryNewest(vehicleId);
  const historyNewestMs = historyNewest === null ? null : new Date(historyNewest).getTime();
  const fresh = points.filter((point) => historyNewestMs === null || point.ts * MS_PER_S > historyNewestMs);
  if (fresh.length > 0) await deps.insertHistory(fresh.map(historyRow));

  const latest = await deps.getLatest(vehicleId);
  const latestMs = latest ? new Date(latest.packet_ts).getTime() : null;
  const newest = points.at(-1);
  let outcome: BatchLatest;
  if (!newest || newest.ts < nowMs / MS_PER_S - PACKET_MAX_AGE_S) outcome = 'too_old';
  else if (latestMs !== null && latestMs >= newest.ts * MS_PER_S) outcome = 'not_newer';
  else {
    const sinceMarker = points.filter((point) => latestMs === null || point.ts * MS_PER_S > latestMs);
    await deps.upsertLatest(latestRow(newest, stoppedSinceAfter(latest?.stopped_since ?? null, sinceMarker)));
    outcome = 'accepted';
  }

  await deps.log({
    user_id: userId,
    vehicle_id: vehicleId,
    accepted: fresh.length > 0 || outcome === 'accepted',
    reason: `batch_${outcome}`,
  });
  return {
    status: 200,
    body: { status: 'batch', stored: fresh.length, skipped: validation.tooOld + points.length - fresh.length, latest: outcome },
  };
}
