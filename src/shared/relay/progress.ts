// CA1.1 relay info: how far a sharing rider is from the destination they picked, how much of the
// ride is done, about how long is left, and how long the sharing has run. Distances follow the route
// line when the rider and the destination are both on it (the destination ahead), else a straight
// line. Pure: no React Native or Expo imports.

import { ETA_MIN_SPEED_KMH, RELAY_PROGRESS_SNAP_M } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import type { Position } from 'geojson';

import { projectOntoLine, sliceCoordinates, type LineCoordinates } from '../geo/line';

import type { RelayBroadcast } from './broadcast';
import { askInMin } from './limits';

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
  // Whole minutes since sharing started, and until "Still riding?" is asked (RL1)
  sharedMin: number;
  askInMin: number;
};

type RoutePart = { line: LineCoordinates; fromKm: number; toKm: number };

// The shortest part of one of the route's lines from `from` to `to`, where both lie on the line
// (within RELAY_PROGRESS_SNAP_M) with `to` ahead; null when no line has both
function routePart(lines: readonly LineCoordinates[], from: LatLon, to: LatLon): RoutePart | null {
  let best: RoutePart | null = null;
  for (const line of lines) {
    if (line.length < MIN_LINE_POINTS) continue;
    const a = projectOntoLine(line, from);
    const b = projectOntoLine(line, to);
    if (a.offsetM > RELAY_PROGRESS_SNAP_M || b.offsetM > RELAY_PROGRESS_SNAP_M || b.chainageKm < a.chainageKm) continue;
    if (best === null || b.chainageKm - a.chainageKm < best.toKm - best.fromKm) best = { line, fromKm: a.chainageKm, toKm: b.chainageKm };
  }
  return best;
}

// Metres along one of the route's lines from `from` to `to` (routePart); null when no line has both
export function alongRouteM(lines: readonly LineCoordinates[], from: LatLon, to: LatLon): number | null {
  const part = routePart(lines, from, to);
  return part ? (part.toKm - part.fromKm) * M_PER_KM : null;
}

// Tester note (2026-11-13): the ride left to the destination, drawn on the Map during a relay like a
// directions line. The same part of the same line as "km to go"; null when it cannot be told
export function alongRoutePath(lines: readonly LineCoordinates[], from: LatLon, to: LatLon): Position[] | null {
  const part = routePart(lines, from, to);
  if (!part) return null;
  const coordinates = sliceCoordinates(part.line, part.fromKm, part.toKm);
  return coordinates.length >= MIN_LINE_POINTS ? coordinates : null;
}

export function relayProgress(input: {
  session: RelayBroadcast;
  position: LatLon | null;
  // The route's lines, both directions
  lines: readonly LineCoordinates[];
  speedKmh: number | null;
  // RL1: when the cap's hours started (the start, or the last "Keep sharing")
  capFromMs: number;
  nowMs: number;
}): RelayProgress {
  const { session, position, lines, speedKmh, capFromMs, nowMs } = input;
  const sharedMin = Math.floor(Math.max(0, nowMs - session.startedMs) / MS_PER_MIN);
  const askIn = askInMin(capFromMs, nowMs);
  if (!position) return { leftM: null, byRoad: false, done: null, etaMin: null, sharedMin, askInMin: askIn };
  const road = alongRouteM(lines, position, session.destination);
  const leftM = road ?? haversineMeters(position, session.destination);
  let done: number | null = null;
  if (session.startPoint) {
    const totalM = alongRouteM(lines, session.startPoint, session.destination) ?? haversineMeters(session.startPoint, session.destination);
    done = totalM > 0 ? Math.min(Math.max(1 - leftM / totalM, 0), 1) : 1;
  }
  const etaMin = speedKmh !== null && speedKmh >= ETA_MIN_SPEED_KMH ? Math.max(1, Math.round((leftM / M_PER_KM / speedKmh) * MIN_PER_HOUR)) : null;
  return { leftM: Math.round(leftM), byRoad: road !== null, done, etaMin, sharedMin, askInMin: askIn };
}
