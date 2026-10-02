// Helpers for points picked by hand: where a point sits relative to the route and the stops.
// Pure: they work on any lines and stops, whether from the seed, the database or a test fixture.

import { haversineMeters, type LatLon } from '../geo/haversine';
import { projectOntoLine, type LineProjection } from '../geo/line';

import type { DirectedLine, RouteStop } from './types';

export type RouteSnap = {
  line: DirectedLine;
  projection: LineProjection;
};

// The nearest position on any route line, or null when there are no lines
export function nearestOnRoute(lines: DirectedLine[], point: LatLon): RouteSnap | null {
  let best: RouteSnap | null = null;
  for (const line of lines) {
    const projection = projectOntoLine(line.coordinates, point);
    if (!best || projection.offsetM < best.projection.offsetM) best = { line, projection };
  }
  return best;
}

export type NearestStop = {
  stop: RouteStop;
  distanceM: number;
};

export function nearestStop(stops: RouteStop[], point: LatLon): NearestStop | null {
  let best: NearestStop | null = null;
  for (const stop of stops) {
    const distanceM = haversineMeters(point, stop);
    if (!best || distanceM < best.distanceM) best = { stop, distanceM };
  }
  return best;
}

export type PointDescription = {
  // Null when there are no stops
  nearestStopCode: string | null;
  nearestStopDistanceM: number | null;
  // Null when there are no route lines
  routeDistanceM: number | null;
  // Where the point lands if it is moved onto the route
  snapped: LatLon | null;
};

// What a pinned point is called: "near <stop>, <distance> from the route"
export function describePoint(lines: DirectedLine[], stops: RouteStop[], point: LatLon): PointDescription {
  const stop = nearestStop(stops, point);
  const route = nearestOnRoute(lines, point);
  return {
    nearestStopCode: stop?.stop.code ?? null,
    nearestStopDistanceM: stop?.distanceM ?? null,
    routeDistanceM: route?.projection.offsetM ?? null,
    snapped: route?.projection.snapped ?? null,
  };
}

// "Move pin to the route": the nearest position on the route, or the point itself when there is no route
export function snapToRoute(lines: DirectedLine[], point: LatLon): LatLon {
  return nearestOnRoute(lines, point)?.projection.snapped ?? point;
}
