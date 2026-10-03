// Local SQLite schema from PRD 12.1, as data. Raise SCHEMA_VERSION and add a step to
// migrate.ts when a table changes; route data has its own version (ROUTE_DATA_VERSION).

export const DATABASE_NAME = 'tunton.db';

export const SCHEMA_VERSION = 1;

export const SCHEMA_V1: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS franchise_routes (
    route_id        TEXT PRIMARY KEY,
    route_code      TEXT NOT NULL,
    direction       TEXT NOT NULL CHECK (direction IN ('outbound','return')),
    route_name      TEXT NOT NULL,
    route_color     TEXT NOT NULL,
    direction_mode  TEXT NOT NULL CHECK (direction_mode IN ('one_way','two_way','loop')),
    base_fare       REAL NOT NULL DEFAULT 15.00,
    base_km         REAL NOT NULL DEFAULT 4.0,
    per_km_rate     REAL NOT NULL DEFAULT 2.00,
    primary_geojson TEXT NOT NULL,
    data_version    INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS route_alternatives (
    alt_id    TEXT PRIMARY KEY,
    route_id  TEXT NOT NULL REFERENCES franchise_routes(route_id),
    label     TEXT NOT NULL,
    geojson   TEXT NOT NULL,
    active    INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS stations (
    station_id  TEXT PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    lat         REAL NOT NULL,
    lon         REAL NOT NULL,
    geofence_m  INTEGER NOT NULL DEFAULT 60
  )`,
  `CREATE TABLE IF NOT EXISTS route_stations (
    route_id     TEXT NOT NULL REFERENCES franchise_routes(route_id),
    station_id   TEXT NOT NULL REFERENCES stations(station_id),
    seq          INTEGER NOT NULL,
    chainage_km  REAL NOT NULL,
    PRIMARY KEY (route_id, station_id)
  )`,
  // Ring buffer for offline telemetry (PRD 8.4). Created now, written from S8.
  `CREATE TABLE IF NOT EXISTS telemetry_buffer (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    payload     TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  )`,
];
