// DT1 (PRD 10.5): the active detour lines of a route. A detour is used only while an admin has it
// active; fares never use it (they keep the authorized route's length). Pure.

import type { Position } from 'geojson';

export type Detour = { id: string; routeCode: string; name: string; coordinates: Position[] };

export function activeDetours(detours: readonly Detour[], activeIds: readonly string[], routeCode: string | null = null): Detour[] {
  return detours.filter((detour) => activeIds.includes(detour.id) && (routeCode === null || detour.routeCode === routeCode));
}
