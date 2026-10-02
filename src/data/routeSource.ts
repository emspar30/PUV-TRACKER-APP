// Where screens get route geometry and stops from. Today this is the placeholder seed;
// S3 replaces the bodies with reads from the local SQLite database, and callers do not change.

import type { Position } from 'geojson';

import { R4_LINES, R4_STATIONS, ROUTE_DATA_IS_PLACEHOLDER, type SeedDirection } from './seed/r4.placeholder';

export type RouteDirection = SeedDirection;

export type RouteLine = {
  // One directed line of a route, for example the outbound line
  id: string;
  routeCode: string;
  direction: RouteDirection;
  name: string;
  color: string;
  // GeoJSON order: [longitude, latitude], in the direction of travel
  coordinates: Position[];
};

export type RouteStop = {
  code: string;
  name: string;
  lat: number;
  lon: number;
};

export function getRouteLines(): RouteLine[] {
  return R4_LINES.map((line) => ({
    id: line.routeId,
    routeCode: line.routeCode,
    direction: line.direction,
    name: line.routeName,
    color: line.routeColor,
    coordinates: line.coordinates,
  }));
}

export function getRouteLineCoordinates(): Position[][] {
  return getRouteLines().map((line) => line.coordinates);
}

export function getRouteStops(): RouteStop[] {
  return R4_STATIONS.map((station) => ({ ...station }));
}

export function isPlaceholderRouteData(): boolean {
  return ROUTE_DATA_IS_PLACEHOLDER;
}
