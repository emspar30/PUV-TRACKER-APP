import { ROUTE_META, SEED_LINES, SEED_STATIONS } from '@/data/seed/routes';
import { boundsOfLines, type Bounds } from '@/shared/geo/bounds';
import type { LineCoordinates } from '@/shared/geo/line';
import { inRouteOrder } from '@/shared/relay/broadcast';
import type { RouteStop } from '@/shared/routing/types';

// DR5: the driver's route as the app ships it (src/data/seed, the same data the commuter app
// starts from): its stops in riding order for the list, and its lines and area for the static map.
// The driver phone has no data plan, so this never changes between app updates.

export type DriverRoute = {
  routeCode: string;
  // The route's name, such as "De Oro" for R4
  name: string;
  stops: RouteStop[];
  lines: LineCoordinates[];
  color: string;
  // null for a route with no line (not expected)
  bounds: Bounds | null;
};

const cache = new Map<string, DriverRoute>();

export function driverRoute(routeCode: string): DriverRoute {
  const cached = cache.get(routeCode);
  if (cached) return cached;
  const lineRows = SEED_LINES.filter((line) => line.routeCode === routeCode);
  const lines = lineRows.map((line) => line.coordinates);
  const stops = SEED_STATIONS.filter((station) => station.routeCodes.includes(routeCode));
  const route: DriverRoute = {
    routeCode,
    name: ROUTE_META[routeCode]?.name ?? '',
    stops: inRouteOrder(lines, stops),
    lines,
    color: lineRows[0]?.routeColor ?? '',
    bounds: lines.length > 0 ? boundsOfLines(lines) : null,
  };
  cache.set(routeCode, route);
  return route;
}

const ROUTE_NUMBER = /^R(\d+)$/;

// DRG4: the routes a registering driver can pick: every route the app ships a line for, in number order
export function driverRouteCodes(): string[] {
  const codes = [...new Set(SEED_LINES.map((line) => line.routeCode))];
  const number = (code: string) => Number(ROUTE_NUMBER.exec(code)?.[1] ?? Number.MAX_SAFE_INTEGER);
  return codes.sort((a, b) => number(a) - number(b));
}
