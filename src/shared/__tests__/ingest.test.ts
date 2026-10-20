// The ingest endpoint's rules, run against in-memory fakes. No Supabase project is involved:
// these tests prove the function's logic, not the database's security rules (see docs/AUDIT_BACKLOG.md).

import {
  handleIngest,
  type IngestDeps,
  type IngestLogEntry,
  type TelemetryHistoryRow,
  type TelemetryLatestRow,
} from '../../../supabase/functions/_shared/ingestCore';
import { encodeBatch, encodePacket, type TelemetryPacket } from '../telemetry/packet';

const NOW_MS = 1_790_000_000_000;
const NOW_S = NOW_MS / 1000;

const WRITER = { token: 'token-writer', userId: 'user-writer' };
const OUTSIDER = { token: 'token-outsider', userId: 'user-outsider' };

const PACKET: TelemetryPacket = {
  vehicle_id: 'R4-TEST-01',
  lat: 8.947459,
  lon: 125.541426,
  speed: 23.5,
  heading: 101,
  seats: 8,
  ts: NOW_S - 2,
};

function fakeBackend() {
  const latest = new Map<string, TelemetryLatestRow>();
  const log: IngestLogEntry[] = [];
  const history: TelemetryHistoryRow[] = [];
  let historyFails = false;
  const vehicles = new Map([
    ['R4-TEST-01', { active: true }],
    ['R4-TEST-OFF', { active: false }],
  ]);
  const deps: IngestDeps = {
    nowMs: () => NOW_MS,
    getUserId: async (token) =>
      token === WRITER.token ? WRITER.userId : token === OUTSIDER.token ? OUTSIDER.userId : null,
    isAllowedWriter: async (userId) => userId === WRITER.userId,
    getVehicle: async (id) => vehicles.get(id) ?? null,
    getLatest: async (id) => latest.get(id) ?? null,
    upsertLatest: async (row) => {
      latest.set(row.vehicle_id, row);
    },
    getHistoryNewest: async (id) =>
      history
        .filter((row) => row.vehicle_id === id)
        .map((row) => row.packet_ts)
        .sort()
        .at(-1) ?? null,
    insertHistory: async (rows) => {
      if (historyFails) throw new Error('insert failed');
      history.push(...rows);
    },
    log: async (entry) => {
      log.push(entry);
    },
  };
  return {
    deps,
    latest,
    log,
    history,
    failHistory: () => {
      historyFails = true;
    },
  };
}

const post = (body: string, token: string | null = WRITER.token) => ({
  method: 'POST',
  authorization: token === null ? null : `Bearer ${token}`,
  body,
});

const send = (backend: ReturnType<typeof fakeBackend>, packet: Partial<TelemetryPacket> = {}, token = WRITER.token) =>
  handleIngest(post(encodePacket({ ...PACKET, ...packet }), token), backend.deps);

describe('ingest accepts an allowlisted writer', () => {
  it('stores the position as unverified, with the reason', async () => {
    const backend = fakeBackend();
    const response = await send(backend);

    expect(response).toEqual({
      status: 200,
      body: { status: 'accepted', verified: false, verification_reasons: ['verification_disabled'] },
    });
    expect(backend.latest.get('R4-TEST-01')).toEqual({
      vehicle_id: 'R4-TEST-01',
      lat: 8.947459,
      lon: 125.541426,
      speed_kmh: 23.5,
      heading_deg: 101,
      seats_taken: 8,
      packet_ts: new Date((NOW_S - 2) * 1000).toISOString(),
      stopped_since: null,
      verified: false,
      verification_reasons: ['verification_disabled'],
    });
  });

  it('stores no user id with the position', async () => {
    const backend = fakeBackend();
    await send(backend);
    expect(JSON.stringify(backend.latest.get('R4-TEST-01'))).not.toContain(WRITER.userId);
  });

  it('records who sent it in the audit log only', async () => {
    const backend = fakeBackend();
    await send(backend);
    expect(backend.log).toEqual([
      { user_id: WRITER.userId, vehicle_id: 'R4-TEST-01', accepted: true, reason: 'accepted' },
    ]);
  });
});

