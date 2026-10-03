// Creates the local tables and loads route data. Runs before any screen reads the database.
// Only a type comes from expo-sqlite, so tests can run this against Node's own SQLite.

import type { SQLiteDatabase } from 'expo-sqlite';

import { R4_LINES, R4_STATIONS, ROUTE_DATA_VERSION } from '../seed/r4.placeholder';
import { SCHEMA_V1, SCHEMA_VERSION } from './schema';
import { buildSeedRows, type SeedRows } from './seedRows';

// The part of the expo-sqlite database this module uses
export type MigrationDb = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getFirstAsync' | 'withTransactionAsync'>;

export type SeedSource = {
  rows: SeedRows;
  version: number;
};

const DEFAULT_SEED: SeedSource = {
  rows: buildSeedRows(R4_LINES, R4_STATIONS, ROUTE_DATA_VERSION),
  version: ROUTE_DATA_VERSION,
};

// Route data is replaced only when the seed is newer than what the device holds
export function shouldReseed(storedVersion: number, seedVersion: number): boolean {
  return seedVersion > storedVersion;
}

export async function readRouteDataVersion(db: MigrationDb): Promise<number> {
  const row = await db.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(data_version) AS version FROM franchise_routes',
  );
  return row?.version ?? 0;
}

async function createTables(db: MigrationDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= SCHEMA_VERSION) return;
  await db.withTransactionAsync(async () => {
    for (const statement of SCHEMA_V1) await db.execAsync(statement);
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

async function replaceRouteData(db: MigrationDb, { routes, stations, routeStations }: SeedRows): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Children first, so foreign keys hold at every step
    await db.runAsync('DELETE FROM route_stations');
    await db.runAsync('DELETE FROM route_alternatives');
    await db.runAsync('DELETE FROM franchise_routes');
    await db.runAsync('DELETE FROM stations');

    for (const r of routes) {
      await db.runAsync(
        `INSERT INTO franchise_routes (route_id, route_code, direction, route_name, route_color, direction_mode,
           base_fare, base_km, per_km_rate, primary_geojson, data_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r.route_id,
        r.route_code,
        r.direction,
        r.route_name,
        r.route_color,
        r.direction_mode,
        r.base_fare,
        r.base_km,
        r.per_km_rate,
        r.primary_geojson,
        r.data_version,
      );
    }
    for (const s of stations) {
      await db.runAsync(
        'INSERT INTO stations (station_id, code, name, lat, lon, geofence_m) VALUES (?, ?, ?, ?, ?, ?)',
        s.station_id,
        s.code,
        s.name,
        s.lat,
        s.lon,
        s.geofence_m,
      );
    }
    for (const rs of routeStations) {
      await db.runAsync(
        'INSERT INTO route_stations (route_id, station_id, seq, chainage_km) VALUES (?, ?, ?, ?)',
        rs.route_id,
        rs.station_id,
        rs.seq,
        rs.chainage_km,
      );
    }
  });
}

// Passed to SQLiteProvider's onInit
export async function migrateDb(db: MigrationDb, seed: SeedSource = DEFAULT_SEED): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await createTables(db);
  if (shouldReseed(await readRouteDataVersion(db), seed.version)) {
    await replaceRouteData(db, seed.rows);
  }
}
