// My Ride failure messages (Emjay, 2026-10-05). The routing is unchanged; this only says why a plan
// failed, in the rider's terms:
// - the route has the other direction mapped too: "Wrong direction for this route", with Swap;
// - the route serves both points, but the direction needed is not mapped yet: no Swap;
// - no single route serves both points: the routes near each point, as badges.

import { MAX_WALK_PER_LEG_M } from '../config';
import type { LatLon } from '../geo/haversine';
import { linePasses } from '../geo/line';
import type { PlanFailureResult } from './plan';
import type { DirectedLine } from './types';

export type FailureExplanation =
  | { kind: 'wrong_direction'; routeCode: string }
  | { kind: 'not_mapped'; routeCode: string }
  | { kind: 'different_routes'; originRoutes: string[]; destinationRoutes: string[] }
  // Keep the plan's own message (too far from every route, or no route data)
  | { kind: 'as_planned' };

function routesNear(lines: readonly DirectedLine[], point: LatLon, maxWalkM: number): string[] {
  const codes = lines.filter((line) => linePasses(line.coordinates, point, maxWalkM).passes.length > 0).map((line) => line.routeCode);
  return [...new Set(codes)];
}

export function explainFailure(
  lines: readonly DirectedLine[],
  failure: PlanFailureResult,
  origin: LatLon,
  destination: LatLon,
  maxWalkM = MAX_WALK_PER_LEG_M,
): FailureExplanation {
  if (failure.reason === 'destination_not_ahead') {
    const both = routesNear(lines, origin, maxWalkM).filter((code) => routesNear(lines, destination, maxWalkM).includes(code));
    const hasBothDirections = (code: string) =>
      ['outbound', 'return'].every((direction) => lines.some((line) => line.routeCode === code && line.direction === direction));
    const mapped = both.find(hasBothDirections);
    if (mapped) return { kind: 'wrong_direction', routeCode: mapped };
    if (both.length > 0) return { kind: 'not_mapped', routeCode: both[0] };
    return { kind: 'as_planned' };
  }
  if (failure.reason === 'destination_too_far') {
    const originRoutes = routesNear(lines, origin, maxWalkM);
    const destinationRoutes = routesNear(lines, destination, maxWalkM);
    if (originRoutes.length > 0 && destinationRoutes.length > 0) return { kind: 'different_routes', originRoutes, destinationRoutes };
  }
  return { kind: 'as_planned' };
}
