// Route 4 (De Oro) placeholder data from PRD 12.5.
// This is the ONLY file that holds placeholder route data. To replace it with surveyed
// or official data, edit the values here and bump ROUTE_DATA_VERSION.
// Pure data: no React Native or Expo imports.

import { FARE_BASE_KM, FARE_BASE_PHP, FARE_PER_KM_PHP } from '../../shared/config';

export const ROUTE_DATA_VERSION = 1;

// True while the stops and lines below are placeholders. Screens show a "placeholder data" notice from it.
// TODO(placeholder): set to false when surveyed or official Route 4 data replaces this file.
export const ROUTE_DATA_IS_PLACEHOLDER = true;

export type SeedDirection = 'outbound' | 'return';

export type SeedStation = {
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

// TODO(placeholder): candidate stops, unconfirmed. Stop order is an assumption.
export const R4_STATIONS: SeedStation[] = [
  { code: 'IMA', name: 'Imadejas Pob. (Bgy. 24), Butuan City', lat: 8.94755, lon: 125.531184 },
  { code: 'TSO', name: 'Tandang Sora Pob. (Bgy. 12), Butuan City', lat: 8.946096, lon: 125.533083 },
  { code: 'RCA', name: '553 R. Calo, Butuan City (Dunkin Donut)', lat: 8.947459, lon: 125.541426 },
  { code: 'JCA', name: 'J C Aquino Ave, Butuan City', lat: 8.947506, lon: 125.541979 },
  { code: 'MCA', name: '8-318 M. Calo St, Butuan City', lat: 8.947134, lon: 125.544259 },
  // TODO(placeholder): approximate De Oro end point, taken from a map link.
  { code: 'DEO', name: 'De Oro, near the Free Methodist Church', lat: 8.9165511, lon: 125.6420476 },
];

// TODO(placeholder): straight segments joining the placeholder stops in travel order.
// The real outbound path has not been traced.
const R4_OUTBOUND_COORDINATES: [number, number][] = [
  [125.531184, 8.94755],
  [125.533083, 8.946096],
  [125.541426, 8.947459],
  [125.541979, 8.947506],
  [125.544259, 8.947134],
  [125.6420476, 8.9165511],
];

// TODO(placeholder): the real return path differs from the outbound path (PRD 12.5).
// Until it is traced, the return line is the outbound line reversed.
const R4_RETURN_COORDINATES: [number, number][] = [...R4_OUTBOUND_COORDINATES].reverse();

const R4_COMMON = {
  routeCode: 'R4',
  // TODO(placeholder): route color taken from the PRD 12.1 schema example.
  routeColor: '#00F5D4',
  directionMode: 'one_way',
  // TODO(placeholder): v1.0 fare values, to be confirmed against the official fare order.
  baseFare: FARE_BASE_PHP,
  baseKm: FARE_BASE_KM,
  perKmRate: FARE_PER_KM_PHP,
} as const;

export const R4_LINES: SeedRouteLine[] = [
  {
    ...R4_COMMON,
    routeId: 'R4-OUT',
    direction: 'outbound',
    routeName: 'Route 4 (De Oro), outbound',
    coordinates: R4_OUTBOUND_COORDINATES,
  },
  {
    ...R4_COMMON,
    routeId: 'R4-RET',
    direction: 'return',
    routeName: 'Route 4 (De Oro), return',
    coordinates: R4_RETURN_COORDINATES,
  },
];
