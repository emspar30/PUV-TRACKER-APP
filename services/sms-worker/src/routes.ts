// DR6: each route's stops in riding order, from the route data that ships with the apps
// (src/data/seed), ordered the same way as the driver app's list (inRouteOrder). Every message lists
// every stop of the route with its count, zeros included, so the driver phone can tell "nobody
// waiting" from "no count yet" (plan section 6.2.2).

import { SEED_LINES, SEED_STATIONS } from '../../../src/data/seed/routes';
import { inRouteOrder } from '../../../src/shared/relay/broadcast';

const cache = new Map<string, string[]>();

// The stop codes of a route in riding order; empty for a route the data does not know
export function routeStopCodes(routeId: string): string[] {
  const cached = cache.get(routeId);
  if (cached) return cached;
  const lines = SEED_LINES.filter((line) => line.routeCode === routeId).map((line) => line.coordinates);
  const stops = SEED_STATIONS.filter((station) => station.routeCodes.includes(routeId));
  const codes = inRouteOrder(lines, stops).map((stop) => stop.code);
  cache.set(routeId, codes);
  return codes;
}
