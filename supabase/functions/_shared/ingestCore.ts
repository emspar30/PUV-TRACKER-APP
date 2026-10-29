// The rules of the telemetry ingest endpoint, with every database and auth call passed in.
// Pure TypeScript: the Edge Function wires it to Supabase, and unit tests wire it to fakes.

import { newPassages, type PassStop } from './nodePassage.ts';
import { isBatch, validateBatch, validatePacket, type PacketError, type TelemetryPacket } from './packet.ts';
import { ROUTE_STOPS } from './routeStops.generated.ts';
import { isImpossibleJump, type TimedPoint } from './speedJump.ts';
import { NODE_PASS_GAP_MIN, PACKET_MAX_AGE_S, PACKET_MAX_BYTES, STATIONARY_SPEED_KMH, TELEMETRY_BATCH_MAX_BYTES } from './serverConfig.ts';
import { verifyReport } from './verifyReport.ts';

const MS_PER_S = 1000;
const MS_PER_MIN = 60_000;
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
  // route_id: for NM1's stop passages (absent in older fakes: no passages are recorded)
  getVehicle(vehicleId: string): Promise<{ active: boolean; route_id?: string } | null>;
  // lat and lon: for RK1's speed jump check (absent in older fakes: no check)
  getLatest(vehicleId: string): Promise<(Pick<TelemetryLatestRow, 'packet_ts' | 'stopped_since'> & Partial<Pick<TelemetryLatestRow, 'lat' | 'lon'>>) | null>;
  upsertLatest(row: TelemetryLatestRow): Promise<void>;
  // The newest packet_ts in the vehicle's history, or null when it has none
  getHistoryNewest(vehicleId: string): Promise<string | null>;
  // Throws when the rows could not be stored
  insertHistory(rows: TelemetryHistoryRow[]): Promise<void>;
  // Audit trail of allowlisted writers only; must not throw
  log(entry: IngestLogEntry): Promise<void>;
  // NM1: the vehicle's passages since `sinceIso`, and new ones to store (node_events). Optional: a
  // deployment without them records none. Their failure never fails a request.
  recentPassages?(vehicleId: string, sinceIso: string): Promise<{ stop_code: string; passed_at: string }[]>;
  insertPassages?(rows: NodeEventRow[]): Promise<void>;
  // RK1: books an impossible_speed risk event against the sender (book_risk). Optional; must not throw.
  bookRisk?(userId: string, kind: 'impossible_speed', detail: Record<string, unknown>): Promise<void>;
};

// One row of node_events: a route passed a stop (no rider, no position)
export type NodeEventRow = { vehicle_id: string; route_id: string; stop_code: string; passed_at: string };

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
  | 'impossible_speed'
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

const pointOf = (packet: TelemetryPacket): TimedPoint => ({ lat: packet.lat, lon: packet.lon, atMs: packet.ts * MS_PER_S });

// The marker's position, when the stored row has one
function markerPoint(latest: { packet_ts: string; lat?: number; lon?: number } | null): TimedPoint | null {
  if (!latest || typeof latest.lat !== 'number' || typeof latest.lon !== 'number') return null;
  return { lat: latest.lat, lon: latest.lon, atMs: new Date(latest.packet_ts).getTime() };
}

// NM1: records the stops these accepted positions passed. Best effort: the marker has moved already.
async function recordPassages(deps: IngestDeps, vehicleId: string, routeId: string | undefined, packets: readonly TelemetryPacket[]): Promise<void> {
  const stops: PassStop[] | undefined = routeId ? ROUTE_STOPS[routeId] : undefined;
  if (!stops || packets.length === 0 || !deps.recentPassages || !deps.insertPassages) return;
  try {
    const sinceIso = new Date(packets[0].ts * MS_PER_S - NODE_PASS_GAP_MIN * MS_PER_MIN).toISOString();
    const last: Record<string, number> = {};
    for (const row of await deps.recentPassages(vehicleId, sinceIso)) {
      last[row.stop_code] = Math.max(last[row.stop_code] ?? 0, new Date(row.passed_at).getTime());
    }
    const points = packets.map((packet) => ({ lat: packet.lat, lon: packet.lon, atMs: packet.ts * MS_PER_S }));
    const passages = newPassages(points, stops, last);
    if (passages.length === 0) return;
    await deps.insertPassages(
      passages.map((passage) => ({ vehicle_id: vehicleId, route_id: routeId as string, stop_code: passage.stopCode, passed_at: new Date(passage.atMs).toISOString() })),
    );
  } catch {
    // Reported by the Edge Function
  }
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

  // RK1: a position the vehicle could not have reached from its last one is refused and booked
  if (isImpossibleJump(markerPoint(latest), pointOf(packet))) {
    await deps.bookRisk?.(userId, 'impossible_speed', { vehicle_id: packet.vehicle_id });
    return reject(400, 'impossible_speed', packet.vehicle_id);
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
  await recordPassages(deps, packet.vehicle_id, vehicle.route_id, [packet]);
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
  const { vehicle_id: vehicleId, points: sent } = validation.batch;

  const vehicle = await deps.getVehicle(vehicleId);
  if (!vehicle || !vehicle.active) return reject(404, 'unknown_vehicle', vehicleId);

  // RK1: positions the vehicle could not have reached from the one before (or from the marker) are
  // dropped, and the sender is booked once
  const latest = await deps.getLatest(vehicleId);
  const marker = markerPoint(latest);
  const points: TelemetryPacket[] = [];
  let previous: TimedPoint | null = null;
  for (const point of sent) {
    const from = previous ?? (marker && marker.atMs < point.ts * MS_PER_S ? marker : null);
    if (isImpossibleJump(from, pointOf(point))) continue;
    points.push(point);
    previous = pointOf(point);
  }
  if (points.length < sent.length) await deps.bookRisk?.(userId, 'impossible_speed', { vehicle_id: vehicleId, dropped: sent.length - points.length });

  const historyNewest = await deps.getHistoryNewest(vehicleId);
  const historyNewestMs = historyNewest === null ? null : new Date(historyNewest).getTime();
  const fresh = points.filter((point) => historyNewestMs === null || point.ts * MS_PER_S > historyNewestMs);
  if (fresh.length > 0) await deps.insertHistory(fresh.map(historyRow));
  await recordPassages(deps, vehicleId, vehicle.route_id, fresh);

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
    body: { status: 'batch', stored: fresh.length, skipped: validation.tooOld + sent.length - fresh.length, latest: outcome },
  };
}
