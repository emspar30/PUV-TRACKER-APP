// B4: a relay sent with GPS shares the rider's location on the live map until the rider reaches
// the destination they picked. RL1: how it ends (arrival, idle, the 3-hour cap) is in ./limits.

import { FEED_STOP_NEAR_M, RELAY_ARRIVAL_RADIUS_M } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { lineEndKm, projectOntoLine, type LineCoordinates } from '../geo/line';
import type { RouteStop } from '../routing/types';
import type { SeatTier } from '../telemetry/occupancy';

export type RelayBroadcast = {
  routeCode: string;
  // T1: the multicab picked by hand; without one the location moves no marker
  vehicleId: string | null;
  // T1: the seats answer, sent with every position
  seatTier: SeatTier;
  destination: Pick<RouteStop, 'code' | 'name' | 'lat' | 'lon'>;
  startedMs: number;
  // CA1.1: where the rider was when sharing started, for how much of the ride is done; null if unknown
  startPoint: LatLon | null;
  // RL1: the route's terminals, where the idle stop waits longer (its first and last stop for now, D3)
  terminals: readonly LatLon[];
};

// RL1: a route's terminals: the first and the last of its stops in riding order (D3)
export function terminalsOf(stopsInOrder: readonly RouteStop[]): LatLon[] {
  if (stopsInOrder.length === 0) return [];
  const first = stopsInOrder[0];
  const last = stopsInOrder[stopsInOrder.length - 1];
  const ends = first.code === last.code ? [first] : [first, last];
  return ends.map((stop) => ({ lat: stop.lat, lon: stop.lon }));
}

// The stops a rider may pick as their destination: the route's stops, minus any the rider is
// already at (that one would end the broadcast at once)
export function destinationOptions(routeStops: readonly RouteStop[], position: LatLon | null): RouteStop[] {
  if (!position) return [...routeStops];
  return routeStops.filter((stop) => haversineMeters(position, stop) > RELAY_ARRIVAL_RADIUS_M);
}

// ST2-D2: a destination searched by name (a building, a street) is the route's stop nearest to it,
// within maxM; null when no stop of the route is that close
export function nearestDestination(options: readonly RouteStop[], place: LatLon, maxM: number): RouteStop | null {
  let best: RouteStop | null = null;
  let bestM = maxM;
  for (const stop of options) {
    const metres = haversineMeters(place, stop);
    if (metres <= bestM) {
      best = stop;
      bestM = metres;
    }
  }
  return best;
}

// A route's stops in riding order: along its longest stored line, the one that covers the most of it
export function inRouteOrder(lines: readonly LineCoordinates[], stops: readonly RouteStop[]): RouteStop[] {
  const longest = lines.filter((line) => line.length > 1).reduce<LineCoordinates | null>(
    (best, line) => (best === null || lineEndKm(line) > lineEndKm(best) ? line : best),
    null,
  );
  if (!longest) return [...stops];
  const along = new Map(stops.map((stop) => [stop.code, projectOntoLine(longest, stop).chainageKm]));
  return [...stops].sort((a, b) => (along.get(a.code) ?? 0) - (along.get(b.code) ?? 0));
}

// B6: the stop a relay names in Crowdsource ("Near ..."): the nearest stop of any route within
// FEED_STOP_NEAR_M of the phone, whether or not the relay shares GPS. Only the code is sent.
export function relayStopCode(stops: readonly RouteStop[], position: LatLon | null): string | null {
  if (!position) return null;
  let best: { code: string; distanceM: number } | null = null;
  for (const stop of stops) {
    const distanceM = haversineMeters(position, stop);
    if (distanceM <= FEED_STOP_NEAR_M && (!best || distanceM < best.distanceM)) best = { code: stop.code, distanceM };
  }
  return best?.code ?? null;
}
