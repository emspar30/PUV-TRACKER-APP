// The telemetry packet a broadcasting phone (or the simulator) sends, and its validator.
// Pure TypeScript: shared by the ingest Edge Function and the app.

import {
  PACKET_BACKLOG_MAX_AGE_S,
  PACKET_MAX_AGE_S,
  PACKET_MAX_FUTURE_S,
  PACKET_MAX_SPEED_KMH,
  TELEMETRY_BATCH_MAX_POINTS,
  VEHICLE_CAPACITY_SEATS,
} from './serverConfig.ts';

// PRD 8.4: vehicle ID, position, speed, heading, seats and timestamp, and nothing else.
// The packet carries no rider identity of any kind.
export type TelemetryPacket = {
  vehicle_id: string;
  lat: number;
  lon: number;
  // km/h
  speed: number;
  // Degrees clockwise from north, 0 up to but not including 360
  heading: number;
  // Seats taken
  seats: number;
  // When the position was measured, in seconds since 1970 (UTC)
  ts: number;
};

export type PacketError =
  | 'not_an_object'
  | 'unknown_field'
  | 'missing_field'
  | 'bad_vehicle_id'
  | 'bad_lat'
  | 'bad_lon'
  | 'bad_speed'
  | 'bad_heading'
  | 'bad_seats'
  | 'bad_ts'
  | 'too_old'
  | 'in_future'
  | 'bad_points';

export type PacketValidation =
  | { ok: true; packet: TelemetryPacket }
  | { ok: false; error: PacketError; field?: string };

const FIELDS = ['vehicle_id', 'lat', 'lon', 'speed', 'heading', 'seats', 'ts'] as const;
const VEHICLE_ID_RE = /^[A-Z0-9][A-Z0-9-]{0,23}$/;
const MAX_LAT = 90;
const MAX_LON = 180;
const FULL_TURN_DEG = 360;

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

// nowS: the server's current time in seconds since 1970. maxAgeS: how old a position may be (a
// batch's buffered positions may be older than a live packet).
export function validatePacket(input: unknown, nowS: number, maxAgeS = PACKET_MAX_AGE_S): PacketValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'not_an_object' };
  }
  const record = input as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!(FIELDS as readonly string[]).includes(key)) return { ok: false, error: 'unknown_field', field: key };
  }
  for (const key of FIELDS) {
    if (!(key in record)) return { ok: false, error: 'missing_field', field: key };
  }

  const { vehicle_id, lat, lon, speed, heading, seats, ts } = record;

  if (typeof vehicle_id !== 'string' || !VEHICLE_ID_RE.test(vehicle_id)) return { ok: false, error: 'bad_vehicle_id' };
  if (!isNumber(lat) || Math.abs(lat) > MAX_LAT) return { ok: false, error: 'bad_lat' };
  if (!isNumber(lon) || Math.abs(lon) > MAX_LON) return { ok: false, error: 'bad_lon' };
  if (!isNumber(speed) || speed < 0 || speed > PACKET_MAX_SPEED_KMH) return { ok: false, error: 'bad_speed' };
  if (!isNumber(heading) || heading < 0 || heading >= FULL_TURN_DEG) return { ok: false, error: 'bad_heading' };
  if (!isNumber(seats) || !Number.isInteger(seats) || seats < 0 || seats > VEHICLE_CAPACITY_SEATS) {
    return { ok: false, error: 'bad_seats' };
  }
  if (!isNumber(ts) || ts <= 0) return { ok: false, error: 'bad_ts' };
  if (ts < nowS - maxAgeS) return { ok: false, error: 'too_old' };
  if (ts > nowS + PACKET_MAX_FUTURE_S) return { ok: false, error: 'in_future' };

  return { ok: true, packet: { vehicle_id, lat, lon, speed, heading, seats, ts } };
}

const COORDINATE_DECIMALS = 6;
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

