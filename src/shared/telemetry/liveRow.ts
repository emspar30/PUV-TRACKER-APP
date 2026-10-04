// Turns a telemetry_latest row (L1) into the VehicleSnapshot the Live tab already draws for demo
// vehicles. Pure: no React Native or Expo imports.

import { LIVE_HEADING_PROBE_M, LIVE_LINE_TIE_M, LIVE_SPEED_HISTORY_S } from '../config';
import { pointAtChainage, projectOntoLine } from '../geo/line';
import type { DirectedLine } from '../routing/types';
import type { VehicleSnapshot } from './vehicle';

// The columns the app reads from public.telemetry_latest
export type LiveRow = {
  vehicle_id: string;
  lat: number;
  lon: number;
  speed_kmh: number;
  heading_deg: number;
  seats_taken: number;
  // ISO time the position was measured
  packet_ts: string;
};

export const LIVE_ROW_COLUMNS = 'vehicle_id, lat, lon, speed_kmh, heading_deg, seats_taken, packet_ts';

const MS_PER_S = 1000;
const M_PER_KM = 1000;
const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;
const DEG_TO_RAD = Math.PI / HALF_TURN_DEG;

function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const raw = Math.atan2((b.lon - a.lon) * Math.cos(a.lat * DEG_TO_RAD), b.lat - a.lat) / DEG_TO_RAD;
  return (raw + FULL_TURN_DEG) % FULL_TURN_DEG;
}

// Smallest angle between two headings, 0 to 180
export function headingGapDeg(a: number, b: number): number {
  const gap = Math.abs(a - b) % FULL_TURN_DEG;
  return gap > HALF_TURN_DEG ? FULL_TURN_DEG - gap : gap;
}

// The route line the vehicle is on: the nearest one, and where two lines share a street (within
// LIVE_LINE_TIE_M of the nearest), the one whose direction matches the vehicle's heading.
export function matchLine(
  lines: readonly DirectedLine[],
  routeCode: string,
  point: { lat: number; lon: number },
  headingDeg: number,
): DirectedLine | null {
  const candidates = lines
    .filter((line) => line.routeCode === routeCode)
    .map((line) => ({ line, projection: projectOntoLine(line.coordinates, point) }));
  if (candidates.length === 0) return null;
  const nearestM = Math.min(...candidates.map((candidate) => candidate.projection.offsetM));
  const close = candidates.filter((candidate) => candidate.projection.offsetM <= nearestM + LIVE_LINE_TIE_M);
  const probeKm = LIVE_HEADING_PROBE_M / M_PER_KM;
  const gap = ({ line, projection }: (typeof close)[number]) => {
    const from = pointAtChainage(line.coordinates, Math.max(0, projection.chainageKm - probeKm));
    const to = pointAtChainage(line.coordinates, projection.chainageKm + probeKm);
    return headingGapDeg(bearingDeg(from, to), headingDeg);
  };
  return close.reduce((best, candidate) => (gap(candidate) < gap(best) ? candidate : best)).line;
}

// previous: this vehicle's last snapshot, whose speeds are kept for the stopped check
export function rowToSnapshot(
  row: LiveRow,
  routeCode: string,
  lines: readonly DirectedLine[],
  previous?: VehicleSnapshot,
): VehicleSnapshot | null {
  const line = matchLine(lines, routeCode, row, row.heading_deg);
  const packetMs = Date.parse(row.packet_ts);
  if (!line || Number.isNaN(packetMs)) return null;
  const keepFromMs = packetMs - LIVE_SPEED_HISTORY_S * MS_PER_S;
  const earlier = (previous?.recentSpeeds ?? []).filter((sample) => sample.atMs < packetMs && sample.atMs >= keepFromMs);
  return {
    id: row.vehicle_id,
    label: row.vehicle_id,
    routeCode,
    lineId: line.id,
    lat: row.lat,
    lon: row.lon,
    headingDeg: row.heading_deg,
    speedKmh: row.speed_kmh,
    seatsTaken: row.seats_taken,
    lastPacketMs: packetMs,
    recentSpeeds: [...earlier, { atMs: packetMs, speedKmh: row.speed_kmh }],
    demo: false,
  };
}
