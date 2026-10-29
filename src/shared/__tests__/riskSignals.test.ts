// RK1: risk signals. The speed jump rule (80 km/h passes, 300 km/h fails, 40 m of GPS wander in 1 s
// at a stop passes), ingest refusing and booking a jump, and the migration's shape.

import * as fs from 'node:fs';
import * as path from 'node:path';

import { handleIngest, type IngestDeps } from '../../../supabase/functions/_shared/ingestCore';
import { impliedSpeedKmh, isImpossibleJump } from '../../../supabase/functions/_shared/speedJump';
import { IMPOSSIBLE_SPEED_KMH } from '../config';
import { encodeBatch, encodePacket } from '../telemetry/packet';

const M_PER_DEG = 111195;
const T0 = 1_790_000_000_000;
const START = { lat: 8.95, lon: 125.54, atMs: T0 };
// `northM` metres north of START, `seconds` later
const later = (northM: number, seconds: number) => ({ lat: START.lat + northM / M_PER_DEG, lon: START.lon, atMs: T0 + seconds * 1000 });

describe('speed jump rule (RK1)', () => {
  it('80 km/h passes, 300 km/h fails', () => {
    // 80 km/h for 60 s is about 1333 m; 300 km/h is 5000 m
    expect(isImpossibleJump(START, later(1333, 60))).toBe(false);
    expect(isImpossibleJump(START, later(5000, 60))).toBe(true);
    expect(impliedSpeedKmh(START, later(5000, 60))).toBeGreaterThan(IMPOSSIBLE_SPEED_KMH);
  });

  it('40 m of GPS wander in 1 s at a stop passes, thanks to the allowance', () => {
    expect(isImpossibleJump(START, later(40, 1))).toBe(false);
  });

  it('with no earlier position, or the same time, there is no jump', () => {
    expect(isImpossibleJump(null, later(5000, 60))).toBe(false);
    expect(impliedSpeedKmh(START, later(5000, 0))).toBe(0);
  });
});

describe('ingest refuses an impossible jump and books it (RK1)', () => {
  const NOW_S = T0 / 1000;
  const base = { vehicle_id: 'R4-TEST-01', speed: 30, heading: 0, seats: 4 };

  function backend() {
    const booked: { userId: string; kind: string; detail: Record<string, unknown> }[] = [];
    const history: unknown[] = [];
    let latest: { packet_ts: string; stopped_since: string | null; lat: number; lon: number } | null = {
      packet_ts: new Date(T0 - 60_000).toISOString(),
      stopped_since: null,
      lat: START.lat,
      lon: START.lon,
    };
    const deps: IngestDeps = {
      nowMs: () => T0,
      getUserId: async () => 'writer',
      isAllowedWriter: async () => true,
      getVehicle: async () => ({ active: true }),
      getLatest: async () => latest,
      upsertLatest: async (row) => {
        latest = { packet_ts: row.packet_ts, stopped_since: row.stopped_since, lat: row.lat, lon: row.lon };
      },
      getHistoryNewest: async () => null,
      insertHistory: async (rows) => {
        history.push(...rows);
      },
      log: async () => undefined,
      bookRisk: async (userId, kind, detail) => {
        booked.push({ userId, kind, detail });
      },
    };
    return { deps, booked, history };
  }
  const post = (body: string) => ({ method: 'POST', authorization: 'Bearer t', body });

  it('a single position 5 km from the marker a minute later is refused and booked', async () => {
    const { deps, booked } = backend();
    const far = later(5000, 0);
    const response = await handleIngest(post(encodePacket({ ...base, lat: far.lat, lon: far.lon, ts: NOW_S })), deps);
    expect(response).toEqual({ status: 400, body: { error: 'impossible_speed' } });
    expect(booked).toEqual([{ userId: 'writer', kind: 'impossible_speed', detail: { vehicle_id: 'R4-TEST-01' } }]);
  });

  it('a normal move is accepted and books nothing', async () => {
    const { deps, booked } = backend();
    const near = later(500, 0);
    const response = await handleIngest(post(encodePacket({ ...base, lat: near.lat, lon: near.lon, ts: NOW_S })), deps);
    expect(response.status).toBe(200);
    expect(booked).toEqual([]);
  });

  it('a batch drops the jumping position, keeps the rest, and books once', async () => {
    const { deps, booked, history } = backend();
    const points = [later(300, 0), later(9000, 0), later(600, 0)].map((point, i) => ({ vehicle_id: 'R4-TEST-01', lat: point.lat, lon: point.lon, speed: 30, heading: 0, seats: 4, ts: NOW_S - 20 + i * 10 }));
    const response = await handleIngest(post(encodeBatch('R4-TEST-01', points)), deps);
    expect(response.status).toBe(200);
    expect(history).toHaveLength(2);
    expect(booked).toHaveLength(1);
  });
});

describe('risk signals migration (RK1)', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261029000001_risk_signals.sql'), 'utf8').replace(/--.*$/gm, '');

  it('keeps the events and the review queue server-only', () => {
    for (const table of ['public.risk_events', 'public.account_review_queue']) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`revoke all on ${table} from anon, authenticated`);
    }
  });

  it('lets the phone report only mock_location, once a minute, and nobody else book', () => {
    expect(sql).toContain("kind <> 'mock_location'");
    expect(sql).toContain("interval '1 minute'");
    expect(sql).toContain('grant execute on function public.report_risk(text) to authenticated');
    expect(sql).toContain('revoke execute on function public.book_risk(uuid, text, jsonb) from public, anon, authenticated');
  });
});
