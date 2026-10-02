// The rules of the telemetry ingest endpoint, with every database and auth call passed in.
// Pure TypeScript: the Edge Function wires it to Supabase, and unit tests wire it to fakes.

import { validatePacket, type PacketError } from './packet.ts';
import { PACKET_MAX_BYTES, STATIONARY_SPEED_KMH } from './serverConfig.ts';
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

export type IngestResponse =
  | { status: 200; body: { status: 'accepted'; verified: boolean; verification_reasons: string[] } }
  | { status: 200; body: { status: 'ignored'; reason: 'not_newer' } }
  | { status: 400 | 401 | 403 | 404 | 405 | 413; body: { error: IngestError; field?: string } };

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

export async function handleIngest(request: IngestRequest, deps: IngestDeps): Promise<IngestResponse> {
  if (request.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } };

  // 1. Who is calling: the signed-in user's access token, never the publishable key
  const token = BEARER_RE.exec(request.authorization ?? '')?.[1];
  if (!token) return { status: 401, body: { error: 'unauthorized' } };
  const userId = await deps.getUserId(token);
  if (!userId) return { status: 401, body: { error: 'unauthorized' } };

  // 2. Verification is off in v0, so only team accounts on the allowlist may write (PRD 0.7 safety rule)
  if (!(await deps.isAllowedWriter(userId))) return { status: 403, body: { error: 'forbidden' } };

  const reject = async (
    status: 400 | 404 | 413,
    error: IngestError,
    vehicleId: string | null,
    field?: string,
  ): Promise<IngestResponse> => {
    await deps.log({ user_id: userId, vehicle_id: vehicleId, accepted: false, reason: error });
    return { status, body: field ? { error, field } : { error } };
  };

  // 3. The packet itself
  if (utf8Bytes(request.body) > PACKET_MAX_BYTES) return reject(413, 'packet_too_large', null);

  let parsed: unknown;
  try {
    parsed = JSON.parse(request.body);
  } catch {
    return reject(400, 'invalid_json', null);
  }

  const nowMs = deps.nowMs();
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
  const stopped = packet.speed < STATIONARY_SPEED_KMH;
  const stoppedSince = stopped ? (latest?.stopped_since ?? packetTime.toISOString()) : null;

  // 6. Verification hook: always "unverified" while verification is off
  const verification = verifyReport(packet);

  await deps.upsertLatest({
    vehicle_id: packet.vehicle_id,
    lat: packet.lat,
    lon: packet.lon,
    speed_kmh: packet.speed,
    heading_deg: packet.heading,
    seats_taken: packet.seats,
    packet_ts: packetTime.toISOString(),
    stopped_since: stoppedSince,
    verified: verification.status === 'verified',
    verification_reasons: verification.reasons,
  });
  await deps.log({ user_id: userId, vehicle_id: packet.vehicle_id, accepted: true, reason: 'accepted' });

  return {
    status: 200,
    body: {
      status: 'accepted',
      verified: verification.status === 'verified',
      verification_reasons: verification.reasons,
    },
  };
}
