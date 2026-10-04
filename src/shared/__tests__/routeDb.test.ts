// Runs the real schema and seeding SQL against Node's built-in SQLite, with fixture data.

import { DatabaseSync } from 'node:sqlite';

import { migrateRouteDb, type Db, type SqlParam } from '../../data/db/migrate';
import { loadRouteData } from '../../data/db/routeRepository';
import { buildRouteRows } from '../../data/db/seedRows';
import { CHECKIN_RADIUS_M } from '../config';
import type { RouteData } from '../routing/types';

import { FIXTURE_ROUTE_DATA, FIXTURE_STOPS } from './fixtures/routeFixture';

function openMemoryDb(): { db: Db; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const db: Db = {
    execAsync: async (sql) => {
      raw.exec(sql);
    },
    runAsync: async (sql, params: SqlParam[]) => raw.prepare(sql).run(...params),
    getFirstAsync: async <T>(sql: string, params: SqlParam[]) => (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    getAllAsync: async <T>(sql: string, params: SqlParam[]) => raw.prepare(sql).all(...params) as T[],
    withTransactionAsync: async (task) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { db, raw };
}

const count = (raw: DatabaseSync, table: string) =>
  (raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('seed maps to rows', () => {
  const rows = buildRouteRows(FIXTURE_ROUTE_DATA);

  it('makes one route row per directed line, with route code, direction and fare', () => {
    expect(rows.routes.map((r) => [r.route_id, r.route_code, r.direction])).toEqual([
      ['T1-OUT', 'T1', 'outbound'],
      ['T1-RET', 'T1', 'return'],
    ]);
    for (const route of rows.routes) {
      expect(route.data_version).toBe(FIXTURE_ROUTE_DATA.version);
      expect([route.base_fare, route.base_km, route.per_km_rate]).toEqual([15, 4, 2]);
      expect(JSON.parse(route.primary_geojson).geometry.type).toBe('LineString');
    }
  });

  it('makes one station row per stop, with the configured geofence', () => {
    expect(rows.stations.map((s) => s.code)).toEqual(FIXTURE_STOPS.map((s) => s.code));
    expect(rows.stations.every((s) => s.geofence_m === CHECKIN_RADIUS_M)).toBe(true);
  });

  it('orders each line’s stops by distance along that line, computed from the geometry', () => {
    const forLine = (id: string) => rows.routeStations.filter((r) => r.route_id === id);

    const out = forLine('T1-OUT');
    expect(out.map((r) => r.station_id)).toEqual(['AAA', 'BBB', 'CCC']);
    expect(out.map((r) => r.seq)).toEqual([1, 2, 3]);
    expect(out[1].chainage_km).toBeCloseTo(2, 2);
    expect(out[2].chainage_km).toBeCloseTo(6, 2);

    // The return line runs the other way, so the order is reversed
    expect(forLine('T1-RET').map((r) => r.station_id)).toEqual(['CCC', 'BBB', 'AAA']);
  });

  it('does not list a stop that is too far from the line', () => {
    expect(rows.routeStations.some((r) => r.station_id === 'FAR')).toBe(false);
  });
});

describe('route database', () => {
  it('creates the five tables of PRD 12.1, with route_code and direction', async () => {
    const { db, raw } = openMemoryDb();
    await migrateRouteDb(db, FIXTURE_ROUTE_DATA);

    const tables = (raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[])
      .map((t) => t.name)
      .filter((name) => !name.startsWith('sqlite_'));
    expect(tables).toEqual(['franchise_routes', 'route_alternatives', 'route_stations', 'stations', 'telemetry_buffer']);

    const columns = (raw.prepare('PRAGMA table_info(franchise_routes)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(['route_code', 'direction', 'data_version', 'primary_geojson']));
  });

  it('seeds on first run and stores the data version', async () => {
    const { db, raw } = openMemoryDb();
    await expect(migrateRouteDb(db, FIXTURE_ROUTE_DATA)).resolves.toBe('seeded');
    expect(count(raw, 'franchise_routes')).toBe(2);
    expect(count(raw, 'stations')).toBe(4);
    expect(count(raw, 'route_stations')).toBe(6);
  });

  it('does nothing when run again with the same version', async () => {
    const { db, raw } = openMemoryDb();
    await migrateRouteDb(db, FIXTURE_ROUTE_DATA);
    raw.exec("UPDATE stations SET name = 'edited' WHERE code = 'AAA'");

    await expect(migrateRouteDb(db, FIXTURE_ROUTE_DATA)).resolves.toBe('up-to-date');
    expect(count(raw, 'franchise_routes')).toBe(2);
    expect((raw.prepare("SELECT name FROM stations WHERE code = 'AAA'").get() as { name: string }).name).toBe('edited');
  });

  it('replaces the route rows when the bundled data has a newer version', async () => {
    const { db, raw } = openMemoryDb();
    await migrateRouteDb(db, FIXTURE_ROUTE_DATA);

    const newer: RouteData = {
      ...FIXTURE_ROUTE_DATA,
      version: FIXTURE_ROUTE_DATA.version + 1,
      lines: [FIXTURE_ROUTE_DATA.lines[0]],
      stops: FIXTURE_STOPS.slice(0, 2),
    };
    await expect(migrateRouteDb(db, newer)).resolves.toBe('seeded');
    expect(count(raw, 'franchise_routes')).toBe(1);
    expect(count(raw, 'stations')).toBe(2);
    expect((await loadRouteData(db)).version).toBe(newer.version);
  });

  it('does not replace newer stored data with an older bundle', async () => {
    const { db, raw } = openMemoryDb();
    await migrateRouteDb(db, FIXTURE_ROUTE_DATA);
    const older: RouteData = { ...FIXTURE_ROUTE_DATA, version: 1, lines: [] };
    await expect(migrateRouteDb(db, older)).resolves.toBe('up-to-date');
    expect(count(raw, 'franchise_routes')).toBe(2);
  });

  it('keeps the telemetry buffer when route data is replaced', async () => {
    const { db, raw } = openMemoryDb();
    await migrateRouteDb(db, FIXTURE_ROUTE_DATA);
    raw.exec("INSERT INTO telemetry_buffer (payload, created_at) VALUES ('p', 1)");
    await migrateRouteDb(db, { ...FIXTURE_ROUTE_DATA, version: 99 });
    expect(count(raw, 'telemetry_buffer')).toBe(1);
  });

  it('rejects a direction outside outbound and return', async () => {
    const { db, raw } = openMemoryDb();
    await migrateRouteDb(db, FIXTURE_ROUTE_DATA);
    expect(() =>
      raw.exec(
        "INSERT INTO franchise_routes (route_id, route_code, direction, route_name, route_color, direction_mode, primary_geojson, data_version) VALUES ('X', 'X', 'sideways', 'x', '#000', 'one_way', '{}', 1)",
      ),
    ).toThrow();
  });
});

describe('route repository', () => {
  it('reads back what was seeded: lines with geometry and fare, and stops in travel order', async () => {
    const { db } = openMemoryDb();
    await migrateRouteDb(db, FIXTURE_ROUTE_DATA);
    const stored = await loadRouteData(db);

    expect(stored.version).toBe(FIXTURE_ROUTE_DATA.version);
    expect(stored.lines).toEqual(FIXTURE_ROUTE_DATA.lines);
    expect(stored.stops.map((s) => s.code)).toEqual(['AAA', 'BBB', 'CCC', 'FAR']);
    expect(stored.stops[1]).toEqual({ ...FIXTURE_STOPS[1], routeCodes: ['T1'] });
    // FAR is too far from the line, so it belongs to no route
    expect(stored.stops[3].routeCodes).toEqual([]);
  });

  it('links an assigned stop only to its own routes, even when another route passes by (RR1)', async () => {
    const { db } = openMemoryDb();
    const other = { ...FIXTURE_ROUTE_DATA.lines[0], id: 'T2-OUT', routeCode: 'T2' };
    const stops = FIXTURE_STOPS.map((stop) => ({ ...stop, routeCodes: ['T1'] }));
    await migrateRouteDb(db, { ...FIXTURE_ROUTE_DATA, lines: [...FIXTURE_ROUTE_DATA.lines, other], stops });
    const stored = await loadRouteData(db);
    expect(stored.stops.find((s) => s.code === 'AAA')?.routeCodes).toEqual(['T1']);
  });

  it('returns empty data from an empty database, without throwing', async () => {
    const { db } = openMemoryDb();
    await migrateRouteDb(db, { ...FIXTURE_ROUTE_DATA, lines: [], stops: [] });
    await expect(loadRouteData(db)).resolves.toEqual({ version: 0, lines: [], stops: [] });
  });
});
