// Which route lines and stops each map tab draws (UX3). By default a map is clean: nothing is
// drawn until a route is selected. Then the selected route is drawn in full, other routes at
// UNSELECTED_ROUTE_OPACITY, and only the selected route's stops are shown.
// My Ride also draws a trip result (the ride segment, pins and guides) without any route line.

import { ROUTE_STOP_MAX_DISTANCE_M, UNSELECTED_ROUTE_OPACITY } from '../config';
import { projectOntoLine } from '../geo/line';
import type { DirectedLine, RouteStop } from '../routing/types';

export type MapTab = 'live' | 'checkin' | 'ride';

export type RouteVisibilityContext = {
  tab: MapTab;
  // Public route code of the selected route, or null when none is selected
  selectedRoute: string | null;
  // My Ride only: a trip result is showing
  hasTrip?: boolean;
};

// A line to draw, with its opacity (1 for the selected route)
export type LineView = { id: string; opacity: number };

export type RouteVisibility = {
  lines: readonly LineView[];
  // Route whose stops are drawn, or null for no stops
  stopsRoute: string | null;
  // Live only: the Outbound and Return switches and "Show whole route"
  showRouteControls: boolean;
  // My Ride only: the trip layers (ride segment, pins, guides)
  showTrip: boolean;
};

type LineRef = Pick<DirectedLine, 'id' | 'routeCode'>;

export function routeVisibility(lines: readonly LineRef[], context: RouteVisibilityContext): RouteVisibility {
  const { tab, selectedRoute } = context;
  const selected = selectedRoute !== null && lines.some((line) => line.routeCode === selectedRoute) ? selectedRoute : null;
  const views: LineView[] =
    selected === null
      ? []
      : lines.map((line) => ({ id: line.id, opacity: line.routeCode === selected ? 1 : UNSELECTED_ROUTE_OPACITY }));
  return {
    lines: views,
    stopsRoute: selected,
    showRouteControls: tab === 'live' && selected !== null,
    showTrip: tab === 'ride' && context.hasTrip === true,
  };
}

// The stops served by a route: those within ROUTE_STOP_MAX_DISTANCE_M of any of its directed lines
export function stopsForRoute(
  lines: readonly Pick<DirectedLine, 'routeCode' | 'coordinates'>[],
  stops: readonly RouteStop[],
  routeCode: string | null,
): RouteStop[] {
  if (routeCode === null) return [];
  const ofRoute = lines.filter((line) => line.routeCode === routeCode && line.coordinates.length > 1);
  if (ofRoute.length === 0) return [];
  return stops.filter((stop) =>
    stop.routeCodes
      ? stop.routeCodes.includes(routeCode)
      : ofRoute.some((line) => projectOntoLine(line.coordinates, stop).offsetM <= ROUTE_STOP_MAX_DISTANCE_M),
  );
}

// The routes that stop at a station, in route order: one for most stops, several at a shared stop
export function routesAtStop(lines: readonly Pick<DirectedLine, 'routeCode' | 'coordinates'>[], stop: RouteStop): string[] {
  return routeCodesOf(lines).filter((code) => stopsForRoute(lines, [stop], code).length > 0);
}

// Return lines drawn in the return style (the pale band with dashes): only a return that runs
// alongside a stored outbound of the same route. A route with a single stored leg (R4 and R5 in
// RR1) draws that leg as a solid line with arrows, like an outbound.
export function returnStyledIds(lines: readonly Pick<DirectedLine, 'id' | 'routeCode' | 'direction'>[]): Set<string> {
  const withOutbound = new Set(lines.filter((line) => line.direction === 'outbound').map((line) => line.routeCode));
  return new Set(lines.filter((line) => line.direction === 'return' && withOutbound.has(line.routeCode)).map((line) => line.id));
}

// A route with only one stored leg that is not a loop: its other leg is not provided yet.
// RR1's traced R4 and R5 legs are the only such routes, and they are marked partial.
export function isSingleLegRoute(lines: readonly Pick<DirectedLine, 'routeCode' | 'directionMode'>[], routeCode: string): boolean {
  const ofRoute = lines.filter((line) => line.routeCode === routeCode);
  return ofRoute.length === 1 && ofRoute[0].directionMode !== 'loop';
}

// Route codes in route-number order (R1, R2, R3, R14), not text order (EQ-4); codes without a
// number come last, by text
export function compareRouteCodes(a: string, b: string): number {
  const number = (code: string) => {
    const match = /\d+/.exec(code);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
  };
  return number(a) - number(b) || a.localeCompare(b);
}

// Unique route codes, in route-number order
export function routeCodesOf(lines: readonly Pick<DirectedLine, 'routeCode'>[]): string[] {
  return [...new Set(lines.map((line) => line.routeCode))].sort(compareRouteCodes);
}

// A tapped route chip toggles: the same route again clears the selection
export function toggleRoute(current: string | null, tapped: string): string | null {
  return current === tapped ? null : tapped;
}
