// Local SQLite schema (PRD 12.1). The database is read-only for the app except for the telemetry buffer.
// franchise_routes has one row per directed line, with route_code and direction (PRD "Changes after audit").

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS franchise_routes (
  route_id        TEXT PRIMARY KEY,
  route_code      TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('outbound','return')),
  route_name      TEXT NOT NULL,
  route_color     TEXT NOT NULL,
  direction_mode  TEXT NOT NULL CHECK (direction_mode IN ('one_way','two_way','loop')),
  base_fare       REAL NOT NULL DEFAULT 14.00,
  base_km         REAL NOT NULL DEFAULT 4.0,
  per_km_rate     REAL NOT NULL DEFAULT 2.00,
  primary_geojson TEXT NOT NULL,
  data_version    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS route_alternatives (
  alt_id    TEXT PRIMARY KEY,
  route_id  TEXT NOT NULL REFERENCES franchise_routes(route_id),
  label     TEXT NOT NULL,
  geojson   TEXT NOT NULL,
  active    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stations (
  station_id  TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  lat         REAL NOT NULL,
  lon         REAL NOT NULL,
  geofence_m  INTEGER NOT NULL DEFAULT 60
);

CREATE TABLE IF NOT EXISTS route_stations (
  route_id     TEXT NOT NULL REFERENCES franchise_routes(route_id),
  station_id   TEXT NOT NULL REFERENCES stations(station_id),
  seq          INTEGER NOT NULL,
  chainage_km  REAL NOT NULL,
  PRIMARY KEY (route_id, station_id)
);

CREATE TABLE IF NOT EXISTS telemetry_buffer (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  payload     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
`;

export type FranchiseRouteRow = {
  route_id: string;
  route_code: string;
  direction: 'outbound' | 'return';
  route_name: string;
  route_color: string;
  direction_mode: 'one_way' | 'two_way' | 'loop';
  base_fare: number;
  base_km: number;
  per_km_rate: number;
  primary_geojson: string;
  data_version: number;
};

export type StationRow = {
  station_id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  geofence_m: number;
};

export type RouteStationRow = {
  route_id: string;
  station_id: string;
  seq: number;
  chainage_km: number;
};
