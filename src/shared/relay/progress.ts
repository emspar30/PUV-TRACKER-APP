// CA1.1 relay info: how far a sharing rider is from the destination they picked, how much of the
// ride is done, about how long is left, and how long the sharing has run. Distances follow the route
// line when the rider and the destination are both on it (the destination ahead), else a straight
// line. Pure: no React Native or Expo imports.

import { ETA_MIN_SPEED_KMH, RELAY_BROADCAST_MAX_MIN, RELAY_PROGRESS_SNAP_M } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { projectOntoLine, type LineCoordinates } from '../geo/line';

import type { RelayBroadcast } from './broadcast';

const M_PER_KM = 1000;
const MS_PER_MIN = 60_000;
const MIN_PER_HOUR = 60;
// A line needs two points to measure along
const MIN_LINE_POINTS = 2;

export type RelayProgress = {
  // Metres left to the destination, by road when it can be told; null without a position
  leftM: number | null;
  byRoad: boolean;
  // How much of the ride from where sharing started is done, 0 to 1; null without a start point
  done: number | null;
  // Minutes left at the current speed; null when slower than ETA_MIN_SPEED_KMH (stopped, in traffic)
  etaMin: number | null;
  // Whole minutes since sharing started, and until it ends by itself (RELAY_BROADCAST_MAX_MIN)
  sharedMin: number;
  endsInMin: number;
};

// Metres along one of the route's lines from `from` to `to`, the shortest where both lie on a line
// (within RELAY_PROGRESS_SNAP_M) with `to` ahead; null when no line has both
export function alongRouteM(lines: readonly LineCoordinates[], from: LatLon, to: LatLon): number | null {
  let best: number | null = null;
  for (const line of lines) {
    if (line.length < MIN_LINE_POINTS) continue;
    const a = projectOntoLine(line, from);
    const b = projectOntoLine(line, to);
    if (a.offsetM > RELAY_PROGRESS_SNAP_M || b.offsetM > RELAY_PROGRESS_SNAP_M || b.chainageKm < a.chainageKm) continue;
    const metres = (b.chainageKm - a.chainageKm) * M_PER_KM;
    if (best === null || metres < best) best = metres;
  }
  return best;
}

export function relayProgress(input: {
  session: RelayBroadcast;
  position: LatLon | null;
  // The route's lines, both directions
  lines: readonly LineCoordinates[];
  speedKmh: number | null;
  nowMs: number;
}): RelayProgress {
  const { session, position, lines, speedKmh, nowMs } = input;
  const sharedMs = Math.max(0, nowMs - session.startedMs);
  const sharedMin = Math.floor(sharedMs / MS_PER_MIN);
  const endsInMin = Math.max(0, Math.ceil(RELAY_BROADCAST_MAX_MIN - sharedMs / MS_PER_MIN));
  if (!position) return { leftM: null, byRoad: false, done: null, etaMin: null, sharedMin, endsInMin };
  const road = alongRouteM(lines, position, session.destination);
  const leftM = road ?? haversineMeters(position, session.destination);
  let done: number | null = null;
  if (session.startPoint) {
    const totalM = alongRouteM(lines, session.startPoint, session.destination) ?? haversineMeters(session.startPoint, session.destination);
    done = totalM > 0 ? Math.min(Math.max(1 - leftM / totalM, 0), 1) : 1;
  }
  const etaMin = speedKmh !== null && speedKmh >= ETA_MIN_SPEED_KMH ? Math.max(1, Math.round((leftM / M_PER_KM / speedKmh) * MIN_PER_HOUR)) : null;
  return { leftM: Math.round(leftM), byRoad: road !== null, done, etaMin, sharedMin, endsInMin };
}
