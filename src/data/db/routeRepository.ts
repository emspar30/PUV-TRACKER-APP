// Typed reads of route data from the local database. Screens never read the seed file directly.

import type { Feature, LineString } from 'geojson';

import type { DirectedLine, RouteStop } from '../../shared/routing/types';

import type { Db } from './migrate';
import type { FranchiseRouteRow, StationRow } from './schema';

export type StoredRouteData = {
  version: number;
  lines: DirectedLine[];
  stops: RouteStop[];
};

export async function loadRouteData(db: Db): Promise<StoredRouteData> {
  const routes = await db.getAllAsync<FranchiseRouteRow>('SELECT * FROM franchise_routes ORDER BY route_id', []);
  // Stations in travel order along the first line that serves them (lines ordered by id);
  // stations on no line come last
  const stations = await db.getAllAsync<StationRow>(
    `SELECT s.* FROM stations s
       LEFT JOIN (SELECT rs.station_id, rs.route_id, rs.seq FROM route_stations rs
                   WHERE rs.route_id = (SELECT MIN(rs2.route_id) FROM route_stations rs2
                                         WHERE rs2.station_id = rs.station_id)) r
         ON r.station_id = s.station_id
      ORDER BY r.seq IS NULL, r.route_id, r.seq, s.code`,
    [],
  );
  // Which routes each station belongs to (RR1: stops are assigned to routes, not found by distance)
  const memberships = await db.getAllAsync<{ station_id: string; route_code: string }>(
    `SELECT DISTINCT rs.station_id, fr.route_code FROM route_stations rs
       JOIN franchise_routes fr ON fr.route_id = rs.route_id
      ORDER BY fr.route_code`,
    [],
  );
  const routesOf = (stationId: string) => memberships.filter((m) => m.station_id === stationId).map((m) => m.route_code);

  const lines: DirectedLine[] = routes.map((row) => {
    const feature = JSON.parse(row.primary_geojson) as Feature<LineString>;
    return {
      id: row.route_id,
      routeCode: row.route_code,
      direction: row.direction,
      directionMode: row.direction_mode,
      name: row.route_name,
      color: row.route_color,
      coordinates: feature.geometry.coordinates,
      fare: { baseFare: row.base_fare, baseKm: row.base_km, perKmRate: row.per_km_rate },
    };
  });

  return {
    version: routes.reduce((highest, row) => Math.max(highest, row.data_version), 0),
    lines,
    stops: stations.map((row) => ({
      code: row.code,
      name: row.name,
      lat: row.lat,
      lon: row.lon,
      routeCodes: routesOf(row.station_id),
    })),
  };
}
