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

const HALF = 0.5;

// Widens a box around its centre until it spans at least `minSpanDeg` each way,
// so fitting the camera to two nearby points does not zoom in to a blur
export function withMinimumSpan(bounds: Bounds, minSpanDeg: number): Bounds {
  const [west, south, east, north] = bounds;
  const padLon = Math.max(0, minSpanDeg - (east - west)) * HALF;
  const padLat = Math.max(0, minSpanDeg - (north - south)) * HALF;
  return [west - padLon, south - padLat, east + padLon, north + padLat];
}

export function boundsContain(outer: Bounds, inner: Bounds): boolean {
  const [ow, os, oe, on] = outer;
  const [iw, is, ie, inn] = inner;
  return iw >= ow && is >= os && ie <= oe && inn <= on;
}

// The part of `inner` that lies inside `outer`. Used so the opening map view never reaches past the
// tile set, even when a route line does (R5 runs north of the current tiles, RR1).
export function clipBounds(inner: Bounds, outer: Bounds): Bounds {
  const [iw, is, ie, inn] = inner;
  const [ow, os, oe, on] = outer;
  const west = Math.max(iw, ow);
  const south = Math.max(is, os);
  const east = Math.min(ie, oe);
  const north = Math.min(inn, on);
  // No overlap: fall back to the outer box rather than an empty one
  return west < east && south < north ? [west, south, east, north] : outer;
}

// True when the point lies inside the box, edges included (for example a fix inside the offline map)
export function boundsContainPoint(bounds: Bounds, point: { lat: number; lon: number }): boolean {
  const [west, south, east, north] = bounds;
  return point.lon >= west && point.lon <= east && point.lat >= south && point.lat <= north;
}

const HALVES = 2;

// ST2-C2: where the camera centre may go: the routes' area grown by marginDeg, kept insetDeg inside
// the tiles so the screen never shows past them. A side that cannot fit is centred on the tiles.
export function panBounds(routes: Bounds, tiles: Bounds, marginDeg: number, insetDeg: number): Bounds {
  const [tw, ts, te, tn] = tiles;
  const inner: Bounds = [tw + insetDeg, ts + insetDeg, te - insetDeg, tn - insetDeg];
  const [rw, rs, re, rn] = padBounds(routes, marginDeg);
  const side = (low: number, high: number, min: number, max: number): [number, number] => {
    if (min >= max) {
      const middle = (min + max) / HALVES;
      return [middle, middle];
    }
    const a = Math.max(low, min);
    const b = Math.min(high, max);
    return a < b ? [a, b] : [min, max];
  };
  const [west, east] = side(rw, re, inner[0], inner[2]);
  const [south, north] = side(rs, rn, inner[1], inner[3]);
  return [west, south, east, north];
}

// B8: the bounds grown by marginDeg on every side
export function padBounds([west, south, east, north]: Bounds, marginDeg: number): Bounds {
  return [west - marginDeg, south - marginDeg, east + marginDeg, north + marginDeg];
}
