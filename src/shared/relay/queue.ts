// RL2c (Emjay's D12, 2026-10-23; PRD 10.1 steps 4 to 6, the Smart Queue): every relay is held on the
// phone after Send. At a stop a multicab is expected to load, and hearing several beacons there is
// normal, so nothing is posted or earned until the multicab leaves with the rider in it:
// - Released when exactly one beacon is heard and the rider has moved RELAY_QUEUE_RELEASE_M along
//   the route line (within ROUTE_SNAP_DISTANCE_M of it) since queuing. That beacon's multicab is the
//   one relayed, so a rider who moved to another parked multicab relays that one.
// - Two or more beacons keep it waiting; it is released on the one still heard as the other fades.
// - It ends, with nothing posted, when no beacon is heard for RELAY_QUEUE_BEACON_GONE_S (the rider
//   walked away), location goes off, RELAY_QUEUE_MAX_MIN pass, the multicab released is on another
//   route, or it was relayed within RELAY_SAME_VEHICLE_GAP_H (RL2b).
// Pure: no React Native or Expo imports.

import { relayedRecently } from '../backend/rules';
import { RELAY_QUEUE_BEACON_GONE_S, RELAY_QUEUE_MAX_MIN, RELAY_QUEUE_RELEASE_M, ROUTE_SNAP_DISTANCE_M } from '../config';
import type { LatLon } from '../geo/haversine';
import { projectOntoLine, type LineCoordinates } from '../geo/line';
import type { RelayVehicle } from './gate';

const MS_PER_S = 1000;
const MS_PER_MIN = 60_000;
const M_PER_KM = 1000;
// A line needs two points to measure along
const MIN_LINE_POINTS = 2;

export type RelayQueue = {
  routeCode: string;
  startedMs: number;
  // Where the rider was when the relay was queued
  startPoint: LatLon;
  // When a beacon was last heard
  lastHeardMs: number;
};

// The beacons heard now: none, one verified multicab, or several within the margin
export type QueueBeacons = { kind: 'none' } | { kind: 'several' } | { kind: 'one'; vehicle: RelayVehicle };

export type QueueEnd = 'walked_away' | 'location_off' | 'timed_out' | 'other_route' | 'same_vehicle';

export type QueueInput = {
  beacons: QueueBeacons;
  // The rider's position; null when location is off or no fix is usable
  position: LatLon | null;
  // The queued route's lines (both directions)
  lines: readonly LineCoordinates[];
  nowMs: number;
  // The rider's relays lately (RL2b)
  recentRelays: readonly { vehicleId: string; atMs: number }[];
};

export type QueueStep = { kind: 'waiting'; queue: RelayQueue } | { kind: 'release'; vehicle: RelayVehicle } | { kind: 'ended'; reason: QueueEnd };

export function startQueue(routeCode: string, startPoint: LatLon, nowMs: number): RelayQueue {
  return { routeCode, startedMs: nowMs, startPoint, lastHeardMs: nowMs };
}

// How far the rider has moved along one of the lines since queuing (in its riding direction); 0 when
// either point is off every line
export function movedAlongM(lines: readonly LineCoordinates[], from: LatLon, to: LatLon): number {
  let best = 0;
  for (const line of lines) {
    if (line.length < MIN_LINE_POINTS) continue;
    const start = projectOntoLine(line, from);
    const now = projectOntoLine(line, to);
    if (start.offsetM > ROUTE_SNAP_DISTANCE_M || now.offsetM > ROUTE_SNAP_DISTANCE_M) continue;
    best = Math.max(best, (now.chainageKm - start.chainageKm) * M_PER_KM);
  }
  return best;
}

export function queueStep(queue: RelayQueue, input: QueueInput): QueueStep {
  const { beacons, position, lines, nowMs, recentRelays } = input;
  if (nowMs - queue.startedMs >= RELAY_QUEUE_MAX_MIN * MS_PER_MIN) return { kind: 'ended', reason: 'timed_out' };
  if (!position) return { kind: 'ended', reason: 'location_off' };
  if (beacons.kind === 'none') {
    return nowMs - queue.lastHeardMs >= RELAY_QUEUE_BEACON_GONE_S * MS_PER_S ? { kind: 'ended', reason: 'walked_away' } : { kind: 'waiting', queue };
  }
  const heard = { ...queue, lastHeardMs: nowMs };
  if (beacons.kind === 'several' || movedAlongM(lines, queue.startPoint, position) < RELAY_QUEUE_RELEASE_M) return { kind: 'waiting', queue: heard };
  const { vehicle } = beacons;
  if (vehicle.routeCode !== queue.routeCode) return { kind: 'ended', reason: 'other_route' };
  if (relayedRecently(recentRelays, vehicle.vehicleId, nowMs)) return { kind: 'ended', reason: 'same_vehicle' };
  return { kind: 'release', vehicle };
}
