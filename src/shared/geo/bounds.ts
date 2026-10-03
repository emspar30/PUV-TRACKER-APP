import type { LatLon } from './haversine';

// A box in GeoJSON order: west, south, east, north
export type Bounds = readonly [west: number, south: number, east: number, north: number];

// True if the point lies inside the box, edges included
export function containsPoint(bounds: Bounds, p: LatLon): boolean {
  const [west, south, east, north] = bounds;
  return p.lon >= west && p.lon <= east && p.lat >= south && p.lat <= north;
}
