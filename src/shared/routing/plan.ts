import { MAX_WALK_PER_LEG_M } from '../config';
import { computeFare, type FareResult } from '../fare/fare';
import type { LatLon } from '../geo/haversine';
import { isAhead, projectOntoLine, sliceLengthKm } from '../geo/line';

import type { DirectedLine, RouteDirection } from './types';

const METERS_PER_KM = 1000;

export type WalkLeg = {
  kind: 'walk';
  from: LatLon;
  to: LatLon;
  distanceM: number;
};

export type RideLeg = {
  kind: 'ride';
  lineId: string;
  routeCode: string;
  direction: RouteDirection;
  // Where the rider boards and alights: the origin and destination snapped to the line
  from: LatLon;
  to: LatLon;
  boardChainageKm: number;
  alightChainageKm: number;
  // Authorized route-slice distance. The fare is computed from this, never from the walks.
  distanceKm: number;
};

// PRD 7.2: with one route there are no transfers, so an itinerary is always walk, ride, walk
export type Itinerary = {
  legs: [WalkLeg, RideLeg, WalkLeg];
  rideKm: number;
  walkM: number;
};

export type PlanFailure =
  // No route line passes within the walking limit of the origin
  | 'origin_too_far'
  // A line is in reach of the origin, but none is in reach of the destination too
  | 'destination_too_far'
  // Both ends are in reach, but on every such line the destination is not ahead of the origin
  | 'destination_not_ahead'
  | 'no_routes';

export type PlanResult = { ok: true; itinerary: Itinerary } | { ok: false; reason: PlanFailure };

export type PlanOptions = {
  maxWalkM?: number;
};

// Offline trip planner (PRD 7.2). Riders may board and alight anywhere along a line:
// origin and destination are snapped to each directed line, each within the walking limit,
// and a line is usable only if the destination lies ahead of the origin in its direction of travel.
export function planTrip(
  lines: DirectedLine[],
  origin: LatLon,
  destination: LatLon,
  options: PlanOptions = {},
): PlanResult {
  const maxWalkM = options.maxWalkM ?? MAX_WALK_PER_LEG_M;
  if (lines.length === 0) return { ok: false, reason: 'no_routes' };

  let best: Itinerary | null = null;
  let originInReach = false;
  let bothInReach = false;

  for (const line of lines) {
    const board = projectOntoLine(line.coordinates, origin);
    if (board.offsetM > maxWalkM) continue;
    originInReach = true;

    const alight = projectOntoLine(line.coordinates, destination);
    if (alight.offsetM > maxWalkM) continue;
    bothInReach = true;

    if (!isAhead(board.chainageKm, alight.chainageKm)) continue;

    const rideKm = sliceLengthKm(board.chainageKm, alight.chainageKm);
    const candidate: Itinerary = {
      legs: [
        { kind: 'walk', from: origin, to: board.snapped, distanceM: board.offsetM },
        {
          kind: 'ride',
          lineId: line.id,
          routeCode: line.routeCode,
          direction: line.direction,
          from: board.snapped,
          to: alight.snapped,
          boardChainageKm: board.chainageKm,
          alightChainageKm: alight.chainageKm,
          distanceKm: rideKm,
        },
        { kind: 'walk', from: alight.snapped, to: destination, distanceM: alight.offsetM },
      ],
      rideKm,
      walkM: board.offsetM + alight.offsetM,
    };

    if (!best || totalMeters(candidate) < totalMeters(best)) best = candidate;
  }

  if (best) return { ok: true, itinerary: best };
  if (!originInReach) return { ok: false, reason: 'origin_too_far' };
  if (!bothInReach) return { ok: false, reason: 'destination_too_far' };
  return { ok: false, reason: 'destination_not_ahead' };
}

// Ranking: shortest trip overall, counting the ride and both walks
function totalMeters(itinerary: Itinerary): number {
  return itinerary.rideKm * METERS_PER_KM + itinerary.walkM;
}

// Fare for an itinerary: route-slice distance, the ridden line's fare parameters, and the rider's multiplier
export function fareForItinerary(lines: DirectedLine[], itinerary: Itinerary, multiplier: number): FareResult {
  const ride = itinerary.legs[1];
  const line = lines.find((candidate) => candidate.id === ride.lineId);
  if (!line) throw new Error(`Unknown route line: ${ride.lineId}`);
  return computeFare(ride.distanceKm, line.fare, multiplier);
}
