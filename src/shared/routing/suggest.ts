// F3: which routes serve a frequent destination (PRD 19, D4). A route serves a place when one of
// its lines passes within the walking limit; the best route for a trip is the planner's first
// option. Placeholder landmarks for now (the stops); the rule is the same for real ones. Pure.

import { MAX_WALK_PER_LEG_M, PLACE_ID_DECIMALS } from '../config';
import type { LatLon } from '../geo/haversine';
import { projectOntoLine } from '../geo/line';
import { planOptions } from './plan';
import type { DirectedLine } from './types';

export type RouteNear = { routeCode: string; walkM: number };

// The routes passing within maxWalkM of the place, nearest first (by name when equally near)
export function routesNear(lines: readonly DirectedLine[], place: LatLon, maxWalkM = MAX_WALK_PER_LEG_M): RouteNear[] {
  const best = new Map<string, number>();
  for (const line of lines) {
    if (line.coordinates.length === 0) continue;
    const walkM = projectOntoLine(line.coordinates, place).offsetM;
    if (walkM > maxWalkM) continue;
    const known = best.get(line.routeCode);
    if (known === undefined || walkM < known) best.set(line.routeCode, walkM);
  }
  return [...best.entries()]
    .map(([routeCode, walkM]) => ({ routeCode, walkM: Math.round(walkM) }))
    .sort((a, b) => a.walkM - b.walkM || a.routeCode.localeCompare(b.routeCode));
}

// The route to take from `from` to the place: the planner's shortest option, or null
export function suggestRoute(lines: DirectedLine[], from: LatLon, to: LatLon): string | null {
  return planOptions(lines, from, to)[0]?.legs[1].routeCode ?? null;
}

// A saved map point's id: its rounded position, so saving the same point twice is a duplicate
export function placeIdOf(point: LatLon): string {
  return `place-${point.lat.toFixed(PLACE_ID_DECIMALS)}-${point.lon.toFixed(PLACE_ID_DECIMALS)}`;
}
