import { R4_LINES, R4_STATIONS, ROUTE_DATA_VERSION } from '../../seed/r4.placeholder';
import { migrateDb, readRouteDataVersion, shouldReseed } from '../migrate';
import { clearRouteNetworkCache, loadRouteNetwork, stationsOnLine } from '../routeRepository';
import { SCHEMA_VERSION } from '../schema';
import { buildSeedRows } from '../seedRows';
import { openTestDb } from './nodeSqlite';

// Order along each traced line (JCA projects onto the R. Calo junction just before RCA outbound).
// The return path leaves JAQNO at R. Calo, so it does not serve IMA or TSO.
const OUTBOUND_ORDER = ['IMA', 'TSO', 'JCA', 'RCA', 'MCA', 'DEO'];
const RETURN_ORDER = ['DEO', 'MCA', 'JCA', 'RCA'];

beforeEach(() => clearRouteNetworkCache());

describe('seed maps to rows', () => {
  const rows = buildSeedRows(R4_LINES, R4_STATIONS, ROUTE_DATA_VERSION);

  it('produces two directed lines carrying the seed version', () => {
    expect(rows.routes.map((r) => [r.route_id, r.direction])).toEqual([
      ['R4-OUT', 'outbound'],
      ['R4-RET', 'return'],
    ]);
    for (const route of rows.routes) {
      expect(route.data_version).toBe(ROUTE_DATA_VERSION);
      expect(JSON.parse(route.primary_geojson).geometry.type).toBe('LineString');
    }
  });

  it('produces one station row per placeholder stop', () => {
    expect(rows.stations.map((s) => s.code).sort()).toEqual([...OUTBOUND_ORDER].sort());
  });

  it('orders stops by increasing distance along each line', () => {
    for (const routeId of ['R4-OUT', 'R4-RET']) {
      const links = rows.routeStations.filter((rs) => rs.route_id === routeId);
      expect(links.map((rs) => rs.seq)).toEqual(links.map((_, i) => i + 1));
      for (let i = 1; i < links.length; i++) {
        expect(links[i].chainage_km).toBeGreaterThan(links[i - 1].chainage_km);
      }
    }
    const outbound = rows.routeStations.filter((rs) => rs.route_id === 'R4-OUT').map((rs) => rs.station_id);
    const inbound = rows.routeStations.filter((rs) => rs.route_id === 'R4-RET').map((rs) => rs.station_id);
    expect(outbound).toEqual(OUTBOUND_ORDER);
    expect(inbound).toEqual(RETURN_ORDER);
  });
});

describe('migration on real SQLite', () => {
  it('creates the five PRD 12.1 tables and stores the seed version', async () => {
    const db = openTestDb();
    await migrateDb(db);

    const tables = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name);
    expect(tables).toEqual(['franchise_routes', 'route_alternatives', 'route_stations', 'stations', 'telemetry_buffer']);
    expect(db.raw.prepare('PRAGMA user_version').get()).toEqual({ user_version: SCHEMA_VERSION });
    expect(await readRouteDataVersion(db)).toBe(ROUTE_DATA_VERSION);
  });

  it('reads back two lines with parsed polylines, fares and ordered stops', async () => {
    const db = openTestDb();
    await migrateDb(db);
    const network = await loadRouteNetwork(db);

    expect(network.version).toBe(ROUTE_DATA_VERSION);
    expect(network.lines.map((line) => line.routeId)).toEqual(['R4-OUT', 'R4-RET']);
    expect(network.lines[0].coordinates).toEqual(R4_LINES[0].coordinates);
    expect(network.lines[0].fare).toEqual({
      baseFare: R4_LINES[0].baseFare,
      baseKm: R4_LINES[0].baseKm,
      perKmRate: R4_LINES[0].perKmRate,
    });
    expect(stationsOnLine(network, 'R4-OUT').map((s) => s.code)).toEqual(OUTBOUND_ORDER);
    expect(stationsOnLine(network, 'R4-RET').map((s) => s.code)).toEqual(RETURN_ORDER);
  });
});

describe('newer route_data_version replaces rows', () => {
  it('reseeds only when the seed version is higher', () => {
    expect(shouldReseed(0, 1)).toBe(true);
    expect(shouldReseed(1, 2)).toBe(true);
    expect(shouldReseed(1, 1)).toBe(false);
    expect(shouldReseed(2, 1)).toBe(false);
  });

  it('replaces the route rows on a version bump and does nothing on the same version', async () => {
    const db = openTestDb();
    await migrateDb(db);

    // Same version, changed data: nothing may change
    const renamed = buildSeedRows(
      R4_LINES.map((line) => ({ ...line, routeName: `${line.routeName} (edited)` })),
      R4_STATIONS,
      ROUTE_DATA_VERSION,
    );
    await migrateDb(db, { rows: renamed, version: ROUTE_DATA_VERSION });
    const unchanged = await db.getAllAsync<{ route_name: string }>('SELECT route_name FROM franchise_routes');
    expect(unchanged.every((row) => !row.route_name.includes('(edited)'))).toBe(true);

    // Higher version: the rows are replaced, not added to
    const nextVersion = ROUTE_DATA_VERSION + 1;
    const bumped = buildSeedRows(
      R4_LINES.map((line) => ({ ...line, routeName: `${line.routeName} (edited)` })),
      R4_STATIONS.slice(0, 3),
      nextVersion,
    );
    await migrateDb(db, { rows: bumped, version: nextVersion });

    const routes = await db.getAllAsync<{ route_name: string; data_version: number }>(
      'SELECT route_name, data_version FROM franchise_routes',
    );
    expect(routes).toHaveLength(2);
    expect(routes.every((row) => row.route_name.includes('(edited)') && row.data_version === nextVersion)).toBe(true);
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM stations').get()).toEqual({ n: 3 });
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM route_stations').get()).toEqual({
      n: bumped.routeStations.length,
    });
  });

  it('keeps the old rows if a reseed fails part way', async () => {
    const db = openTestDb();
    await migrateDb(db);
    const broken = buildSeedRows(R4_LINES, R4_STATIONS, ROUTE_DATA_VERSION + 1);
    // Two stations with the same code break the UNIQUE rule mid-transaction
    broken.stations.push({ ...broken.stations[0], station_id: 'DUP' });

    await expect(migrateDb(db, { rows: broken, version: ROUTE_DATA_VERSION + 1 })).rejects.toThrow();
    expect(await readRouteDataVersion(db)).toBe(ROUTE_DATA_VERSION);
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM stations').get()).toEqual({ n: R4_STATIONS.length });
  });
});
