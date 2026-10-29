// CA1.1: "Did you board?" during a check-in. A multicab of a pinged route that stands at the
// check-in's stop is the moment to ask: Live (a fresh packet), not hidden, within
// CHECKIN_BOARD_NEAR_M of the stop, under STATIONARY_SPEED_KMH, and seen standing there for
// CHECKIN_BOARD_DWELL_S on this phone. Each multicab is asked about once. Pure: time is passed in.

import { CHECKIN_BOARD_DWELL_S, CHECKIN_BOARD_NEAR_M, COVERAGE_LIVE_MAX_AGE_S, STATIONARY_SPEED_KMH } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { ageSeconds } from '../telemetry/coverage';
import type { VehicleSnapshot } from '../telemetry/vehicle';

const MS_PER_S = 1000;

// When each multicab was first seen standing at the stop (epoch ms), by vehicle id
export type StandingSince = Readonly<Record<string, number>>;

// CA2b: where to look for the multicab: where the commuter checked in, else (an older record, or no
// position then) the stop
export function boardingPlace(checkIn: { point?: LatLon }, stop: LatLon): LatLon {
  return checkIn.point ?? stop;
}

export function standingAtStop(
  vehicles: readonly VehicleSnapshot[],
  stop: LatLon,
  routeCodes: readonly string[],
  nowMs: number,
): VehicleSnapshot[] {
  return vehicles.filter(
    (vehicle) =>
      routeCodes.includes(vehicle.routeCode) &&
      !vehicle.hidden &&
      ageSeconds(vehicle.lastPacketMs, nowMs) <= COVERAGE_LIVE_MAX_AGE_S &&
      vehicle.speedKmh < STATIONARY_SPEED_KMH &&
      haversineMeters(vehicle, stop) <= CHECKIN_BOARD_NEAR_M,
  );
}

// The multicabs standing now, with when each was first seen so (one that left starts again), and
// the first that has stood long enough and was not asked about yet, or null
export function boardingCandidate(
  standing: readonly VehicleSnapshot[],
  since: StandingSince,
  asked: readonly string[],
  nowMs: number,
): { since: StandingSince; ask: VehicleSnapshot | null } {
  const next: Record<string, number> = {};
  for (const vehicle of standing) next[vehicle.id] = since[vehicle.id] ?? nowMs;
  const ask = standing.find((vehicle) => !asked.includes(vehicle.id) && nowMs - next[vehicle.id] >= CHECKIN_BOARD_DWELL_S * MS_PER_S) ?? null;
  return { since: next, ask };
}
