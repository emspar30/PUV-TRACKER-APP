// B4: a relay sent with GPS shares the rider's location on the live map until the rider reaches
// the destination they picked (or RELAY_BROADCAST_MAX_MIN passes). The destination is what ends it.

import { FEED_STOP_NEAR_M, RELAY_BROADCAST_MAX_MIN, RELAY_DESTINATION_ARRIVED_M } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { lineEndKm, projectOntoLine, type LineCoordinates } from '../geo/line';
import type { RouteStop } from '../routing/types';
import type { SeatTier } from '../telemetry/occupancy';

const MS_PER_MIN = 60_000;

export type RelayBroadcast = {
  routeCode: string;
  // T1: the multicab picked by hand; without one the location moves no marker
  vehicleId: string | null;
  // T1: the seats answer, sent with every position
  seatTier: SeatTier;
  destination: Pick<RouteStop, 'code' | 'name' | 'lat' | 'lon'>;
  startedMs: number;
};

export type BroadcastEnd = 'arrived' | 'expired';

// Why the broadcast ends now, or null while it goes on. With no known position only the time limit applies.
export function broadcastEnd(session: RelayBroadcast, position: LatLon | null, nowMs: number): BroadcastEnd | null {
  if (position && haversineMeters(position, session.destination) <= RELAY_DESTINATION_ARRIVED_M) return 'arrived';
  if (nowMs >= session.startedMs + RELAY_BROADCAST_MAX_MIN * MS_PER_MIN) return 'expired';
  return null;
}

// The stops a rider may pick as their destination: the route's stops, minus any the rider is
// already at (that one would end the broadcast at once)
export function destinationOptions(routeStops: readonly RouteStop[], position: LatLon | null): RouteStop[] {
  if (!position) return [...routeStops];
  return routeStops.filter((stop) => haversineMeters(position, stop) > RELAY_DESTINATION_ARRIVED_M);
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
