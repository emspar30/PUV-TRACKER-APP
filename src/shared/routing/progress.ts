// Where a vehicle and a point are along a route line that may use the same street more than once
// (B2 fix). R4's line runs in to its downtown loop and back out on the same street, so the nearest
// spot on the line can be the wrong pass: the vehicle is placed on the pass whose direction matches
// its heading, and a point is found at every pass, in order. Pure: no React Native or Expo imports.

import { LIVE_HEADING_PROBE_M, LIVE_LINE_TIE_M } from '../config';
import type { LatLon } from '../geo/haversine';
import { linePasses, pointAtChainage, projectOntoLine, type LineCoordinates } from '../geo/line';
import { bearingDeg, headingGapDeg } from '../telemetry/liveRow';

const M_PER_KM = 1000;

// The line's direction of travel at a distance along it
export function directionAtKm(coordinates: LineCoordinates, chainageKm: number): number {
  const probeKm = LIVE_HEADING_PROBE_M / M_PER_KM;
  return bearingDeg(pointAtChainage(coordinates, Math.max(0, chainageKm - probeKm)), pointAtChainage(coordinates, chainageKm + probeKm));
}

// The vehicle's distance along the line. Of the passes within LIVE_LINE_TIE_M of the nearest, the
// one heading the vehicle's way; with no heading, the nearest.
export function vehicleChainageKm(coordinates: LineCoordinates, vehicle: LatLon & { headingDeg?: number }): number {
  const nearest = projectOntoLine(coordinates, vehicle);
  if (vehicle.headingDeg === undefined) return nearest.chainageKm;
  const { passes } = linePasses(coordinates, vehicle, nearest.offsetM + LIVE_LINE_TIE_M);
  if (passes.length <= 1) return nearest.chainageKm;
  const heading = vehicle.headingDeg;
  const gap = (km: number) => headingGapDeg(directionAtKm(coordinates, km), heading);
  return passes.reduce((best, pass) => (gap(pass.chainageKm) < gap(best.chainageKm) ? pass : best)).chainageKm;
}

// Every distance along the line at which it passes within maxOffsetM of the point, in order
export function passesKm(coordinates: LineCoordinates, point: LatLon, maxOffsetM: number): number[] {
  return linePasses(coordinates, point, maxOffsetM).passes.map((pass) => pass.chainageKm);
}
