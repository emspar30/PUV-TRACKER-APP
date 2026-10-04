// The route data that ships with the app (RR1). This file and routes.generated.ts are the only
// place route facts live. Lines come from Emjay's traced files through scripts/import-route.ts;
// names, colours, fares and stops are set here. Bump ROUTE_DATA_VERSION after any change, so the
// app replaces its stored route rows on the next launch without clearing app data.
// Pure data: no React Native or Expo imports.

import { FARE_BASE_KM, FARE_BASE_PHP, FARE_PER_KM_PHP } from '../../shared/config';
import { isDraftRoute } from '../../shared/routing/routeImport';

import { GENERATED_LINES } from './routes.generated';

// 1: the straight placeholder (S1). 2: Emjay's traced R3, R4 and R5 (RR1).
// 3: stops assigned to routes (RR1), so R3 and R5 no longer pick up R4's stops.
export const ROUTE_DATA_VERSION = 3;

// True while any route fact is a placeholder. The lines are traced, but the stops and the fares
// are still placeholders, so the "Sample data" notice stays.
// TODO(placeholder): set to false when the stops and the official fare are confirmed.
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
const ROUTE_META: Readonly<Record<string, { name: string; color: string }>> = {
  R3: { name: 'Ampayon-Libertad', color: '#10B981' },
  R4: { name: 'De Oro', color: '#00F5D4' },
  R5: { name: 'Santo Niño', color: '#F97316' },
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

// TODO(placeholder): candidate stops, unconfirmed. They belong to R4; R3 and R5 have no stops yet.
// DEO was moved onto the start of the traced R4 line (De Oro Barangay Hall) on Emjay's decision
// (2026-10-04); its location is not verified.
export const SEED_STATIONS: SeedStation[] = [
  { code: 'IMA', name: 'Imadejas Pob. (Bgy. 24), Butuan City', lat: 8.94755, lon: 125.531184, routeCodes: ['R4'] },
  { code: 'TSO', name: 'Tandang Sora Pob. (Bgy. 12), Butuan City', lat: 8.946096, lon: 125.533083, routeCodes: ['R4'] },
  { code: 'RCA', name: '553 R. Calo, Butuan City (Dunkin Donut)', lat: 8.947459, lon: 125.541426, routeCodes: ['R4'] },
  { code: 'JCA', name: 'J C Aquino Ave, Butuan City', lat: 8.947506, lon: 125.541979, routeCodes: ['R4'] },
  { code: 'MCA', name: '8-318 M. Calo St, Butuan City', lat: 8.947134, lon: 125.544259, routeCodes: ['R4'] },
  { code: 'DEO', name: 'De Oro Barangay Hall (location not verified)', lat: 8.92625, lon: 125.64184, routeCodes: ['R4'] },
];