describe('ingest rejects callers who may not write', () => {
  it('rejects an anonymous caller', async () => {
    const backend = fakeBackend();
    expect(await handleIngest(post(encodePacket(PACKET), null), backend.deps)).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
    expect(backend.latest.size).toBe(0);
  });

  it('rejects an invalid or expired token', async () => {
    const backend = fakeBackend();
    expect((await send(backend, {}, 'not-a-session')).status).toBe(401);
  });

  it('rejects a header that is not a bearer token, such as a bare publishable key', async () => {
    const backend = fakeBackend();
    const response = await handleIngest(
      { method: 'POST', authorization: 'sb_publishable_xxx', body: encodePacket(PACKET) },
      backend.deps,
    );
    expect(response.status).toBe(401);
  });

  it('rejects a non-allowlisted account, changes nothing and logs nothing about it', async () => {
    const backend = fakeBackend();
    expect(await send(backend, {}, OUTSIDER.token)).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(backend.latest.size).toBe(0);
    expect(backend.log).toEqual([]);
  });

  it('rejects methods other than POST', async () => {
    const backend = fakeBackend();
    const response = await handleIngest({ ...post(encodePacket(PACKET)), method: 'GET' }, backend.deps);
    expect(response.status).toBe(405);
  });
});

describe('ingest rejects malformed packets', () => {
  const cases: [string, string, number, string][] = [
    ['text that is not JSON', 'not json', 400, 'invalid_json'],
    ['a missing field', JSON.stringify({ ...PACKET, seats: undefined }), 400, 'missing_field'],
    ['text where a number is expected', JSON.stringify({ ...PACKET, lat: 'x' }), 400, 'bad_lat'],
    ['a latitude out of range', JSON.stringify({ ...PACKET, lat: 95 }), 400, 'bad_lat'],
    ['seats above capacity', JSON.stringify({ ...PACKET, seats: 17 }), 400, 'bad_seats'],
    ['an unknown extra field', JSON.stringify({ ...PACKET, x: 1 }), 400, 'unknown_field'],
    ['a timestamp older than 120 s', JSON.stringify({ ...PACKET, ts: NOW_S - 121 }), 400, 'too_old'],
    ['a timestamp more than 30 s ahead', JSON.stringify({ ...PACKET, ts: NOW_S + 31 }), 400, 'in_future'],
    ['a body over the size limit', JSON.stringify({ ...PACKET, pad: 'x'.repeat(200) }), 413, 'packet_too_large'],
  ];

  it.each(cases)('rejects %s', async (_label, body, status, error) => {
    const backend = fakeBackend();
    const response = await handleIngest(post(body), backend.deps);
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ error });
    expect(backend.latest.size).toBe(0);
  });

  it('rejects an unknown vehicle and an inactive vehicle', async () => {
    const backend = fakeBackend();
    expect(await send(backend, { vehicle_id: 'NOPE-1' })).toEqual({ status: 404, body: { error: 'unknown_vehicle' } });
    expect(await send(backend, { vehicle_id: 'R4-TEST-OFF' })).toEqual({
      status: 404,
      body: { error: 'unknown_vehicle' },
    });
    expect(backend.latest.size).toBe(0);
  });
});

describe('ingest keeps only the newest position', () => {
  it('ignores a packet that is not newer than the stored one', async () => {
    const backend = fakeBackend();
    await send(backend, { ts: NOW_S - 5, seats: 3 });
    expect(await send(backend, { ts: NOW_S - 9, seats: 9 })).toEqual({
      status: 200,
      body: { status: 'ignored', reason: 'not_newer' },
    });
    expect(await send(backend, { ts: NOW_S - 5, seats: 9 })).toMatchObject({ body: { status: 'ignored' } });
    expect(backend.latest.get('R4-TEST-01')?.seats_taken).toBe(3);
  });

  it('replaces the stored position with a newer one', async () => {
    const backend = fakeBackend();
    await send(backend, { ts: NOW_S - 9, seats: 3 });
    await send(backend, { ts: NOW_S - 5, seats: 9 });
    expect(backend.latest.get('R4-TEST-01')?.seats_taken).toBe(9);
  });
});

