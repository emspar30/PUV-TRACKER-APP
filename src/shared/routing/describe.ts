// Helpers for points picked by hand: where a point sits relative to the route and the stops.
// Pure: they work on any lines and stops, whether from the seed, the database or a test fixture.

import { PIN_NAME_AT_M, PIN_NAME_NEAR_M } from '../config';
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

export function nearestStop(stops: readonly RouteStop[], point: LatLon): NearestStop | null {
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

// A named spot on the map: a stop, or a place of the offline map
export type NamedSpot = LatLon & { name: string };

export type PointName = { kind: 'at' | 'near'; name: string } | { kind: 'none' };

// What a tapped point is called (Emjay, 2026-10-26), from what is already on the phone, with no
// network: the map place it is on ("VALLEN ONE"), else the nearest stop or place within
// PIN_NAME_NEAR_M ("Near SM City Butuan"), else nothing
export function namePoint(point: LatLon, stops: readonly RouteStop[], places: readonly NamedSpot[]): PointName {
  let place: NamedSpot | null = null;
  let placeM = Infinity;
  for (const candidate of places) {
    const distanceM = haversineMeters(point, candidate);
    if (distanceM < placeM) {
      place = candidate;
      placeM = distanceM;
    }
  }
  if (place && placeM <= PIN_NAME_AT_M) return { kind: 'at', name: place.name };
  const stop = nearestStop(stops, point);
  const nearest = stop && stop.distanceM <= placeM ? { name: stop.stop.name, distanceM: stop.distanceM } : place ? { name: place.name, distanceM: placeM } : null;
  return nearest && nearest.distanceM <= PIN_NAME_NEAR_M ? { kind: 'near', name: nearest.name } : { kind: 'none' };
}
