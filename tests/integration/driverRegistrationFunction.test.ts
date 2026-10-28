// DRG3 acceptance test of the deployed driver-registration Edge Function, over HTTP as the driver app
// calls it, against the LIVE project. Skipped, with a printed reason, until .env holds the service role
// key and the test accounts, and until the function is deployed.
//
// It sends no SMS: "start" texts nothing since the number check was dropped (owner, 2026-10-28), its
// number is made up, and the "approved" notice expires at once. It makes the test account an admin only
// for the run, restores the admin PIN setting it found, retires the phone it sets up, and removes its
// rows and photos at the end.

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseEnv } from 'node:util';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { encodeProvisioning, parseProvisioning, type DriverProvisioning } from '../../src/shared/driver/provisioning';

const ENV_FILE = path.join(__dirname, '..', '..', '.env');
const env: Record<string, string | undefined> = fs.existsSync(ENV_FILE) ? parseEnv(fs.readFileSync(ENV_FILE, 'utf8')) : {};

const REQUIRED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'TEST_WRITER_EMAIL', 'TEST_WRITER_PASSWORD'];
const missing = REQUIRED.filter((name) => !env[name]);
const configured = missing.length === 0;
if (!configured) console.log(`[driver-registration function] SKIPPED: these tests need ${missing.join(', ')} in .env`);
const live = configured ? describe : describe.skip;

const BUCKET = 'driver-registrations';
const PHONE = '+639990001009';
const PLATE = 'TST 9909';
const VEHICLE = 'R99-TST9909';
const TEST_PIN = { pin_hash: 'c'.repeat(64), pin_salt: 'd'.repeat(32) };
const TIMEOUT_MS = 90000;
// A tiny JPEG (the bucket checks the content type, not the picture)
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const options = { auth: { persistSession: false, autoRefreshToken: false } };

