import type { Position } from 'geojson';

import type { FareParams } from '../fare/fare';

export type RouteDirection = 'outbound' | 'return';

// One directed line of a route. The routing, snapping and fare code works on these
// and does not care whether they came from the seed file, SQLite or a test fixture.
export type DirectedLine = {
  id: string;
  routeCode: string;
  direction: RouteDirection;
  directionMode: 'one_way' | 'two_way' | 'loop';
  name: string;
  color: string;
  // GeoJSON order: [longitude, latitude], in the direction of travel
  coordinates: Position[];
  fare: FareParams;
};

export type RouteStop = {
  code: string;
  name: string;
  lat: number;
  lon: number;
};

export type RouteData = {
  version: number;
  // True while the lines and stops are placeholders, not surveyed or official data
  isPlaceholder: boolean;
  lines: DirectedLine[];
  stops: RouteStop[];
};
