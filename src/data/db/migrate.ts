// Creates the local schema and writes the bundled route data into it.
// Works against a small database interface, so it runs on the device (expo-sqlite)
// and in tests (Node's built-in SQLite) with the same code.

import type { RouteData } from '../../shared/routing/types';

import { SCHEMA_SQL } from './schema';
import { buildRouteRows } from './seedRows';

export type SqlParam = string | number | null;

export type Db = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlParam[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, params: SqlParam[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: SqlParam[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

export type MigrateResult = 'seeded' | 'up-to-date';

// Idempotent: safe to run on every launch. Route rows are replaced only when the bundled
// data is newer than what is stored (route_data_version), all inside one transaction.
export async function migrateRouteDb(db: Db, data: RouteData): Promise<MigrateResult> {
  await db.execAsync(SCHEMA_SQL);

  const stored = await db.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(data_version) AS version FROM franchise_routes',
    [],
  );
  if (stored?.version != null && stored.version >= data.version) return 'up-to-date';

  const rows = buildRouteRows(data);

  await db.withTransactionAsync(async () => {
    // Children first, because of the foreign keys. The telemetry buffer is not route data and is kept.
    await db.execAsync(
      'DELETE FROM route_stations; DELETE FROM route_alternatives; DELETE FROM stations; DELETE FROM franchise_routes;',
    );

    for (const route of rows.routes) {
      await db.runAsync(
        `INSERT INTO franchise_routes
           (route_id, route_code, direction, route_name, route_color, direction_mode,
            base_fare, base_km, per_km_rate, primary_geojson, data_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          route.route_id,
          route.route_code,
          route.direction,
          route.route_name,
          route.route_color,
          route.direction_mode,
          route.base_fare,
          route.base_km,
          route.per_km_rate,
          route.primary_geojson,
          route.data_version,
        ],
      );
    }

    for (const station of rows.stations) {
      await db.runAsync(
        'INSERT INTO stations (station_id, code, name, lat, lon, geofence_m) VALUES (?, ?, ?, ?, ?, ?)',
        [station.station_id, station.code, station.name, station.lat, station.lon, station.geofence_m],
      );
    }

    for (const link of rows.routeStations) {
      await db.runAsync(
        'INSERT INTO route_stations (route_id, station_id, seq, chainage_km) VALUES (?, ?, ?, ?)',
        [link.route_id, link.station_id, link.seq, link.chainage_km],
      );
    }
  });

  return 'seeded';
}
