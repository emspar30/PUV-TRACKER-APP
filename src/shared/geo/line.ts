import { along, length, lineString, nearestPointOnLine, point } from '@turf/turf';
import type { Position } from 'geojson';

import type { LatLon } from './haversine';

const METERS_PER_KM = 1000;
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

// Snap a point to the nearest position on the line and report its progress along the line
export function projectOntoLine(coordinates: LineCoordinates, p: LatLon): LineProjection {
  const nearest = nearestPointOnLine(lineString(coordinates), point([p.lon, p.lat]), KM);
  const [lon, lat] = nearest.geometry.coordinates;
  return {
    chainageKm: nearest.properties.lineDistance,
    offsetM: nearest.properties.pointDistance * METERS_PER_KM,
    snapped: { lat, lon },
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

// Length of the authorized route slice between two positions along the same directed line
export function sliceLengthKm(fromChainageKm: number, toChainageKm: number): number {
  return Math.max(0, toChainageKm - fromChainageKm);
}