describe('ingest tracks when a vehicle stopped', () => {
  const iso = (secondsAgo: number) => new Date((NOW_S - secondsAgo) * 1000).toISOString();

  it('keeps the start of an unbroken run of stopped packets', async () => {
    const backend = fakeBackend();
    await send(backend, { ts: NOW_S - 90, speed: 0 });
    await send(backend, { ts: NOW_S - 60, speed: 1.9 });
    await send(backend, { ts: NOW_S - 30, speed: 0.5 });
    expect(backend.latest.get('R4-TEST-01')?.stopped_since).toBe(iso(90));
  });

  it('clears it when the vehicle moves, and starts again at the next stop', async () => {
    const backend = fakeBackend();
    await send(backend, { ts: NOW_S - 90, speed: 0 });
    await send(backend, { ts: NOW_S - 60, speed: 2 });
    expect(backend.latest.get('R4-TEST-01')?.stopped_since).toBeNull();
    await send(backend, { ts: NOW_S - 30, speed: 0 });
    expect(backend.latest.get('R4-TEST-01')?.stopped_since).toBe(iso(30));
  });
});

describe('ingest keeps the history of a single packet', () => {
  it('adds an accepted position to the history and still moves the marker when that insert fails', async () => {
    const backend = fakeBackend();
    await send(backend, { ts: NOW_S - 9 });
    expect(backend.history).toEqual([
      { vehicle_id: 'R4-TEST-01', lat: 8.947459, lon: 125.541426, speed_kmh: 23.5, packet_ts: new Date((NOW_S - 9) * 1000).toISOString() },
    ]);
    backend.failHistory();
    expect(await send(backend, { ts: NOW_S - 5 })).toMatchObject({ status: 200, body: { status: 'accepted' } });
    expect(backend.latest.get('R4-TEST-01')?.packet_ts).toBe(new Date((NOW_S - 5) * 1000).toISOString());
  });
});

