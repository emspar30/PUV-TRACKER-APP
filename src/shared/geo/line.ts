import { along, length, lineSliceAlong, lineString } from '@turf/turf';
import type { Position } from 'geojson';

import { haversineMeters, type LatLon } from './haversine';

const METERS_PER_KM = 1000;
const HALF_TURN_DEG = 180;
const DEG_TO_RAD = Math.PI / HALF_TURN_DEG;
const KM = { units: 'kilometers' } as const;

// A directed route polyline in GeoJSON order: [longitude, latitude]
export type LineCoordinates = Position[];

export type LineProjection = {
  // Distance along the line from its start to the snapped point
  chainageKm: number;
  // Straight-line distance from the input point to the snapped point
  offsetM: number;
  snapped: LatLon;
};

export function lineLengthKm(coordinates: LineCoordinates): number {
  return length(lineString(coordinates), KM);
}

// Distance from the start of the line to each of its points, in km. Computed once per line and kept,
// because routing projects many points onto the same few lines.
const chainageCache = new WeakMap<LineCoordinates, number[]>();

function pointChainagesKm(coordinates: LineCoordinates): number[] {
  const cached = chainageCache.get(coordinates);
  if (cached) return cached;

  const chainages = [0];
  for (let i = 1; i < coordinates.length; i += 1) {
    const [lonA, latA] = coordinates[i - 1];
    const [lonB, latB] = coordinates[i];
    const segmentM = haversineMeters({ lat: latA, lon: lonA }, { lat: latB, lon: lonB });
    chainages.push(chainages[i - 1] + segmentM / METERS_PER_KM);
  }
  chainageCache.set(coordinates, chainages);
  return chainages;
}

// Snap a point to the nearest position on the line and report its progress along the line.
// Each segment is treated as straight on a flat map centred on the point, which is accurate to well
// under a metre at city scale and far faster than a geodesic search: routing must answer within
// the time budget on a low-end phone (PRD 3.3).
export function projectOntoLine(coordinates: LineCoordinates, p: LatLon): LineProjection {
  if (coordinates.length === 0) throw new RangeError('projectOntoLine needs at least one coordinate');

  const chainages = pointChainagesKm(coordinates);
  // Flat-map scale at the point: degrees of longitude shrink by cos(latitude)
  const lonScale = Math.cos(p.lat * DEG_TO_RAD);
  const toX = (lon: number) => (lon - p.lon) * lonScale;
  const toY = (lat: number) => lat - p.lat;

  let bestDistance = Infinity;
  let bestIndex = 0;
  let bestT = 0;

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const ax = toX(coordinates[i][0]);
    const ay = toY(coordinates[i][1]);
    const dx = toX(coordinates[i + 1][0]) - ax;
    const dy = toY(coordinates[i + 1][1]) - ay;
    const lengthSquared = dx * dx + dy * dy;
    // The point is the origin of the flat map, so the closest position on the segment is found by
    // projecting the origin onto it, clamped to the segment's ends
    const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSquared));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const distance = cx * cx + cy * cy;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
      bestT = t;
    }
  }

  const [lonA, latA] = coordinates[bestIndex];
  const [lonB, latB] = coordinates[Math.min(bestIndex + 1, coordinates.length - 1)];
  const snapped = { lat: latA + bestT * (latB - latA), lon: lonA + bestT * (lonB - lonA) };
  const segmentKm = (chainages[bestIndex + 1] ?? chainages[bestIndex]) - chainages[bestIndex];

  return {
    chainageKm: chainages[bestIndex] + bestT * segmentKm,
    offsetM: haversineMeters(p, snapped),
    snapped,
  };
}

// Position on the line at a given distance from its start, clamped to the line's ends
export function pointAtChainage(coordinates: LineCoordinates, chainageKm: number): LatLon {
  const clamped = Math.min(Math.max(chainageKm, 0), lineLengthKm(coordinates));
  const [lon, lat] = along(lineString(coordinates), clamped, KM).geometry.coordinates;
  return { lat, lon };
}

// PRD 7.2 rule 4: a destination is valid only if it lies ahead of the origin in the direction of travel
export function isAhead(originChainageKm: number, destinationChainageKm: number): boolean {
  return destinationChainageKm > originChainageKm;
}

// Coordinates of the part of the line between two distances from its start (for drawing the ride)
export function sliceCoordinates(coordinates: LineCoordinates, fromChainageKm: number, toChainageKm: number): Position[] {
  if (toChainageKm <= fromChainageKm) return [];
  return lineSliceAlong(lineString(coordinates), fromChainageKm, toChainageKm, KM).geometry.coordinates;
}

// Length of the authorized route slice between two positions along the same directed line
export function sliceLengthKm(fromChainageKm: number, toChainageKm: number): number {
  return Math.max(0, toChainageKm - fromChainageKm);
}
