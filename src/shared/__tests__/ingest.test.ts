// The ingest endpoint's rules, run against in-memory fakes. No Supabase project is involved:
// these tests prove the function's logic, not the database's security rules (see docs/AUDIT_BACKLOG.md).

import {
  handleIngest,
  type IngestDeps,
  type IngestLogEntry,
  type TelemetryLatestRow,
} from '../../../supabase/functions/_shared/ingestCore';
import { encodePacket, type TelemetryPacket } from '../telemetry/packet';

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
    log: async (entry) => {
      log.push(entry);
    },
  };
  return { deps, latest, log };
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
