// T1: which of a broadcasting phone's GPS fixes become telemetry packets (PRD 8.4). A fix must pass
// the relay accuracy gate (not mocked, fresh, GPS_ACCURACY_GATE_RELAY_M or better) and be newer than
// the last packet; then one is made after POSITION_SEND_DISTANCE_M of movement or
// POSITION_SEND_INTERVAL_S, whichever comes first.

import {
  GPS_ACCURACY_GATE_RELAY_M,
  PACKET_MAX_SPEED_KMH,
  POSITION_SEND_DISTANCE_M,
  POSITION_SEND_INTERVAL_S,
  RELAY_SEATS_BY_TIER,
} from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { acceptFix, fixAgeS } from '../location/accuracyGate';

import { bearingDeg } from './liveRow';
import type { SeatTier } from './occupancy';
import type { TelemetryPacket } from './packet';

const MS_PER_S = 1000;
const KMH_PER_MPS = 3.6;
const FULL_TURN_DEG = 360;

export type BroadcastFix = LatLon & {
  accuracyM: number | null;
  headingDeg: number | null;
  speedMps: number | null;
  timestampMs: number;
  mocked: boolean;
};

export type BroadcastTarget = { vehicleId: string; seatTier: SeatTier };

const validHeading = (deg: number | null): deg is number => deg !== null && Number.isFinite(deg) && deg >= 0;

// The packet to send for this fix, or null when the fix is not good enough or not due yet
export function nextPacket(
  last: TelemetryPacket | null,
  fix: BroadcastFix,
  target: BroadcastTarget,
  nowMs: number,
): TelemetryPacket | null {
  const gate = acceptFix(
    { accuracyM: fix.accuracyM, mocked: fix.mocked, ageS: fixAgeS(fix.timestampMs, nowMs) },
    GPS_ACCURACY_GATE_RELAY_M,
  );
  if (!gate.ok) return null;

  const ts = Math.round(fix.timestampMs / MS_PER_S);
  if (last && ts <= last.ts) return null;
  const movedM = last ? haversineMeters(last, fix) : 0;
  if (last && movedM < POSITION_SEND_DISTANCE_M && ts - last.ts < POSITION_SEND_INTERVAL_S) return null;

  // Speed from the fix, else from the distance since the last packet
  const speedKmh =
    fix.speedMps !== null && Number.isFinite(fix.speedMps) && fix.speedMps >= 0
      ? fix.speedMps * KMH_PER_MPS
      : last
        ? (movedM / (ts - last.ts)) * KMH_PER_MPS
        : 0;
  // Heading from the fix, else the direction moved since the last packet, else the last heading
  const heading = validHeading(fix.headingDeg)
    ? fix.headingDeg
    : last && movedM > 0
      ? bearingDeg(last, fix)
      : (last?.heading ?? 0);

  return {
    vehicle_id: target.vehicleId,
    lat: fix.lat,
    lon: fix.lon,
    speed: Math.min(speedKmh, PACKET_MAX_SPEED_KMH),
    heading: heading % FULL_TURN_DEG,
    seats: RELAY_SEATS_BY_TIER[target.seatTier],
    ts,
  };
}
