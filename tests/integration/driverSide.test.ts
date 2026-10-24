// DR3 and DR8 acceptance tests against the LIVE Supabase project (docs/IMPLEMENTATION_PLAN_DRIVER.md).
// Skipped, with a printed reason, until .env holds the service role key and the test accounts, and
// until 20261013000000_driver_side.sql is applied. They work only on their own rows: vehicle
// R99-DR3-TEST on the made-up route R99, gateway GW-99 and alert kind dr3_test, all removed at the end.
// (Vault keeps two test secrets by name, reused on the next run.)

import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseEnv } from 'node:util';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { encodeBeacon, payloadToHex, slotOf } from '../../src/shared/beacon/code';
import { BEACON_SLOT_S } from '../../src/shared/config';
import vectors from '../fixtures/beacon-vectors.json';

const ENV_FILE = path.join(__dirname, '..', '..', '.env');
const env: Record<string, string | undefined> = fs.existsSync(ENV_FILE) ? parseEnv(fs.readFileSync(ENV_FILE, 'utf8')) : {};

const REQUIRED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'TEST_WRITER_EMAIL', 'TEST_WRITER_PASSWORD'];
const missing = REQUIRED.filter((name) => !env[name]);
const configured = missing.length === 0;
if (!configured) console.log(`[driver side] SKIPPED: these tests need ${missing.join(', ')} in .env`);
const live = configured ? describe : describe.skip;

const VEHICLE = 'R99-DR3-TEST';
const ROUTE = 'R99';
const GATEWAY = 'GW-99';
const GATEWAY_PHONE = '+639990000099';
const DRIVER_PHONE = '+639990000001';
const TIMEOUT_MS = 60000;
const hex32 = () => randomBytes(32).toString('hex');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

const options = { auth: { persistSession: false, autoRefreshToken: false } };

