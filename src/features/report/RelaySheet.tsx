import { useCallback, useMemo } from 'react';

import { useRepositories } from '@/data/live/useRepositories';
import { useRouteData } from '@/data/RouteDataProvider';
import { placeOf, useCommuterPosition } from '@/features/map/useCommuterPosition';
import { canReportWithGps } from '@/shared/checkin/geofence';
import { inRouteOrder } from '@/shared/relay/broadcast';
import { withReturnLegs } from '@/shared/routing/loop';
import { routeCodesOf, stopsForRoute } from '@/shared/ui/routeVisibility';
import { useLocationStore } from '@/state/locationStore';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/theme';

import { ReportSheet } from './ReportSheet';

// The Relay form with everything it needs from the app (Emjay, 2026-10-26: it opens from the bottom
// bar over any tab and works as it did on the Map): every route and its colour, the multicabs, each
// route's stops and lines, where the rider is, the GPS check and whether the live map is open to them.
export function RelaySheet({ onClose }: { onClose: () => void }) {
  const { colors, routeColor } = useTheme();
  const { lines, stops } = useRouteData();
  const repos = useRepositories();
  const teamAccount = useSessionStore((state) => state.teamAccount);
  const commuter = useCommuterPosition();
  // B2: each route with one stored leg also has its stand-in other leg
  const loopLines = useMemo(() => withReturnLegs(lines), [lines]);
  const routes = useMemo(
    () =>
      routeCodesOf(lines).map((code) => {
        const line = lines.find((candidate) => candidate.routeCode === code);
        return { code, color: line ? routeColor(code, line.color) : colors.primary };
      }),
    [lines, routeColor, colors.primary],
  );
  // RL2a: a route's lines (both directions), for the route check
  const linesOf = useCallback(
    (code: string) => loopLines.filter((line) => line.routeCode === code).map((line) => line.coordinates),
    [loopLines],
  );
  const stopsOf = useCallback(
    (code: string) =>
      inRouteOrder(
        lines.filter((line) => line.routeCode === code).map((line) => line.coordinates),
        stopsForRoute(lines, stops, code),
      ),
    [lines, stops],
  );
  return (
    <ReportSheet
      routes={routes}
      vehicles={repos.vehicles}
      stopsOf={stopsOf}
      linesOf={linesOf}
      position={commuter}
      checkGps={() => canReportWithGps(placeOf(commuter, useLocationStore.getState().fix, Date.now()))}
      liveMapAllowed={repos.vehicles.source !== 'live' || teamAccount === true}
      onClose={onClose}
    />
  );
}
