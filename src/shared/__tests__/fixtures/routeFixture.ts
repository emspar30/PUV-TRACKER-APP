// Fixed, synthetic route data for the S3 tests. It is NOT the live seed file:
// replacing the placeholder Route 4 data with real data must not change any test that uses this.
//
// One straight street running due east along latitude 9.0, about 8.8 km long, stored as an
// outbound line and its reverse. At this latitude 0.01 degrees of longitude is about 1.098 km.

import type { DirectedLine, RouteData, RouteStop } from '../../routing/types';

export const FIXTURE_FARE = { baseFare: 15, baseKm: 4, perKmRate: 2 };

const LAT = 9.0;
const WEST = 125.5;
const EAST = 125.58;

// Kilometres per degree, for building test points at known distances
export const KM_PER_DEG_LON = 111.195 * Math.cos((LAT * Math.PI) / 180);
export const KM_PER_DEG_LAT = 111.195;

// A point `eastKm` along the street from its west end and `northM` metres to its north
export function pointAt(eastKm: number, northM = 0) {
  return { lat: LAT + northM / 1000 / KM_PER_DEG_LAT, lon: WEST + eastKm / KM_PER_DEG_LON };
}

const OUTBOUND_COORDINATES = [
  [WEST, LAT],
  [125.52, LAT],
  [125.55, LAT],
  [EAST, LAT],
];

export const FIXTURE_OUTBOUND: DirectedLine = {
  id: 'T1-OUT',
  routeCode: 'T1',
  direction: 'outbound',
  directionMode: 'one_way',
  name: 'Test route, outbound',
  color: '#123456',
  coordinates: OUTBOUND_COORDINATES,
  fare: FIXTURE_FARE,
};

export const FIXTURE_RETURN: DirectedLine = {
  ...FIXTURE_OUTBOUND,
  id: 'T1-RET',
  direction: 'return',
  name: 'Test route, return',
  coordinates: [...OUTBOUND_COORDINATES].reverse(),
};

export const FIXTURE_STOPS: RouteStop[] = [
  { code: 'AAA', name: 'West end', ...pointAt(0) },
  { code: 'BBB', name: 'Two kilometres', ...pointAt(2) },
  { code: 'CCC', name: 'Six kilometres', ...pointAt(6) },
  // 400 m off the street: too far to be listed as a stop of the line
  { code: 'FAR', name: 'Off the street', ...pointAt(4, 400) },
];

export const FIXTURE_ROUTE_DATA: RouteData = {
  version: 3,
  isPlaceholder: false,
  lines: [FIXTURE_OUTBOUND, FIXTURE_RETURN],
  stops: FIXTURE_STOPS,
};