live('DRG3 driver-registration function, live project', () => {
  let admin: SupabaseClient;
  let writer: SupabaseClient;
  let writerId = '';
  let deployed = false;
  let writerWasAdmin = false;
  let savedPin: { admin_pin_hash: string | null; admin_pin_salt: string | null } | null = null;
  // The install token the function returns at submission
  let token = '';
  let check = '';
  let uploads: { id: string; vehicle: string } = { id: '', vehicle: '' };

  async function call(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/driver-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { raw: text };
    }
    return { status: response.status, body: parsed };
  }

  async function cleanUp() {
    await admin.from('driver_registrations').delete().eq('phone_e164', PHONE);
    const devices = await admin.from('driver_devices').select('device_id').eq('vehicle_id', VEHICLE);
    const ids = (devices.data ?? []).map((row: { device_id: string }) => row.device_id);
    if (ids.length > 0) {
      await admin.from('sms_outbox').delete().in('device_id', ids);
      await admin.from('driver_devices').delete().in('device_id', ids);
    }
    await admin.from('vehicles').delete().eq('vehicle_id', VEHICLE);
    await admin.from('sms_outbox').delete().eq('to_e164', PHONE);
    const checks = await admin.from('registration_checks').select('check_id').eq('phone_e164', PHONE);
    const folders = ((checks.data ?? []) as { check_id: string }[]).map((row) => row.check_id);
    if (check) folders.push(check);
    if (folders.length > 0) await admin.storage.from(BUCKET).remove(folders.flatMap((folder) => [`${folder}/id.jpg`, `${folder}/vehicle.jpg`]));
    await admin.from('registration_checks').delete().eq('phone_e164', PHONE);
  }

  beforeAll(async () => {
    admin = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, options);
    writer = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);
    const signIn = await writer.auth.signInWithPassword({ email: env.TEST_WRITER_EMAIL!, password: env.TEST_WRITER_PASSWORD! });
    if (signIn.error) throw new Error(`Sign-in failed: ${signIn.error.message}`);
    writerId = signIn.data.user.id;
    const probe = await call({ action: 'nothing' });
    deployed = probe.body.error === 'unknown_action';
    if (!deployed) {
      console.log(`[driver-registration function] NOT RUN: the function is not deployed (HTTP ${probe.status})`);
      return;
    }
    await cleanUp();
    writerWasAdmin = ((await admin.from('admin_accounts').select('user_id').eq('user_id', writerId)).data ?? []).length > 0;
    savedPin = (await admin.from('driver_settings').select('admin_pin_hash, admin_pin_salt').eq('id', true).single()).data;
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (deployed) {
      await cleanUp();
      if (!writerWasAdmin) await admin.from('admin_accounts').delete().eq('user_id', writerId);
      if (savedPin) await admin.from('driver_settings').update(savedPin).eq('id', true);
    }
    await writer?.auth.signOut({ scope: 'local' });
  }, TIMEOUT_MS);

  it('takes the number as typed, texts nothing, and gives two upload links that take a JPEG', async () => {
    if (!deployed) return;
    const started = await call({ action: 'start', phone: '0999 000 1009' });
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({ ok: true, phone: PHONE, submitWithinS: 3600 });
    const queued = await admin.from('sms_outbox').select('created_at, expires_at').eq('to_e164', PHONE);
    for (const row of queued.data ?? []) expect(Date.parse(row.expires_at)).toBeLessThanOrEqual(Date.parse(row.created_at));
    expect((await call({ action: 'verify', phone: PHONE, code: '000000' })).body.error).toBe('unknown_action');
    check = started.body.check as string;
    uploads = started.body.uploads as typeof uploads;
    expect(uploads.id).toContain(`/${check}/id.jpg`);
    for (const url of [uploads.id, uploads.vehicle]) {
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: JPEG });
      expect(put.status).toBe(200);
    }
  }, TIMEOUT_MS);

  it('submits, reports pending, and refuses a second submission of the same check', async () => {
    if (!deployed) return;
    const submitted = await call({ action: 'submit', check, plate: 'tst-9909', route: 'R99' });
    expect(submitted.status).toBe(200);
    expect(submitted.body).toMatchObject({ ok: true, plate: PLATE, route: 'R99' });
    token = submitted.body.token as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await call({ action: 'submit', check, plate: PLATE, route: 'R99' })).body.error).toBe('check_not_verified');
    expect((await call({ action: 'status', token: randomBytes(32).toString('base64url') })).status).toBe(404);
    expect(await call({ action: 'status', token })).toEqual({ status: 200, body: { ok: true, status: 'pending', reason: null } });
    expect((await call({ action: 'collect', token })).body.error).toBe('not_approved');
  }, TIMEOUT_MS);

  it('after approval, collects a setup the app\'s own parser accepts, once', async () => {
    if (!deployed) return;
    if (!writerWasAdmin) expect((await admin.from('admin_accounts').insert({ user_id: writerId })).error).toBeNull();
    const listed = (await writer.rpc('console_registrations')).data as { registration_id: string; phone_e164: string; status: string }[];
    const id = listed.find((row) => row.phone_e164 === PHONE && row.status === 'pending')!.registration_id;
    expect((await writer.rpc('console_decide', { registration: id, approve: true, decision_reason: null, notice_ttl_min: 0 })).error).toBeNull();
    expect((await call({ action: 'status', token })).body.status).toBe('approved');
    expect((await writer.rpc('console_set_pin', TEST_PIN)).error).toBeNull();

    const collected = await call({ action: 'collect', token });
    expect(collected.status).toBe(200);
    const setup = collected.body.setup as DriverProvisioning;
    expect(setup).toMatchObject({ kind: 'driver', vehicleId: VEHICLE, routeCode: 'R99', plate: PLATE, adminPinHash: TEST_PIN.pin_hash });
    expect(parseProvisioning(encodeProvisioning(setup), 'driver', Date.now())).toEqual({ ok: true, payload: setup });

    expect((await call({ action: 'collect', token })).body.error).toBe('not_approved');
    expect((await call({ action: 'status', token })).body.status).toBe('collected');
    expect((await writer.rpc('console_retire', { device: setup.deviceId })).data).toBe(true);
  }, TIMEOUT_MS);
});
