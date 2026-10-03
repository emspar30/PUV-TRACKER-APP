// Typed reads of the local route data. Only a type comes from expo-sqlite.

import type { SQLiteDatabase } from 'expo-sqlite';

import type { LineCoordinates } from '../../shared/geo/line';
import type { PlanLine } from '../../shared/routing/plan';

export type RepositoryDb = Pick<SQLiteDatabase, 'getAllAsync'>;

export type Station = {
  stationId: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  geofenceM: number;
};

export type RouteStation = {
  routeId: string;
  stationId: string;
  seq: number;
  chainageKm: number;
};

export type RouteLine = PlanLine & {
  direction: 'outbound' | 'return';
  directionMode: 'one_way' | 'two_way' | 'loop';
  dataVersion: number;
};

export type RouteNetwork = {
  version: number;
  lines: RouteLine[];
  stations: Station[];
  routeStations: RouteStation[];
};

type RouteRow = {
  route_id: string;
  route_code: string;
  direction: RouteLine['direction'];
  route_name: string;
  route_color: string;
  direction_mode: RouteLine['directionMode'];
  base_fare: number;
  base_km: number;
  per_km_rate: number;
  primary_geojson: string;
  data_version: number;
};

type StationRow = {
  station_id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  geofence_m: number;
};

type RouteStationRow = {
  route_id: string;
  station_id: string;
  seq: number;
  chainage_km: number;
};

function parseLine(geojson: string, routeId: string): LineCoordinates {
  const feature = JSON.parse(geojson) as { geometry?: { type?: string; coordinates?: LineCoordinates } };
  if (feature.geometry?.type !== 'LineString' || !feature.geometry.coordinates) {
    throw new Error(`Route ${routeId} has no LineString geometry`);
  }
  return feature.geometry.coordinates;
}

function toRouteLine(row: RouteRow): RouteLine {
  return {
    routeId: row.route_id,
    routeCode: row.route_code,
    routeName: row.route_name,
    routeColor: row.route_color,
    direction: row.direction,
    directionMode: row.direction_mode,
    dataVersion: row.data_version,
    coordinates: parseLine(row.primary_geojson, row.route_id),
    fare: { baseFare: row.base_fare, baseKm: row.base_km, perKmRate: row.per_km_rate },
  };
}

let cached: RouteNetwork | null = null;

// Reads every route, station and route-stop link. The polylines are parsed once and kept
// until the route data version changes.
export async function loadRouteNetwork(db: RepositoryDb): Promise<RouteNetwork> {
  const routeRows = await db.getAllAsync<RouteRow>('SELECT * FROM franchise_routes ORDER BY route_id');
  const version = routeRows.reduce((max, row) => Math.max(max, row.data_version), 0);
  if (cached && cached.version === version && cached.lines.length === routeRows.length) return cached;

  const stationRows = await db.getAllAsync<StationRow>('SELECT * FROM stations');
  const routeStationRows = await db.getAllAsync<RouteStationRow>(
    'SELECT * FROM route_stations ORDER BY route_id, seq',
  );

  const stations = stationRows.map(
    (row): Station => ({
      stationId: row.station_id,
      code: row.code,
      name: row.name,
      lat: row.lat,
      lon: row.lon,
      geofenceM: row.geofence_m,
    }),
  );
  const routeStations = routeStationRows.map(
    (row): RouteStation => ({
      routeId: row.route_id,
      stationId: row.station_id,
      seq: row.seq,
      chainageKm: row.chainage_km,
    }),
  );

  cached = { version, lines: routeRows.map(toRouteLine), stations, routeStations };
  return cached;
}

// Stations in the order a rider meets them on the given line
export function stationsOnLine(network: RouteNetwork, routeId: string): Station[] {
  const byId = new Map(network.stations.map((station) => [station.stationId, station]));
  return network.routeStations
    .filter((link) => link.routeId === routeId)
    .sort((a, b) => a.seq - b.seq)
    .flatMap((link) => byId.get(link.stationId) ?? []);
}

// For tests: forget the parsed network
export function clearRouteNetworkCache(): void {
  cached = null;
}
