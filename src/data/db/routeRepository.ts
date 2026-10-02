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
  const stations = await db.getAllAsync<StationRow>(
    `SELECT s.* FROM stations s
       LEFT JOIN (SELECT station_id, MIN(seq) AS seq FROM route_stations
                  WHERE route_id = (SELECT MIN(route_id) FROM franchise_routes)
                  GROUP BY station_id) r ON r.station_id = s.station_id
      ORDER BY r.seq IS NULL, r.seq, s.code`,
    [],
  );

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
    stops: stations.map((row) => ({ code: row.code, name: row.name, lat: row.lat, lon: row.lon })),
  };
}