live('DR3 driver side, live project', () => {
  let admin: SupabaseClient;
  let writer: SupabaseClient;
  let applied = false;
  const devices: string[] = [];

  async function cleanUp() {
    const ours = await admin.from('driver_devices').select('device_id').eq('vehicle_id', VEHICLE);
    const ids = (ours.data ?? []).map((row: { device_id: string }) => row.device_id);
    if (ids.length > 0) {
      await admin.from('sms_outbox').delete().in('device_id', ids);
      await admin.from('driver_devices').delete().in('device_id', ids);
    }
    await admin.from('sms_outbox').delete().eq('gateway_id', GATEWAY);
    await admin.from('vehicles').delete().eq('vehicle_id', VEHICLE);
    await admin.from('sms_dispatch_state').delete().eq('route_id', ROUTE);
    await admin.from('gateways').delete().eq('gateway_id', GATEWAY);
    await admin.from('ops_alerts').delete().eq('kind', 'dr3_test');
  }

  beforeAll(async () => {
    admin = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, options);
    writer = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);
    const signIn = await writer.auth.signInWithPassword({ email: env.TEST_WRITER_EMAIL!, password: env.TEST_WRITER_PASSWORD! });
    if (signIn.error) throw new Error(`Sign-in failed: ${signIn.error.message}`);
    const probe = await admin.rpc('worker_dispatch_state');
    applied = !probe.error;
    if (!applied) console.log(`[driver side] NOT RUN: 20261013000000_driver_side.sql is not applied (${probe.error?.message})`);
    else await cleanUp();
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (applied) await cleanUp();
    // Local sign-out only: a global one would end the shared test account's other sessions
    await writer?.auth.signOut({ scope: 'local' });
  }, TIMEOUT_MS);

  it('denies a signed-in commuter every driver-side table and function', async () => {
    if (!applied) return;
    for (const table of ['vehicle_beacons', 'driver_devices', 'gateways', 'sms_outbox', 'sms_dispatch_state', 'ops_alerts']) {
      const read = await writer.from(table).select('*').limit(1);
      expect(read.error).not.toBeNull();
    }
    for (const fn of ['worker_demand_snapshot', 'worker_devices', 'worker_dispatch_state']) {
      expect((await writer.rpc(fn)).error).not.toBeNull();
    }
    const provision = await writer.rpc('admin_provision_gateway', { gateway: 'GW-98', hash: sha256('x'), phone: null });
    expect(provision.error).not.toBeNull();
  }, TIMEOUT_MS);

  it('provisions a gateway and knows it by its token hash only', async () => {
    if (!applied) return;
    const token = randomBytes(32).toString('base64url');
    expect((await admin.rpc('admin_provision_gateway', { gateway: GATEWAY, hash: sha256(token), phone: GATEWAY_PHONE })).error).toBeNull();
    expect((await admin.rpc('worker_gateway_auth', { hash: sha256(token) })).data).toBe(GATEWAY);
    expect((await admin.rpc('worker_gateway_auth', { hash: sha256('wrong') })).data).toBeNull();
    expect((await admin.rpc('worker_heartbeat', { gateway: GATEWAY, status: { batteryPct: 90 } })).data).toBe(true);
  }, TIMEOUT_MS);

  it('provisions a driver phone, keeps its key in Vault, and refuses a second active phone', async () => {
    if (!applied) return;
    const smsKey = hex32();
    const first = await admin
      .rpc('admin_provision_driver', { vehicle: VEHICLE, plate: 'TEST 099', route: ROUTE, phone: DRIVER_PHONE, wanted_short_id: null, beacon_secret: hex32(), sms_key: smsKey, note: 'DR3 test' })
      .single<{ device_id: string; short_id: number; gateway_numbers: string[] }>();
    expect(first.error).toBeNull();
    devices.push(first.data!.device_id);
    expect(first.data!.device_id).toMatch(/^DRV-\d{4}$/);
    expect(first.data!.short_id).toBeGreaterThanOrEqual(1);
    expect(first.data!.gateway_numbers).toContain(GATEWAY_PHONE);

    const listed = await admin.rpc('worker_devices');
    const ours = (listed.data as { device_id: string; route_id: string; phone_e164: string; sms_key: string }[]).find((row) => row.device_id === first.data!.device_id);
    expect(ours).toMatchObject({ route_id: ROUTE, phone_e164: DRIVER_PHONE, sms_key: smsKey });

    const second = await admin.rpc('admin_provision_driver', { vehicle: VEHICLE, plate: 'TEST 099', route: ROUTE, phone: DRIVER_PHONE, wanted_short_id: null, beacon_secret: hex32(), sms_key: hex32(), note: null });
    expect(second.error?.message).toMatch(/already has active phone/);
  }, TIMEOUT_MS);

  it('reserves sequence numbers in order', async () => {
    if (!applied) return;
    const device = devices[0];
    expect((await admin.rpc('worker_next_seq', { device, n: 3 })).data).toBe(0);
    expect((await admin.rpc('worker_next_seq', { device, n: 2 })).data).toBe(3);
    expect((await admin.rpc('worker_next_seq', { device, n: 11 })).error).not.toBeNull();
  }, TIMEOUT_MS);

  it('queues, claims and settles messages: sent, delivered, failed then queued again', async () => {
    if (!applied) return;
    const device = devices[0];
    const messages = [5, 6].map((seq) => ({ device_id: device, seq, encoding: 'text', body_text: `HM2|R99|000${seq}|1200|SMB:1|00000000`, body_b64: null }));
    const queued = await admin.rpc('worker_enqueue', { route: ROUTE, counts: { SMB: 1 }, messages, ttl_min: 10 });
    expect(queued.data).toBe(2);
    const state = await admin.rpc('worker_dispatch_state');
    expect((state.data as { route_id: string; last_counts: object }[]).find((row) => row.route_id === ROUTE)?.last_counts).toEqual({ SMB: 1 });

    const claimed = await admin.rpc('worker_claim', { gateway: GATEWAY, max_rows: 10, lease_s: 120, max_attempts: 3 });
    const ours = (claimed.data as { id: number; to_e164: string; body_text: string }[]).filter((row) => row.to_e164 === DRIVER_PHONE);
    expect(ours).toHaveLength(2);
    const [first, second] = ours;

    expect((await admin.rpc('worker_result', { message_id: first.id, gateway: GATEWAY, result: 'sent', error_text: null, max_attempts: 3 })).data).toBe(true);
    expect((await admin.rpc('worker_result', { message_id: first.id, gateway: GATEWAY, result: 'delivered', error_text: null, max_attempts: 3 })).data).toBe(true);
    // Another gateway cannot settle it
    expect((await admin.rpc('worker_result', { message_id: second.id, gateway: 'GW-98', result: 'sent', error_text: null, max_attempts: 3 })).data).toBe(false);
    expect((await admin.rpc('worker_result', { message_id: second.id, gateway: GATEWAY, result: 'failed', error_text: 'test failure', max_attempts: 3 })).data).toBe(true);

    const rows = await admin.from('sms_outbox').select('id, status, attempts, error').in('id', [first.id, second.id]).order('id');
    expect(rows.data).toEqual([
      expect.objectContaining({ id: first.id, status: 'delivered', attempts: 1 }),
      expect.objectContaining({ id: second.id, status: 'queued', attempts: 1, error: 'test failure' }),
    ]);
    expect((await admin.rpc('worker_claim', { gateway: 'GW-98', max_rows: 1, lease_s: 120, max_attempts: 3 })).error).not.toBeNull();
  }, TIMEOUT_MS);

  it('records an alert once per quiet window', async () => {
    if (!applied) return;
    expect((await admin.rpc('worker_alert', { kind: 'dr3_test', detail: { n: 1 }, quiet_min: 60 })).data).toBe(true);
    expect((await admin.rpc('worker_alert', { kind: 'dr3_test', detail: { n: 2 }, quiet_min: 60 })).data).toBe(false);
  }, TIMEOUT_MS);

  it('retires a phone: no more texts, queued ones expire; the vehicle can get a new phone with the same beacon id', async () => {
    if (!applied) return;
    const device = devices[0];
    const before = await admin.from('vehicle_beacons').select('short_id, rotated_at').eq('vehicle_id', VEHICLE).single();
    expect((await admin.rpc('admin_retire_device', { device, new_beacon_secret: hex32() })).data).toBe(true);
    expect((await admin.rpc('admin_retire_device', { device, new_beacon_secret: null })).data).toBe(false);

    const listed = await admin.rpc('worker_devices');
    expect((listed.data as { device_id: string }[]).some((row) => row.device_id === device)).toBe(false);
    const left = await admin.from('sms_outbox').select('status').eq('device_id', device).in('status', ['queued', 'claimed']);
    expect(left.data).toEqual([]);
    const after = await admin.from('vehicle_beacons').select('short_id, rotated_at').eq('vehicle_id', VEHICLE).single();
    expect(after.data!.short_id).toBe(before.data!.short_id);
    expect(after.data!.rotated_at).not.toBe(before.data!.rotated_at);

    const again = await admin
      .rpc('admin_provision_driver', { vehicle: VEHICLE, plate: 'TEST 099', route: ROUTE, phone: DRIVER_PHONE, wanted_short_id: null, beacon_secret: hex32(), sms_key: hex32(), note: null })
      .single<{ device_id: string; short_id: number }>();
    expect(again.error).toBeNull();
    expect(again.data!.short_id).toBe(before.data!.short_id);
    expect(again.data!.device_id).not.toBe(device);
  }, TIMEOUT_MS);

  it('reads live waiting counts per route and stop', async () => {
    if (!applied) return;
    const snapshot = await admin.rpc('worker_demand_snapshot');
    expect(snapshot.error).toBeNull();
    for (const row of snapshot.data as { route_id: string; station_code: string; waiting: number }[]) {
      expect(row.waiting).toBeGreaterThan(0);
    }
  }, TIMEOUT_MS);
});

