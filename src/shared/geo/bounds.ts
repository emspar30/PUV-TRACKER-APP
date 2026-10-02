import type { Position } from 'geojson';

// [west, south, east, north], the order GeoJSON and MapLibre use
export type Bounds = [west: number, south: number, east: number, north: number];

// Smallest box that contains every coordinate of the given lines ([longitude, latitude] order)
export function boundsOfLines(lines: Position[][]): Bounds {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const line of lines) {
    for (const [lon, lat] of line) {
      west = Math.min(west, lon);
      south = Math.min(south, lat);
      east = Math.max(east, lon);
      north = Math.max(north, lat);
    }
  }

  if (!Number.isFinite(west)) throw new RangeError('boundsOfLines needs at least one coordinate');
  return [west, south, east, north];
}

export function boundsContain(outer: Bounds, inner: Bounds): boolean {
  const [ow, os, oe, on] = outer;
  const [iw, is, ie, inn] = inner;
  return iw >= ow && is >= os && ie <= oe && inn <= on;
}
