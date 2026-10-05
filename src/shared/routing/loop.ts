// A vehicle's round on its route (B2): the route's legs in driving order, outbound first, then the
// return, then the outbound again. A route with one stored leg (R4, R5 until the other leg is
// traced) gets a stand-in for the missing leg: the same streets driven back the other way. Demo
// vehicles then drive round without jumping back to the start, and the ETA can follow a vehicle
// round to the commuter again after it passes. Pure: no React Native or Expo imports.

import type { DirectedLine, RouteDirection } from './types';

// The stand-in leg's id: the stored leg's id with this ending
export const BACK_LEG_SUFFIX = '~back';

const OTHER: Record<RouteDirection, RouteDirection> = { outbound: 'return', return: 'outbound' };
const directionOrder = (line: Pick<DirectedLine, 'direction'>) => (line.direction === 'outbound' ? 0 : 1);

// Every stored leg, plus a stand-in other leg for each route with only one
export function withReturnLegs(lines: readonly DirectedLine[]): DirectedLine[] {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line.routeCode, (counts.get(line.routeCode) ?? 0) + 1);
  const backs = lines
    .filter((line) => counts.get(line.routeCode) === 1)
    .map((line) => ({ ...line, id: `${line.id}${BACK_LEG_SUFFIX}`, direction: OTHER[line.direction], coordinates: [...line.coordinates].reverse() }));
  return [...lines, ...backs];
}

// The legs of the line's route in driving order, starting with that line; empty for an unknown line
export function routeRound<T extends Pick<DirectedLine, 'id' | 'routeCode' | 'direction'>>(lines: readonly T[], lineId: string): T[] {
  const own = lines.find((line) => line.id === lineId);
  if (!own) return [];
  const ofRoute = lines.filter((line) => line.routeCode === own.routeCode).sort((a, b) => directionOrder(a) - directionOrder(b));
  const start = ofRoute.indexOf(own);
  return [...ofRoute.slice(start), ...ofRoute.slice(0, start)];
}
