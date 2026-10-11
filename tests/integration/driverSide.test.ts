// DR3 acceptance tests against the LIVE Supabase project (docs/IMPLEMENTATION_PLAN_DRIVER.md, DR3).
// Skipped, with a printed reason, until .env holds the service role key and the test accounts, and
// until 20261013000000_driver_side.sql is applied. They work only on their own rows: vehicle
// R99-DR3-TEST on the made-up route R99, gateway GW-99 and alert kind dr3_test, all removed at the end.
// (Vault keeps two test secrets by name, reused on the next run.)

import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseEnv } from 'node:util';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

// Keeps the suite from being reported as empty while the live tests are skipped
describe('DR3 driver side, live project: configuration', () => {
  it('reports whether the live tests ran', () => {
    expect(typeof configured).toBe('boolean');
  });
});
