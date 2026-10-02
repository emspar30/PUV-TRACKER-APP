// The route data that ships with the app, in the shape the rest of the app uses.
// It is written into the local SQLite database on first launch (src/data/db/migrate.ts);
// screens read it back from the database through useRouteData().
// Pure data access: no React Native or Expo imports.

import type { RouteData } from '../shared/routing/types';

import { R4_LINES, R4_STATIONS, ROUTE_DATA_IS_PLACEHOLDER, ROUTE_DATA_VERSION } from './seed/r4.placeholder';

export function getSeedRouteData(): RouteData {
  return {
    version: ROUTE_DATA_VERSION,
    isPlaceholder: ROUTE_DATA_IS_PLACEHOLDER,
    lines: R4_LINES.map((line) => ({
      id: line.routeId,
      routeCode: line.routeCode,
      direction: line.direction,
      directionMode: line.directionMode,
      name: line.routeName,
      color: line.routeColor,
      coordinates: line.coordinates,
      fare: { baseFare: line.baseFare, baseKm: line.baseKm, perKmRate: line.perKmRate },
    })),
    stops: R4_STATIONS.map((station) => ({ ...station })),
  };
}
