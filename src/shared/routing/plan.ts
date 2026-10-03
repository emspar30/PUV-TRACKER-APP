// Direction-aware trip planner for one route network, offline (PRD 7.2).
// The prototype has no transfers, so every trip is walk, ride, walk.

import { MAX_WALK_PER_LEG_M } from '../config';
import { computeFare, type FareParams, type FareResult } from '../fare/fare';
import type { LatLon } from '../geo/haversine';
import { isAhead, projectOntoLine, sliceLengthKm, type LineCoordinates } from '../geo/line';

// One directed line, as read from the route table
export type PlanLine = {
  routeId: string;
  routeCode: string;
  routeName: string;
  routeColor: string;
  coordinates: LineCoordinates;
  fare: FareParams;
};

export type WalkLeg = {
  kind: 'walk';
  from: LatLon;
  to: LatLon;
  distanceM: number;
};

export type RideLeg = {
  kind: 'ride';
  routeId: string;
  routeCode: string;
  routeName: string;
  routeColor: string;
  // Boarding and alighting points, snapped to the line (PRD 7.2 "Boarding and alighting")
  from: LatLon;
  to: LatLon;
  fromChainageKm: number;
  toChainageKm: number;
  // Length of the authorized route slice: the fare distance (PRD 12.4)
  distanceKm: number;
};

export type Itinerary = {
  legs: [WalkLeg, RideLeg, WalkLeg];
  walkM: number;
  fare: FareResult;
};

export type PlanFailure = 'no_routes' | 'too_far_to_walk' | 'not_ahead';

export type PlanFailureResult = {
  ok: false;
  reason: PlanFailure;
  // Straight-line distance from the origin and the destination to the nearest line, so the
  // rider can see why a trip was refused. Infinity when there are no lines.
  originToRouteM: number;
  destinationToRouteM: number;
};

export type PlanResult = { ok: true; itinerary: Itinerary } | PlanFailureResult;

type Candidate = {
  originOffsetM: number;
  destinationOffsetM: number;
  result: { ok: true; itinerary: Itinerary } | { ok: false; reason: Exclude<PlanFailure, 'no_routes'> };
};

function planOnLine(origin: LatLon, destination: LatLon, line: PlanLine, multiplier: number): Candidate {
  const board = projectOntoLine(line.coordinates, origin);
  const alight = projectOntoLine(line.coordinates, destination);
  const offsets = { originOffsetM: board.offsetM, destinationOffsetM: alight.offsetM };

  if (board.offsetM > MAX_WALK_PER_LEG_M || alight.offsetM > MAX_WALK_PER_LEG_M) {
    return { ...offsets, result: { ok: false, reason: 'too_far_to_walk' } };
  }
  if (!isAhead(board.chainageKm, alight.chainageKm)) {
    return { ...offsets, result: { ok: false, reason: 'not_ahead' } };
  }

  const distanceKm = sliceLengthKm(board.chainageKm, alight.chainageKm);
  return {
    ...offsets,
    result: {
      ok: true,
      itinerary: {
        legs: [
          { kind: 'walk', from: origin, to: board.snapped, distanceM: board.offsetM },
          {
            kind: 'ride',
            routeId: line.routeId,
            routeCode: line.routeCode,
            routeName: line.routeName,
            routeColor: line.routeColor,
            from: board.snapped,
            to: alight.snapped,
            fromChainageKm: board.chainageKm,
            toChainageKm: alight.chainageKm,
            distanceKm,
          },
          { kind: 'walk', from: alight.snapped, to: destination, distanceM: alight.offsetM },
        ],
        walkM: board.offsetM + alight.offsetM,
        fare: computeFare(distanceKm, line.fare, multiplier),
      },
    },
  };
}

// Ranked by ride distance, then walking distance (PRD 7.2 rule 6; no transfers yet)
function isBetter(a: Itinerary, b: Itinerary): boolean {
  const rideA = a.legs[1].distanceKm;
  const rideB = b.legs[1].distanceKm;
  if (rideA !== rideB) return rideA < rideB;
  return a.walkM < b.walkM;
}

export function planTrip(origin: LatLon, destination: LatLon, lines: PlanLine[], multiplier: number): PlanResult {
  let best: Itinerary | null = null;
  let walkableButBehind = false;
  let originToRouteM = Infinity;
  let destinationToRouteM = Infinity;

  for (const line of lines) {
    const { originOffsetM, destinationOffsetM, result } = planOnLine(origin, destination, line, multiplier);
    originToRouteM = Math.min(originToRouteM, originOffsetM);
    destinationToRouteM = Math.min(destinationToRouteM, destinationOffsetM);
    if (result.ok) {
      if (!best || isBetter(result.itinerary, best)) best = result.itinerary;
    } else if (result.reason === 'not_ahead') {
      walkableButBehind = true;
    }
  }

  if (best) return { ok: true, itinerary: best };
  const distances = { originToRouteM, destinationToRouteM };
  if (lines.length === 0) return { ok: false, reason: 'no_routes', ...distances };
  // "Wrong direction" is the more useful message when a line is within walking distance
  return { ok: false, reason: walkableButBehind ? 'not_ahead' : 'too_far_to_walk', ...distances };
}
