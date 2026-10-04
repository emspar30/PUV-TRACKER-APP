import { useMemo } from 'react';

import type { DirectedLine, RouteStop } from '@/shared/routing/types';
import { routeVisibility, stopsForRoute, type MapTab } from '@/shared/ui/routeVisibility';

// What a map tab draws for the current selection (UX3): the lines to pass to RouteLines with
// their opacity, and the stops to pass to StopDots. The rules are in routeVisibility.
export function useRouteLayers(
  lines: DirectedLine[],
  stops: RouteStop[],
  tab: MapTab,
  selectedRoute: string | null,
  hasTrip = false,
) {
  return useMemo(() => {
    const view = routeVisibility(lines, { tab, selectedRoute, hasTrip });
    const shown = new Set(view.lines.map((line) => line.id));
    return {
      view,
      lines: lines.filter((line) => shown.has(line.id)),
      opacity: Object.fromEntries(view.lines.map((line) => [line.id, line.opacity])),
      stops: stopsForRoute(lines, stops, view.stopsRoute),
    };
  }, [lines, stops, tab, selectedRoute, hasTrip]);
}
