// CF1 smart alternatives: when the picked route has no Live vehicle, another route that overlaps it
// (shares a stop) and has a Live vehicle nearby is suggested instead, for example R5 for R4.
// "Nearby" is within ALTERNATIVE_NEARBY_M of the commuter, on a route they can walk to; without a
// position, within that distance of a stop the two routes share. Pure: no React Native or Expo imports.

import { ALTERNATIVE_NEARBY_M, MAX_WALK_PER_LEG_M } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { ageSeconds, coverageOf } from '../telemetry/coverage';
import type { VehicleSnapshot } from '../telemetry/vehicle';
import { routesNear } from './suggest';
import type { DirectedLine, RouteStop } from './types';

export type Alternative = { routeCode: string; distanceM: number };

// The other routes that share at least one stop with the route, by name
export function overlappingRoutes(stops: readonly RouteStop[], routeCode: string): string[] {
  const codes = new Set<string>();
  for (const stop of stops) {
    if (!stop.routeCodes?.includes(routeCode)) continue;
    for (const code of stop.routeCodes) if (code !== routeCode) codes.add(code);
  }
  return [...codes].sort((a, b) => a.localeCompare(b));
}

// The overlapping route with the nearest Live vehicle, or null when none is near enough
export function bestAlternative(options: {
  routeCode: string;
  lines: readonly DirectedLine[];
  stops: readonly RouteStop[];
  vehicles: readonly VehicleSnapshot[];
  nowMs: number;
  anchor: LatLon | null;
}): Alternative | null {
  const { routeCode, lines, stops, vehicles, nowMs, anchor } = options;
  let candidates = new Set(overlappingRoutes(stops, routeCode));
  let points: LatLon[];
  if (anchor) {
    const reachable = new Set(routesNear(lines, anchor, MAX_WALK_PER_LEG_M).map((near) => near.routeCode));
    candidates = new Set([...candidates].filter((code) => reachable.has(code)));
    points = [anchor];
  } else {
    points = stops.filter((stop) => stop.routeCodes?.includes(routeCode));
  }
  let best: Alternative | null = null;
  for (const vehicle of vehicles) {
    if (!candidates.has(vehicle.routeCode) || vehicle.hidden) continue;
    if (coverageOf(ageSeconds(vehicle.lastPacketMs, nowMs)) !== 'live') continue;
    const distanceM = Math.min(...points.map((point) => haversineMeters(vehicle, point)));
    if (distanceM > ALTERNATIVE_NEARBY_M) continue;
    if (!best || distanceM < best.distanceM || (distanceM === best.distanceM && vehicle.routeCode.localeCompare(best.routeCode) < 0)) {
      best = { routeCode: vehicle.routeCode, distanceM: Math.round(distanceM) };
    }
  }
  return best;
}
