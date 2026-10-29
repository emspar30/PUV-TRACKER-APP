// NM1: stop passages for the Night Mode stop view. A position near a stop of the vehicle's route is
// one passage; the same stop again within NODE_PASS_GAP_MIN is not; 60 m away is not. Ingest records
// them as best effort, and the server's copy of the stops matches the app's route data.

import { createDemoVehicles } from '../../data/demo/demoVehicles';
import { getSeedRouteData } from '../../data/routeSource';
import { SEED_STATIONS } from '../../data/seed/routes';
import { handleIngest, type IngestDeps, type NodeEventRow } from '../../../supabase/functions/_shared/ingestCore';
import { newPassages, type PassStop } from '../../../supabase/functions/_shared/nodePassage';
import { ROUTE_STOPS } from '../../../supabase/functions/_shared/routeStops.generated';
import { DEMO_SEED, NIGHT_FEED_DELAY_MIN, NIGHT_STOP_WINDOW_MIN, NODE_PASS_GAP_MIN, NODE_PASS_RADIUS_M } from '../config';
import { encodePacket } from '../telemetry/packet';

const M_PER_DEG = 111195;
const STOP: PassStop = { code: 'CSU', lat: 8.95, lon: 125.54 };
const MIN = 60_000;
const T0 = 1_790_000_000_000;
// A point `northM` metres north of the stop
const at = (northM: number, atMs: number) => ({ lat: STOP.lat + northM / M_PER_DEG, lon: STOP.lon, atMs });

describe('stop passages (NM1)', () => {
  it('a line of positions passing a stop gives one passage, at the first position near it', () => {
    const points = [at(-200, T0), at(-30, T0 + 10_000), at(0, T0 + 20_000), at(30, T0 + 30_000), at(200, T0 + 40_000)];
    expect(newPassages(points, [STOP], {})).toEqual([{ stopCode: 'CSU', atMs: T0 + 10_000 }]);
  });

  it(`a second pass within ${NODE_PASS_GAP_MIN} min gives none; after it, one`, () => {
    expect(newPassages([at(0, T0 + (NODE_PASS_GAP_MIN - 1) * MIN)], [STOP], { CSU: T0 })).toEqual([]);
    expect(newPassages([at(0, T0 + NODE_PASS_GAP_MIN * MIN)], [STOP], { CSU: T0 })).toHaveLength(1);
  });

  it(`a position more than ${NODE_PASS_RADIUS_M} m away gives none`, () => {
    expect(newPassages([at(NODE_PASS_RADIUS_M + 10, T0)], [STOP], {})).toEqual([]);
  });

  it("the server's copy of each route's stops matches the app's route data (rerun scripts/server-route-stops.ts)", () => {
    const routes = [...new Set(SEED_STATIONS.flatMap((station) => station.routeCodes))].sort();
    expect(Object.keys(ROUTE_STOPS).sort()).toEqual(routes);
    for (const route of routes) {
      const app = SEED_STATIONS.filter((station) => station.routeCodes.includes(route)).map((station) => station.code);
      expect(ROUTE_STOPS[route].map((stop) => stop.code)).toEqual(app);
    }
  });
});

describe('ingest records stop passages (NM1)', () => {
  const stop = ROUTE_STOPS.R4[0];
  const packet = { vehicle_id: 'R4-TEST-01', lat: stop.lat, lon: stop.lon, speed: 12, heading: 90, seats: 4, ts: T0 / 1000 - 2 };

  function backend(failPassages = false) {
    const passages: NodeEventRow[] = [];
    const deps: IngestDeps = {
      nowMs: () => T0,
      getUserId: async () => 'writer',
      isAllowedWriter: async () => true,
      getVehicle: async () => ({ active: true, route_id: 'R4' }),
      getLatest: async () => null,
      upsertLatest: async () => undefined,
      getHistoryNewest: async () => null,
      insertHistory: async () => undefined,
      log: async () => undefined,
      recentPassages: async () => passages.map((row) => ({ stop_code: row.stop_code, passed_at: row.passed_at })),
      insertPassages: async (rows) => {
        if (failPassages) throw new Error('insert failed');
        passages.push(...rows);
      },
    };
    return { deps, passages };
  }
  const post = (body: string) => ({ method: 'POST', authorization: 'Bearer t', body });

  it('stores one passage, with route and stop but no rider or position', async () => {
    const { deps, passages } = backend();
    const response = await handleIngest(post(encodePacket(packet)), deps);
    expect(response.status).toBe(200);
    expect(passages).toEqual([{ vehicle_id: 'R4-TEST-01', route_id: 'R4', stop_code: stop.code, passed_at: new Date(packet.ts * 1000).toISOString() }]);
  });

  it('a failed passage insert never fails the position', async () => {
    const { deps } = backend(true);
    const response = await handleIngest(post(encodePacket(packet)), deps);
    expect(response).toMatchObject({ status: 200, body: { status: 'accepted' } });
  });
});

describe('demo night stop view (NM1)', () => {
  it('lists recent passages of the demo multicabs, none younger than the night delay, newest first', async () => {
    const data = getSeedRouteData();
    const nowMs = Date.UTC(2026, 9, 29, 14, 0, 0);
    const lines = data.lines.map((line) => ({ ...line })) as never;
    const repo = createDemoVehicles(lines, data.stops, { seed: DEMO_SEED, clock: { now: () => nowMs, setInterval: () => 0, clearInterval: () => undefined } });
    const passages = (await repo.nightPassages?.('R4')) ?? [];
    expect(passages.length).toBeGreaterThan(0);
    for (const passage of passages) {
      expect(nowMs - passage.passedAtMs).toBeGreaterThanOrEqual(NIGHT_FEED_DELAY_MIN * MIN);
      expect(nowMs - passage.passedAtMs).toBeLessThanOrEqual(NIGHT_STOP_WINDOW_MIN * MIN);
    }
    expect(passages.map((passage) => passage.passedAtMs)).toEqual([...passages.map((passage) => passage.passedAtMs)].sort((a, b) => b - a));
  });
});