describe('ingest accepts a batch of buffered positions (T1)', () => {
  const at = (secondsAgo: number, extra: Partial<TelemetryPacket> = {}): TelemetryPacket => ({ ...PACKET, ts: NOW_S - secondsAgo, ...extra });
  const sendBatch = (backend: ReturnType<typeof fakeBackend>, points: TelemetryPacket[], token = WRITER.token) =>
    handleIngest(post(encodeBatch('R4-TEST-01', points), token), backend.deps);

  it('stores every position as history and the newest as the marker', async () => {
    const backend = fakeBackend();
    const response = await sendBatch(backend, [at(600), at(300, { seats: 3 }), at(10, { seats: 9 })]);
    expect(response).toEqual({ status: 200, body: { status: 'batch', stored: 3, skipped: 0, latest: 'accepted' } });
    expect(backend.history.map((row) => row.packet_ts)).toEqual([600, 300, 10].map((s) => new Date((NOW_S - s) * 1000).toISOString()));
    expect(backend.latest.get('R4-TEST-01')).toMatchObject({ seats_taken: 9, verified: false });
    expect(backend.log).toEqual([{ user_id: WRITER.userId, vehicle_id: 'R4-TEST-01', accepted: true, reason: 'batch_accepted' }]);
  });

  it('keeps a dead-zone backlog as history but leaves the marker when the newest is over 120 s old', async () => {
    const backend = fakeBackend();
    const response = await sendBatch(backend, [at(900), at(600), at(121)]);
    expect(response.body).toEqual({ status: 'batch', stored: 3, skipped: 0, latest: 'too_old' });
    expect(backend.latest.size).toBe(0);
  });

  it('leaves out positions over 30 minutes old and counts them', async () => {
    const backend = fakeBackend();
    const response = await sendBatch(backend, [at(1801), at(1700), at(5)]);
    expect(response.body).toEqual({ status: 'batch', stored: 2, skipped: 1, latest: 'accepted' });
  });

  it('does not store a batch twice when it is sent again', async () => {
    const backend = fakeBackend();
    await sendBatch(backend, [at(60), at(30)]);
    const again = await sendBatch(backend, [at(60), at(30), at(5)]);
    expect(again.body).toEqual({ status: 'batch', stored: 1, skipped: 2, latest: 'accepted' });
    expect(backend.history).toHaveLength(3);
    expect(await sendBatch(backend, [at(60), at(30), at(5)])).toMatchObject({ body: { stored: 0, latest: 'not_newer' } });
  });

  it('sorts positions sent out of order and keeps one per timestamp', async () => {
    const backend = fakeBackend();
    await sendBatch(backend, [at(5, { seats: 9 }), at(50), at(50)]);
    expect(backend.history.map((row) => row.packet_ts)).toEqual([50, 5].map((s) => new Date((NOW_S - s) * 1000).toISOString()));
    expect(backend.latest.get('R4-TEST-01')?.seats_taken).toBe(9);
  });

  it('carries the stopped run through the batch', async () => {
    const backend = fakeBackend();
    await send(backend, { ts: NOW_S - 100, speed: 0 });
    await sendBatch(backend, [at(70, { speed: 0 }), at(40, { speed: 1 }), at(10, { speed: 0 })]);
    expect(backend.latest.get('R4-TEST-01')?.stopped_since).toBe(new Date((NOW_S - 100) * 1000).toISOString());
    await sendBatch(backend, [at(8, { speed: 30 }), at(4, { speed: 0 })]);
    expect(backend.latest.get('R4-TEST-01')?.stopped_since).toBe(new Date((NOW_S - 4) * 1000).toISOString());
  });

  it('fails without moving the marker when the history cannot be stored, so the phone sends it again', async () => {
    const backend = fakeBackend();
    backend.failHistory();
    await expect(sendBatch(backend, [at(10)])).rejects.toThrow('insert failed');
    expect(backend.latest.size).toBe(0);
  });

  it('applies the same writer rules as a single packet', async () => {
    const backend = fakeBackend();
    expect(await sendBatch(backend, [at(5)], OUTSIDER.token)).toEqual({ status: 403, body: { error: 'forbidden' } });
    const inactive = await handleIngest(post(encodeBatch('R4-TEST-OFF', [at(5)])), backend.deps);
    expect(inactive).toEqual({ status: 404, body: { error: 'unknown_vehicle' } });
  });

  it('accepts a full buffer of 60 positions within the batch size limit', async () => {
    const backend = fakeBackend();
    const points = Array.from({ length: 60 }, (_, i) => at(1790 - i * 30, { lat: 8.9474591, lon: 125.5414261, speed: 123.4, heading: 359 }));
    const body = encodeBatch('R4-TEST-01', points);
    expect(new TextEncoder().encode(body).length).toBeLessThan(4096);
    expect((await handleIngest(post(body), backend.deps)).body).toMatchObject({ stored: 60 });
  });

  const bad: [string, unknown, string, string | null][] = [
    ['an empty batch', { v: 'R4-TEST-01', p: [] }, 'bad_points', null],
    ['more than 60 positions', { v: 'R4-TEST-01', p: Array.from({ length: 61 }, () => [NOW_S, 8.9, 125.5, 0, 0, 0]) }, 'bad_points', null],
    ['a position of the wrong length', { v: 'R4-TEST-01', p: [[NOW_S, 8.9, 125.5]] }, 'bad_points', 'p.0'],
    ['a bad position', { v: 'R4-TEST-01', p: [[NOW_S, 8.9, 125.5, 0, 0, 0], [NOW_S, 95, 125.5, 0, 0, 0]] }, 'bad_lat', 'p.1'],
    ['a position in the future', { v: 'R4-TEST-01', p: [[NOW_S + 31, 8.9, 125.5, 0, 0, 0]] }, 'in_future', 'p.0'],
    ['an extra field', { v: 'R4-TEST-01', p: [[NOW_S, 8.9, 125.5, 0, 0, 0]], user: 'x' }, 'unknown_field', 'user'],
    ['no vehicle', { p: [[NOW_S, 8.9, 125.5, 0, 0, 0]] }, 'missing_field', 'v'],
  ];

  it.each(bad)('rejects %s', async (_label, body, error, field) => {
    const backend = fakeBackend();
    const response = await handleIngest(post(JSON.stringify(body)), backend.deps);
    expect(response).toEqual({ status: 400, body: field ? { error, field } : { error } });
    expect(backend.history).toEqual([]);
  });

  it('rejects a body over the batch size limit', async () => {
    const backend = fakeBackend();
    const response = await handleIngest(post(JSON.stringify({ v: 'R4-TEST-01', p: [], pad: 'x'.repeat(4100) })), backend.deps);
    expect(response).toEqual({ status: 413, body: { error: 'packet_too_large' } });
  });
});
