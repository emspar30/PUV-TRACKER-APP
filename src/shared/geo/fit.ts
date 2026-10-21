import type { Bounds } from './bounds';

// The driver's map (owner, 2026-10-14): the camera that frames an area in the part of the screen the
// panels leave, worked out here instead of read back from the map, so the default view, the
// zoom-out limit and the reset button always agree. Web Mercator as MapLibre draws it: at zoom z the
// world is TILE_SIZE * 2^z dp across. Pure: no React Native or MapLibre.

const TILE_SIZE = 512;
// Each zoom level doubles the scale
const ZOOM_BASE = 2;
const HALF = 0.5;
const DEG_HALF_TURN = 180;
const DEG_TURN = 360;
const TURN_RAD = ZOOM_BASE * Math.PI;
const QUARTER_TURN_RAD = (Math.PI * HALF) * HALF;
const DEG_TO_RAD = Math.PI / DEG_HALF_TURN;

export type Size = { width: number; height: number };
export type Insets = { top: number; right: number; bottom: number; left: number };
export type FitCamera = { zoom: number; center: [lon: number, lat: number] };

// Longitude and latitude to the world's unit square (x east, y south), and back
const toX = (lon: number) => (lon + DEG_HALF_TURN) / DEG_TURN;
const toY = (lat: number) => HALF - Math.log(Math.tan(QUARTER_TURN_RAD + (lat * DEG_TO_RAD) * HALF)) / TURN_RAD;
const toLon = (x: number) => x * DEG_TURN - DEG_HALF_TURN;
const toLat = (y: number) => (ZOOM_BASE * Math.atan(Math.exp((HALF - y) * TURN_RAD)) - Math.PI * HALF) / DEG_TO_RAD;
const worldSize = (zoom: number) => TILE_SIZE * ZOOM_BASE ** zoom;

// The zoom and centre that fit `bounds` inside `size` less `insets`; null when nothing is left to fit in
export function fitCamera([west, south, east, north]: Bounds, size: Size, insets: Insets): FitCamera | null {
  const width = size.width - insets.left - insets.right;
  const height = size.height - insets.top - insets.bottom;
  if (width <= 0 || height <= 0) return null;
  const spanX = Math.max(toX(east) - toX(west), Number.EPSILON);
  const spanY = Math.max(toY(south) - toY(north), Number.EPSILON);
  const zoom = Math.min(Math.log2(width / (spanX * TILE_SIZE)), Math.log2(height / (spanY * TILE_SIZE)));
  const scale = worldSize(zoom);
  // The area's middle sits in the middle of the free space; the camera centre is the screen's middle
  const middleX = (toX(west) + toX(east)) * HALF;
  const middleY = (toY(north) + toY(south)) * HALF;
  const shiftX = (size.width * HALF - (insets.left + width * HALF)) / scale;
  const shiftY = (size.height * HALF - (insets.top + height * HALF)) / scale;
  return { zoom, center: [toLon(middleX + shiftX), toLat(middleY + shiftY)] };
}

// How far, in degrees of latitude, the screen reaches above its centre at this zoom
export function latAboveCenter(centerLat: number, zoom: number, height: number): number {
  return toLat(toY(centerLat) - (height * HALF) / worldSize(zoom)) - centerLat;
}

// The camera centre after zooming from `zoom` to `toZoom` so the point `offset` dp from the screen's
// middle stays put (the driver's zoom buttons keep the middle of the visible strip of map still)
export function zoomAbout(
  [lon, lat]: [number, number],
  zoom: number,
  toZoom: number,
  offset: { x: number; y: number },
): [lon: number, lat: number] {
  const anchorX = toX(lon) + offset.x / worldSize(zoom);
  const anchorY = toY(lat) + offset.y / worldSize(zoom);
  return [toLon(anchorX - offset.x / worldSize(toZoom)), toLat(anchorY - offset.y / worldSize(toZoom))];
}