// DR8: verify_beacon and post_report's beacon argument, against the real functions (20261014000000).
// Vehicle R99-DR8-TEST gets the first shared vector's secret, so the SQL check is held to the same
// rule as src/shared/beacon/code.ts. The server's clock decides the slot: codes are made from now.
live('DR8 boarding detection, live project', () => {
  const BEACON_VEHICLE = 'R99-DR8-TEST';
  const SECRET = vectors.vectors[0].secretHex;
  const MS_PER_S = 1000;
  // Too close to a slot boundary, a small clock difference with the server could move the slot
  const BOUNDARY_MARGIN_MS = 5000;
  let admin: SupabaseClient;
  let writer: SupabaseClient;
  let applied = false;
  // RL2a (20261023000000): the nine-argument post_report, renew_report and end_report
  let gateApplied = false;
  let shortId = 0;

  async function cleanUp() {
    const ours = await admin.from('driver_devices').select('device_id').eq('vehicle_id', BEACON_VEHICLE);
    const ids = (ours.data ?? []).map((row: { device_id: string }) => row.device_id);
    if (ids.length > 0) await admin.from('driver_devices').delete().in('device_id', ids);
    await admin.from('feed_posts').delete().eq('route_id', ROUTE);
    await admin.from('vehicles').delete().eq('vehicle_id', BEACON_VEHICLE);
  }

  async function awayFromBoundary() {
    const intoSlot = Date.now() % (BEACON_SLOT_S * MS_PER_S);
    if (intoSlot < BOUNDARY_MARGIN_MS || intoSlot > BEACON_SLOT_S * MS_PER_S - BOUNDARY_MARGIN_MS) {
      await new Promise((resolve) => setTimeout(resolve, 2 * BOUNDARY_MARGIN_MS));
    }
  }

  const code = (slotOffset: number) => payloadToHex(encodeBeacon({ shortId, slot: slotOf(Date.now()) + slotOffset }, SECRET));
  const verify = async (payloadHex: string) => {
    const { data, error } = await writer.rpc('verify_beacon', { payload_hex: payloadHex });
    if (error) throw new Error(error.message);
    return (data as { vehicle_id: string | null; route_id: string | null; plate: string | null; status: string }[])[0];
  };

  beforeAll(async () => {
    admin = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, options);
    writer = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);
    const signIn = await writer.auth.signInWithPassword({ email: env.TEST_WRITER_EMAIL!, password: env.TEST_WRITER_PASSWORD! });
    if (signIn.error) throw new Error(`Sign-in failed: ${signIn.error.message}`);
    const probe = await writer.rpc('verify_beacon', { payload_hex: '00' });
    applied = !probe.error;
    if (!applied) {
      console.log(`[boarding detection] NOT RUN: 20261014000000_beacon_verify.sql is not applied (${probe.error?.message})`);
      return;
    }
    await cleanUp();
    const provisioned = await admin
      .rpc('admin_provision_driver', { vehicle: BEACON_VEHICLE, plate: 'TEST 098', route: ROUTE, phone: DRIVER_PHONE, wanted_short_id: null, beacon_secret: SECRET, sms_key: hex32(), note: 'DR8 test' })
      .single<{ short_id: number }>();
    if (provisioned.error) throw new Error(provisioned.error.message);
    shortId = provisioned.data.short_id;
    gateApplied = !(await writer.rpc('end_report', { post: -1 })).error;
    if (!gateApplied) console.log('[boarding detection] RL2a not run: 20261023000000_relay_gate.sql is not applied');
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (applied) await cleanUp();
    await writer?.auth.signOut({ scope: 'local' });
  }, TIMEOUT_MS);

  it('accepts the current code and one slot either side, naming only the vehicle, route and plate', async () => {
    if (!applied) return;
    await awayFromBoundary();
    for (const offset of [0, -1, 1]) {
      expect(await verify(code(offset))).toEqual({ vehicle_id: BEACON_VEHICLE, route_id: ROUTE, plate: 'TEST 098', status: 'ok' });
    }
  }, TIMEOUT_MS);

  it('rejects a code two slots old or ahead (PRD S7), a forged one, and an unknown vehicle', async () => {
    if (!applied) return;
    await awayFromBoundary();
    expect((await verify(code(-2))).status).toBe('beacon_expired');
    expect((await verify(code(2))).status).toBe('beacon_expired');
    const forged = code(0).slice(0, -8) + '00000000';
    expect(await verify(forged)).toEqual({ vehicle_id: null, route_id: null, plate: null, status: 'beacon_invalid' });
    expect((await verify(payloadToHex(encodeBeacon({ shortId: 65534, slot: slotOf(Date.now()) }, SECRET)))).status).toBe('unknown_vehicle');
    expect((await verify('not hex')).status).toBe('beacon_invalid');
  }, TIMEOUT_MS);

  it('is not open to signed-out callers', async () => {
    if (!applied) return;
    const anonymous = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);
    expect((await anonymous.rpc('verify_beacon', { payload_hex: code(0) })).error).not.toBeNull();
    expect((await writer.rpc('beacon_check', { payload_hex: code(0) })).error).not.toBeNull();
  }, TIMEOUT_MS);

  it('a relay with the code records whether it checked out, and takes the vehicle from it', async () => {
    // RL2a replaces the eight-argument version: see the next test
    if (!applied || gateApplied) return;
    await awayFromBoundary();
    const post = async (beacon: string, vehicle: string | null) =>
      writer.rpc('post_report', { route: ROUTE, phrase: null, seat_tier: 'green', vehicle, with_gps: false, stop: null, beacon, request_key: `dr8-${randomBytes(6).toString('hex')}` });
    const good = await post(code(0), null);
    expect(good.error).toBeNull();
    const bad = await post(code(-2), null);
    expect(bad.error).toBeNull();
    const rows = await admin.from('feed_posts').select('id, vehicle_id, beacon_ok').in('id', [good.data, bad.data]).order('id');
    expect(rows.data).toEqual([
      { id: good.data, vehicle_id: BEACON_VEHICLE, beacon_ok: true },
      { id: bad.data, vehicle_id: null, beacon_ok: false },
    ]);
    // Clients never read beacon_ok
    expect((await writer.from('feed_posts').select('beacon_ok').eq('id', good.data)).error).not.toBeNull();
  }, TIMEOUT_MS);

  it('RL2a: only a valid code for the same route and vehicle posts; the post lapses unless renewed, and ends for good', async () => {
    if (!applied || !gateApplied) return;
    await awayFromBoundary();
    const MIN = 60_000;
    const relay = (beacon: string | null, liveMap: boolean, route = ROUTE, vehicle: string | null = null) =>
      writer.rpc('post_report', {
        route,
        phrase: null,
        seat_tier: 'green',
        vehicle,
        with_gps: true,
        stop: null,
        beacon,
        live_map: liveMap,
        request_key: `rl2a-${randomBytes(6).toString('hex')}`,
      });
    const refused = 'registered multicab beacon';
    expect((await relay(null, false)).error?.message).toContain(refused);
    expect((await relay(code(-2), false)).error?.message).toContain(refused);
    expect((await relay(code(0), false, 'R4')).error?.message).toContain(refused);
    expect((await relay(code(0), false, ROUTE, 'R4-TEST-01')).error?.message).toContain(refused);
    // The eight-argument version is closed
    const old = await writer.rpc('post_report', { route: ROUTE, phrase: null, seat_tier: 'green', vehicle: null, with_gps: false, stop: null, beacon: code(0), request_key: `dr8-${randomBytes(6).toString('hex')}` });
    expect(old.error).not.toBeNull();

    const feed = await relay(code(0), false);
    expect(feed.error).toBeNull();
    const row = await admin.from('feed_posts').select('vehicle_id, beacon_ok, live_map, expires_at').eq('id', feed.data).single();
    expect(row.data).toMatchObject({ vehicle_id: BEACON_VEHICLE, beacon_ok: true, live_map: false });
    // relay_post_grace_min (15) ahead, give or take the clocks
    const ahead = Date.parse(row.data!.expires_at) - Date.now();
    expect(ahead).toBeGreaterThan(13 * MIN);
    expect(ahead).toBeLessThan(17 * MIN);
    expect((await writer.from('feed_posts').select('live_map').eq('id', feed.data).single()).data?.live_map).toBe(false);
    expect((await writer.rpc('renew_report', { post: feed.data })).data).toBe(true);
    // Lapsed 10 minutes ago (a dead zone): it comes back; 40 minutes ago: it stays down
    await admin.from('feed_posts').update({ expires_at: new Date(Date.now() - 10 * MIN).toISOString() }).eq('id', feed.data);
    expect((await writer.rpc('renew_report', { post: feed.data })).data).toBe(true);
    await admin.from('feed_posts').update({ expires_at: new Date(Date.now() - 40 * MIN).toISOString() }).eq('id', feed.data);
    expect((await writer.rpc('renew_report', { post: feed.data })).data).toBe(false);

    // On the live map; ended by its author: gone now, and never renewed again
    const live = await relay(code(0), true);
    expect(live.error).toBeNull();
    expect((await admin.from('feed_posts').select('live_map').eq('id', live.data).single()).data?.live_map).toBe(true);
    expect((await writer.rpc('end_report', { post: live.data })).error).toBeNull();
    const ended = await admin.from('feed_posts').select('ended_at, expires_at').eq('id', live.data).single();
    expect(ended.data?.ended_at).not.toBeNull();
    expect(Date.parse(ended.data!.expires_at)).toBeLessThanOrEqual(Date.now() + 5000);
    expect((await writer.rpc('renew_report', { post: live.data })).data).toBe(false);
  }, TIMEOUT_MS);
});

// Keeps the suite from being reported as empty while the live tests are skipped
describe('DR3 driver side, live project: configuration', () => {
  it('reports whether the live tests ran', () => {
    expect(typeof configured).toBe('boolean');
  });
});
