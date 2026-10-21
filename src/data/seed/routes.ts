// The route data that ships with the app (RR1). This file and routes.generated.ts are the only
// place route facts live. Lines come from Emjay's traced files through scripts/import-route.ts;
// names, colours, fares and stops are set here. Bump ROUTE_DATA_VERSION after any change, so the
// app replaces its stored route rows on the next launch without clearing app data.
// Pure data: no React Native or Expo imports.

import { FARE_BASE_KM, FARE_BASE_PHP, FARE_PER_KM_PHP } from '../../shared/config';
import { isDraftRoute } from '../../shared/routing/routeImport';

import { GENERATED_LINES, GENERATED_STATIONS } from './routes.generated';

// 1: the straight placeholder (S1). 2: Emjay's traced R3, R4 and R5 (RR1).
// 3: stops assigned to routes (RR1), so R3 and R5 no longer pick up R4's stops.
// 4: R4 outbound derived back along the updated trace to De Oro (closes_back), so R4 goes round.
// 5: R5 outbound derived the same way, back to Santo Niño.
// 6: RR3: R1, R2 (loops split at the downtown turnaround) and R14 (one leg) added; the real stops
//    from docs/real_route_stops.md replace the six placeholder stops.
// 7: ST2-C2: the stops moved to the middle of the road (Emjay, 2026-10-09) and five added (EMB, PAL,
//    ROS, LEM, and R3 to R5 listed), 39 in all.
export const ROUTE_DATA_VERSION = 7;

// True while any route fact is a placeholder. The lines and stops are real (RR3), but the fares
// are still the v1.0 values, so the "Sample data" notice stays.
// TODO(placeholder): set to false when the official fare is confirmed.
export const ROUTE_DATA_IS_PLACEHOLDER = true;

export type SeedDirection = 'outbound' | 'return';

export type SeedStation = {
  // Routes this stop belongs to; stops are assigned, never found by distance alone (RR1)
  routeCodes: string[];
  code: string;
  name: string;
  lat: number;
  lon: number;
};

export type SeedRouteLine = {
  routeId: string;
  routeCode: string;
  direction: SeedDirection;
  routeName: string;
  routeColor: string;
  directionMode: 'one_way' | 'two_way' | 'loop';
  baseFare: number;
  baseKm: number;
  perKmRate: number;
  // GeoJSON order: [longitude, latitude]
  coordinates: [number, number][];
};

// Names from the Butuan City PUJ route map (October 2026). The colour is the dark-theme value
// stored with the route; the light theme uses LIGHT_ROUTE_COLORS in src/theme/tokens.ts.
// RR3: R1, R2 and R14 names from Emjay (2026-10-08); R14's trace ends at Taligaman, short of De Oro.
export const ROUTE_META: Readonly<Record<string, { name: string; color: string }>> = {
  R1: { name: 'Bancasi - Downtown', color: '#60A5FA' },
  R2: { name: 'Bancasi - Langihan', color: '#F472B6' },
  R3: { name: 'Ampayon-Libertad', color: '#10B981' },
  R4: { name: 'De Oro', color: '#00F5D4' },
  R5: { name: 'Santo Niño', color: '#F97316' },
  R14: { name: 'Robinsons - De Oro', color: '#FACC15' },
};

const DIRECTION_ID: Record<SeedDirection, string> = { outbound: 'OUT', return: 'RET' };

export const SEED_LINES: SeedRouteLine[] = GENERATED_LINES.map((line) => ({
  routeId: `${line.routeCode}-${DIRECTION_ID[line.direction]}`,
  routeCode: line.routeCode,
  direction: line.direction,
  routeName: `Route ${line.routeCode.slice(1)} (${ROUTE_META[line.routeCode].name}), ${line.direction}`,
  routeColor: ROUTE_META[line.routeCode].color,
  directionMode: line.directionMode,
  // TODO(placeholder): v1.0 fare values for every route; the official fare is not yet confirmed.
  baseFare: FARE_BASE_PHP,
  baseKm: FARE_BASE_KM,
  perKmRate: FARE_PER_KM_PHP,
  coordinates: line.coordinates,
}));

// RR2: routes whose two legs did not both come from Emjay's per-direction files. They show a small
// "Draft" chip on My Ride. Lines written before RR3 carry no perDirection field and count as draft.
export const DRAFT_ROUTE_CODES: ReadonlySet<string> = new Set(
  [...new Set(GENERATED_LINES.map((line) => line.routeCode))].filter((code) =>
    isDraftRoute(
      GENERATED_LINES.filter((line) => line.routeCode === code).map((line) => ({
        direction: line.direction,
        perDirection: (line as { perDirection?: boolean }).perDirection,
      })),
    ),
  ),
);

// RR3: the real stops (docs/real_route_stops.md), as written by scripts/import-route.ts. Stops
// listed more than 150 m from their line were moved onto it (moved); six more than 500 m away are
// left out until their coordinates are corrected (see routes.generated.ts).
export const SEED_STATIONS: SeedStation[] = GENERATED_STATIONS.map(({ code, name, lat, lon, routeCodes }) => ({ code, name, lat, lon, routeCodes }));
