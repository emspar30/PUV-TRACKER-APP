// T1: foreground GPS broadcasting. The send rule, the buffer's decisions, and the buffer itself on
// Node's built-in SQLite with the app's schema.

import { DatabaseSync } from 'node:sqlite';

import type { Db, SqlParam } from '../../data/db/migrate';
import { SCHEMA_SQL } from '../../data/db/schema';
import { countOutbox, pushOutbox, readOutbox, removeOutbox } from '../../data/db/telemetryOutbox';
import {
  OFFLINE_BUFFER_SIZE,
  PACKET_MAX_BYTES,
  RELAY_SEATS_BY_TIER,
  TELEMETRY_BATCH_MAX_BYTES,
  TELEMETRY_BATCH_MAX_POINTS,
  TELEMETRY_RETRY_MAX_S,
  TELEMETRY_RETRY_MIN_S,
} from '../config';
import { seatTier } from '../telemetry/occupancy';
import { nextBatch, parseOutboxPayload, retryDelayS, sendOutcome } from '../telemetry/outbox';
import { encodeBatch, validateBatch, type TelemetryPacket } from '../telemetry/packet';
import { nextPacket, type BroadcastFix } from '../telemetry/sendRule';

const T0 = 1_790_000_000_000;
const TARGET = { vehicleId: 'R4-TEST-01', seatTier: 'amber' as const };
// About 111 m per 0.001 degree of latitude
const NORTH_120_M = 0.00108;

const fix = (overrides: Partial<BroadcastFix> = {}): BroadcastFix => ({
  lat: 8.9474,
  lon: 125.5414,
  accuracyM: 8,
  headingDeg: 90,
  speedMps: 5,
  timestampMs: T0,
  mocked: false,
  ...overrides,
});

const packet = (overrides: Partial<TelemetryPacket> = {}): TelemetryPacket => ({
  vehicle_id: 'R4-TEST-01',
  lat: 8.9474,
  lon: 125.5414,
  speed: 18,
  heading: 90,
  seats: 9,
  ts: T0 / 1000,
  ...overrides,
});

describe('the send rule', () => {
  it('sends the first good fix at once, as km/h, with the seats of the picked tier', () => {
    expect(nextPacket(null, fix(), TARGET, T0)).toEqual(packet());
  });

  it('drops a fix that is mocked, imprecise or stale', () => {
    expect(nextPacket(null, fix({ mocked: true }), TARGET, T0)).toBeNull();
    expect(nextPacket(null, fix({ accuracyM: 31 }), TARGET, T0)).toBeNull();
    expect(nextPacket(null, fix({ accuracyM: null }), TARGET, T0)).toBeNull();
    expect(nextPacket(null, fix({ timestampMs: T0 - 31_000 }), TARGET, T0)).toBeNull();
  });

  it('waits for 100 m or 30 s, whichever comes first', () => {
    const last = packet();
    expect(nextPacket(last, fix({ timestampMs: T0 + 10_000, lat: 8.9474 + 0.0005 }), TARGET, T0 + 10_000)).toBeNull();
    expect(nextPacket(last, fix({ timestampMs: T0 + 10_000, lat: 8.9474 + NORTH_120_M }), TARGET, T0 + 10_000)).not.toBeNull();
    expect(nextPacket(last, fix({ timestampMs: T0 + 29_000 }), TARGET, T0 + 29_000)).toBeNull();
    expect(nextPacket(last, fix({ timestampMs: T0 + 30_000 }), TARGET, T0 + 30_000)).not.toBeNull();
  });

  it('never sends a fix that is not newer than the last packet', () => {
    expect(nextPacket(packet(), fix({ lat: 8.9474 + NORTH_120_M }), TARGET, T0)).toBeNull();
  });

  it('works out speed and heading from the movement when the fix has none', () => {
    const next = nextPacket(
      packet({ heading: 200 }),
      fix({ timestampMs: T0 + 10_000, lat: 8.9474 + NORTH_120_M, speedMps: null, headingDeg: null }),
      TARGET,
      T0 + 10_000,
    );
    expect(next?.speed).toBeCloseTo(43, 0);
    expect(next?.heading).toBeCloseTo(0, 0);
  });

  it('keeps the last heading when standing still without one, and caps the speed', () => {
    const still = nextPacket(packet({ heading: 200 }), fix({ timestampMs: T0 + 30_000, headingDeg: null }), TARGET, T0 + 30_000);
    expect(still?.heading).toBe(200);
    expect(nextPacket(null, fix({ speedMps: 100 }), TARGET, T0)?.speed).toBe(200);
  });

  it('sends a seat count inside each tier', () => {
    for (const tier of ['green', 'amber', 'red'] as const) expect(seatTier(RELAY_SEATS_BY_TIER[tier])).toBe(tier);
  });
});

