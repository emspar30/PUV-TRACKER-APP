// Demo & simulation: where the commuter stands while simulated location or fake GPS is on. A spot
// pinned on the map (CA1.1) comes first; else the chosen stop, or the default stop when the chosen one
// is gone (route data changed). Pure: no React Native or Expo imports.

import type { LatLon } from '../geo/haversine';
import type { RouteStop } from '../routing/types';

export type SimulatedPosition = LatLon & { stopCode: string | null };

export function simulatedPosition(
  stops: readonly RouteStop[],
  stopCode: string,
  point: LatLon | null,
  defaultStopCode: string,
): SimulatedPosition | null {
  if (point) return { lat: point.lat, lon: point.lon, stopCode: null };
  const stop = stops.find((candidate) => candidate.code === stopCode) ?? stops.find((candidate) => candidate.code === defaultStopCode);
  return stop ? { lat: stop.lat, lon: stop.lon, stopCode: stop.code } : null;
}