// The JSON a sender puts on the wire. Rounded so it stays under the packet size limit:
// six decimals of a degree is about 0.1 m.
export function encodePacket(packet: TelemetryPacket): string {
  return JSON.stringify({
    vehicle_id: packet.vehicle_id,
    lat: round(packet.lat, COORDINATE_DECIMALS),
    lon: round(packet.lon, COORDINATE_DECIMALS),
    speed: round(packet.speed, 1),
    heading: round(packet.heading, 0) % FULL_TURN_DEG,
    seats: packet.seats,
    ts: Math.round(packet.ts),
  });
}

// T1: the store-and-forward batch a broadcasting phone sends (PRD 8.4). One vehicle, and its buffered
// positions as short arrays, so a full buffer stays near 2.5 KB:
//   {"v":"R4-TEST-01","p":[[ts,lat,lon,speed,heading,seats],...]}
// The fields mean what they mean in TelemetryPacket, and the batch carries no rider identity either.
export type TelemetryBatch = { vehicle_id: string; points: TelemetryPacket[] };

export type BatchValidation =
  | { ok: true; batch: TelemetryBatch; tooOld: number }
  | { ok: false; error: PacketError; field?: string };

const BATCH_FIELDS = ['v', 'p'] as const;
const POINT_LENGTH = 6;

// A body with a "p" field is a batch; anything else is a single packet
export function isBatch(input: unknown): boolean {
  return typeof input === 'object' && input !== null && !Array.isArray(input) && 'p' in input;
}

// Each position is checked like a single packet, but may be up to PACKET_BACKLOG_MAX_AGE_S old.
// Older positions are left out and counted (the phone kept them too long); any other bad position
// rejects the whole batch. The positions come back oldest first, one per timestamp.
export function validateBatch(input: unknown, nowS: number): BatchValidation {
  if (!isBatch(input)) return { ok: false, error: 'not_an_object' };
  const record = input as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!(BATCH_FIELDS as readonly string[]).includes(key)) return { ok: false, error: 'unknown_field', field: key };
  }
  for (const key of BATCH_FIELDS) {
    if (!(key in record)) return { ok: false, error: 'missing_field', field: key };
  }

  const points = record.p;
  if (!Array.isArray(points) || points.length === 0 || points.length > TELEMETRY_BATCH_MAX_POINTS) {
    return { ok: false, error: 'bad_points' };
  }

  const byTs = new Map<number, TelemetryPacket>();
  let tooOld = 0;
  for (const [index, point] of points.entries()) {
    const field = `p.${index}`;
    if (!Array.isArray(point) || point.length !== POINT_LENGTH) return { ok: false, error: 'bad_points', field };
    const [ts, lat, lon, speed, heading, seats] = point as unknown[];
    const result = validatePacket({ vehicle_id: record.v, lat, lon, speed, heading, seats, ts }, nowS, PACKET_BACKLOG_MAX_AGE_S);
    if (!result.ok && result.error === 'too_old') {
      tooOld += 1;
      continue;
    }
    if (!result.ok) return { ok: false, error: result.error, field };
    byTs.set(result.packet.ts, result.packet);
  }

  const sorted = [...byTs.values()].sort((a, b) => a.ts - b.ts);
  const vehicleId = record.v as string;
  return { ok: true, batch: { vehicle_id: vehicleId, points: sorted }, tooOld };
}

// Five decimals of a degree is about 1 m, plenty for a marker, and keeps the batch small
const BATCH_COORDINATE_DECIMALS = 5;

// The JSON of a batch, oldest position first
export function encodeBatch(vehicleId: string, points: readonly TelemetryPacket[]): string {
  return JSON.stringify({
    v: vehicleId,
    p: points.map((point) => [
      Math.round(point.ts),
      round(point.lat, BATCH_COORDINATE_DECIMALS),
      round(point.lon, BATCH_COORDINATE_DECIMALS),
      round(point.speed, 1),
      round(point.heading, 0) % FULL_TURN_DEG,
      point.seats,
    ]),
  });
}