describe('the buffer decisions', () => {
  const row = (id: number, vehicle = 'R4-TEST-01') => ({ id, packet: packet({ vehicle_id: vehicle, ts: T0 / 1000 + id }) });

  it('sends the oldest vehicle first, at most a batch at a time', () => {
    expect(nextBatch([])).toBeNull();
    const batch = nextBatch([row(1), row(2, 'R4-TEST-02'), row(3)]);
    expect(batch).toMatchObject({ vehicleId: 'R4-TEST-01', ids: [1, 3] });
    const many = Array.from({ length: TELEMETRY_BATCH_MAX_POINTS + 5 }, (_, i) => row(i + 1));
    expect(nextBatch(many)?.ids).toHaveLength(TELEMETRY_BATCH_MAX_POINTS);
  });

  it('keeps on no answer and passing errors, drops what the server will never take', () => {
    expect([200, null, 401, 408, 429, 500, 503, 400, 403, 404, 413].map(sendOutcome)).toEqual([
      'sent', 'retry', 'retry', 'retry', 'retry', 'retry', 'retry', 'drop', 'drop', 'drop', 'drop',
    ]);
  });

  it('waits longer after each failure, up to the limit', () => {
    expect(retryDelayS(1)).toBe(TELEMETRY_RETRY_MIN_S);
    expect(retryDelayS(2)).toBe(TELEMETRY_RETRY_MIN_S * 2);
    expect(retryDelayS(20)).toBe(TELEMETRY_RETRY_MAX_S);
  });

  it('reads a stored packet back and refuses a broken one', () => {
    expect(parseOutboxPayload(JSON.stringify(packet()))).toEqual(packet());
    expect(parseOutboxPayload('{')).toBeNull();
    expect(parseOutboxPayload(JSON.stringify({ ...packet(), lat: 'x' }))).toBeNull();
  });

  it('fits a full buffer in one batch the server accepts', () => {
    expect(OFFLINE_BUFFER_SIZE).toBeLessThanOrEqual(TELEMETRY_BATCH_MAX_POINTS);
    const points = Array.from({ length: OFFLINE_BUFFER_SIZE }, (_, i) =>
      packet({ ts: T0 / 1000 - i, lat: 8.94741234, lon: 125.54141234, speed: 123.45, heading: 359.7 }),
    );
    const body = encodeBatch('R4-TEST-01', points);
    expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(TELEMETRY_BATCH_MAX_BYTES);
    // One position costs about as much as a third of a single packet
    expect(new TextEncoder().encode(encodeBatch('R4-TEST-01', [points[0]])).length).toBeLessThan(PACKET_MAX_BYTES);
    const result = validateBatch(JSON.parse(body), T0 / 1000);
    expect(result.ok && result.batch.points[0]).toMatchObject({ lat: 8.94741, lon: 125.54141, heading: 0 });
  });
});

function openMemoryDb(): Db {
  const raw = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql) => {
      raw.exec(sql);
    },
    runAsync: async (sql, params: SqlParam[]) => raw.prepare(sql).run(...params),
    getFirstAsync: async <T>(sql: string, params: SqlParam[]) => (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    getAllAsync: async <T>(sql: string, params: SqlParam[]) => raw.prepare(sql).all(...params) as T[],
    withTransactionAsync: async (task) => task(),
  };
}

describe('the buffer on the phone', () => {
  it('keeps packets in order and only the newest OFFLINE_BUFFER_SIZE', async () => {
    const db = openMemoryDb();
    await db.execAsync(SCHEMA_SQL);
    for (let i = 0; i < OFFLINE_BUFFER_SIZE + 3; i += 1) await pushOutbox(db, packet({ ts: i + 1 }), T0);
    const rows = await readOutbox(db);
    expect(rows).toHaveLength(OFFLINE_BUFFER_SIZE);
    expect(rows[0].packet.ts).toBe(4);
    expect(rows.at(-1)?.packet.ts).toBe(OFFLINE_BUFFER_SIZE + 3);
  });

  it('removes sent rows and rows that cannot be read', async () => {
    const db = openMemoryDb();
    await db.execAsync(SCHEMA_SQL);
    await pushOutbox(db, packet({ ts: 1 }), T0);
    await pushOutbox(db, packet({ ts: 2 }), T0);
    await db.runAsync('INSERT INTO telemetry_buffer (payload, created_at) VALUES (?, ?)', ['broken', T0]);
    const rows = await readOutbox(db);
    expect(rows.map((r) => r.packet.ts)).toEqual([1, 2]);
    expect(await countOutbox(db)).toBe(2);
    await removeOutbox(db, [rows[0].id]);
    expect((await readOutbox(db)).map((r) => r.packet.ts)).toEqual([2]);
  });
});
