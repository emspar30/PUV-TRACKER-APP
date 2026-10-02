// Where screens get route geometry from. Today this is the placeholder seed;
// S3 replaces the bodies with reads from the local SQLite database, and callers do not change.

import type { Position } from 'geojson';

import { R4_LINES } from './seed/r4.placeholder';

export type RouteLine = {
  // One directed line of a route, for example the outbound line
  id: string;
  color: string;
  // GeoJSON order: [longitude, latitude]
  coordinates: Position[];
};

export function getRouteLines(): RouteLine[] {
  return R4_LINES.map((line) => ({ id: line.routeId, color: line.routeColor, coordinates: line.coordinates }));
}

export function getRouteLineCoordinates(): Position[][] {
  return getRouteLines().map((line) => line.coordinates);
}
