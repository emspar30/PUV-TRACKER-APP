// DRG2 acceptance tests against the LIVE Supabase project (docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md).
// Skipped, with a printed reason, until .env holds the service role key and the test accounts, and
// until 20261027000000_driver_registration.sql is applied.
//
// They send no SMS: every text they queue (number checks, the "approved" notice) expires at once
// (sms_ttl_min and notice_ttl_min 0), so the live gateway's next pull marks it expired instead of
// sending it. They work only on their own rows (the made-up numbers +63999000100x, plate TST 9901
// on the made-up route R99), restore the admin PIN setting they found, make the test account an
// admin only for the run, and remove everything at the end. (Vault keeps the test secrets by name.)
// The tests run in order and share one registration.

import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseEnv } from 'node:util';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { verifiedRetiredNotice } from '../../src/shared/sms/protocol';

const ENV_FILE = path.join(__dirname, '..', '..', '.env');
const env: Record<string, string | undefined> = fs.existsSync(ENV_FILE) ? parseEnv(fs.readFileSync(ENV_FILE, 'utf8')) : {};

const REQUIRED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'TEST_WRITER_EMAIL', 'TEST_WRITER_PASSWORD'];
const missing = REQUIRED.filter((name) => !env[name]);
const configured = missing.length === 0;
if (!configured) console.log(`[driver registration] SKIPPED: these tests need ${missing.join(', ')} in .env`);
const live = configured ? describe : describe.skip;

const BUCKET = 'driver-registrations';
const PHONE = '+639990001001';
const PHONE_REJECTED = '+639990001002';
const PHONE_TRIES = '+639990001003';
const PHONES = [PHONE, PHONE_REJECTED, PHONE_TRIES];
const PLATE = 'TST 9901';
const ROUTE = 'R99';
const VEHICLE = 'R99-TST9901';
const TIMEOUT_MS = 60000;
const HEX64 = /^[0-9a-f]{64}$/;
// The thresholds of src/shared/config (REGISTRATION_*) as the Edge Functions will pass them, except
// the SMS lifetime: 0, so nothing is sent
const LIMITS = { ttl_min: 10, sms_ttl_min: 0, resend_min: 10, per_number: 3, per_day: 20 };
const MAX_TRIES = 5;
const SETUP_TTL_DAYS = 7;
const VERIFIED_WITHIN_MIN = 60;
// A made-up admin PIN setting for the run (hash and salt only; the real one is put back afterwards)
const TEST_PIN = { pin_hash: 'a'.repeat(64), pin_salt: 'b'.repeat(32) };
// A tiny JPEG (the bucket checks the content type, not the picture)
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const newTokenHash = () => sha256(randomBytes(32).toString('base64url'));

live('DRG2 driver registration, live project', () => {
  let admin: SupabaseClient;
  let writer: SupabaseClient;
  let writerId = '';
  let applied = false;
  let writerWasAdmin = false;
  let savedPin: { admin_pin_hash: string | null; admin_pin_salt: string | null } | null = null;
  const folders: string[] = [];
  // The registration the tests take from submission to collection
  let firstHash = '';
  let hash = '';
  let registrationId = '';

  async function cleanUp() {
    await admin.from('driver_registrations').delete().in('phone_e164', PHONES);
    const devices = await admin.from('driver_devices').select('device_id').eq('vehicle_id', VEHICLE);
    const deviceIds = (devices.data ?? []).map((row: { device_id: string }) => row.device_id);
    if (deviceIds.length > 0) {
      await admin.from('sms_outbox').delete().in('device_id', deviceIds);
      await admin.from('driver_devices').delete().in('device_id', deviceIds);
    }
    await admin.from('vehicles').delete().eq('vehicle_id', VEHICLE);
    await admin.from('sms_outbox').delete().in('to_e164', PHONES);
    const checks = await admin.from('registration_checks').select('check_id').in('phone_e164', PHONES);
    for (const row of (checks.data ?? []) as { check_id: string }[]) folders.push(row.check_id);
    await admin.from('registration_checks').delete().in('phone_e164', PHONES);
    const paths = folders.flatMap((folder) => [`${folder}/id.jpg`, `${folder}/vehicle.jpg`]);
    if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths);
  }

  const start = (phone: string, code: string, resendMin = LIMITS.resend_min) =>
    admin.rpc('registration_check_start', { phone, code, encoding: 'text', body_text: `HM2|V|${code}`, body_b64: null, ...LIMITS, resend_min: resendMin });
  const verify = (phone: string, code: string) => admin.rpc('registration_check_verify', { phone, code, max_tries: MAX_TRIES });
  const submit = (check: string, tokenHash: string) =>
    admin.rpc('registration_submit', { check_ref: check, plate: PLATE, route: ROUTE, token_hash: tokenHash, verified_within_min: VERIFIED_WITHIN_MIN });
  const status = async (tokenHash: string) => (await admin.rpc('registration_status', { token_hash: tokenHash, setup_ttl_days: SETUP_TTL_DAYS })).data;
  const collect = (tokenHash: string) => admin.rpc('registration_collect', { token_hash: tokenHash, setup_ttl_days: SETUP_TTL_DAYS });

  async function uploadPhotos(folder: string) {
    folders.push(folder);
    for (const name of ['id.jpg', 'vehicle.jpg']) {
      const upload = await admin.storage.from(BUCKET).upload(`${folder}/${name}`, JPEG, { contentType: 'image/jpeg', upsert: true });
      expect(upload.error).toBeNull();
    }
  }

  // A verified check (sent again at once: resend 0) with its photos uploaded
  async function verifiedCheck(phone: string, code: string): Promise<string> {
    expect((await start(phone, code, 0)).error).toBeNull();
    const check = (await verify(phone, code)).data as string;
    await uploadPhotos(check);
    return check;
  }

  beforeAll(async () => {
    admin = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, options);
    writer = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);
    const signIn = await writer.auth.signInWithPassword({ email: env.TEST_WRITER_EMAIL!, password: env.TEST_WRITER_PASSWORD! });
    if (signIn.error) throw new Error(`Sign-in failed: ${signIn.error.message}`);
    writerId = signIn.data.user.id;
    const probe = await admin.rpc('registration_status', { token_hash: '0'.repeat(64), setup_ttl_days: SETUP_TTL_DAYS });
    applied = !probe.error;
    if (!applied) {
      console.log(`[driver registration] NOT RUN: 20261027000000_driver_registration.sql is not applied (${probe.error?.message})`);
      return;
    }
    await cleanUp();
    writerWasAdmin = ((await admin.from('admin_accounts').select('user_id').eq('user_id', writerId)).data ?? []).length > 0;
    savedPin = (await admin.from('driver_settings').select('admin_pin_hash, admin_pin_salt').eq('id', true).single()).data;
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (applied) {
      await cleanUp();
      if (!writerWasAdmin) await admin.from('admin_accounts').delete().eq('user_id', writerId);
      if (savedPin) await admin.from('driver_settings').update(savedPin).eq('id', true);
    }
    // Local sign-out only: a global one would end the shared test account's other sessions
    await writer?.auth.signOut({ scope: 'local' });
  }, TIMEOUT_MS);

  it('denies a signed-in non-admin every registration table, function, console function and photo', async () => {
    if (!applied || writerWasAdmin) return;
    for (const table of ['admin_accounts', 'driver_settings', 'registration_checks', 'driver_registrations']) {
      expect((await writer.from(table).select('*').limit(1)).error).not.toBeNull();
    }
    expect((await writer.rpc('registration_status', { token_hash: '0'.repeat(64), setup_ttl_days: SETUP_TTL_DAYS })).error).not.toBeNull();
    expect((await writer.rpc('console_registrations')).error?.message).toContain('admins only');
    expect((await writer.rpc('console_set_pin', TEST_PIN)).error?.message).toContain('admins only');
    expect((await writer.rpc('is_admin')).data).toBe(false);
    expect((await writer.storage.from(BUCKET).list()).data ?? []).toEqual([]);
  }, TIMEOUT_MS);

  it('queues a number check that the gateway would never send, and refuses another within 10 minutes', async () => {
    if (!applied) return;
    expect((await start(PHONE_TRIES, '111111')).error).toBeNull();
    const queued = await admin.from('sms_outbox').select('kind, to_e164, device_id, seq, created_at, expires_at').eq('to_e164', PHONE_TRIES);
    expect(queued.data).toHaveLength(1);
    expect(queued.data![0]).toMatchObject({ kind: 'check', to_e164: PHONE_TRIES, device_id: null, seq: null });
    expect(Date.parse(queued.data![0].expires_at)).toBeLessThanOrEqual(Date.parse(queued.data![0].created_at));
    expect((await start(PHONE_TRIES, '222222')).error?.message).toBe('too_soon');
    expect((await start('+63999', '222222')).error?.message).toBe('invalid_number');
  }, TIMEOUT_MS);

  it(`voids a code after ${MAX_TRIES} wrong tries`, async () => {
    if (!applied) return;
    for (let i = 0; i < MAX_TRIES; i += 1) expect((await verify(PHONE_TRIES, '999999')).data).toBeNull();
    expect((await verify(PHONE_TRIES, '111111')).data).toBeNull();
  }, TIMEOUT_MS);

  it('submits only a verified, unused check whose two photos are in the bucket', async () => {
    if (!applied) return;
    expect((await start(PHONE, '424242')).error).toBeNull();
    const check = (await verify(PHONE, '424242')).data as string;
    expect(check).toMatch(/^[0-9a-f-]{36}$/);
    firstHash = newTokenHash();
    expect((await submit(check, firstHash)).error?.message).toBe('photos_missing');
    await uploadPhotos(check);
    expect((await submit(check, firstHash)).error).toBeNull();
    expect((await submit(check, newTokenHash())).error?.message).toBe('check_not_verified');
    expect(await status(firstHash)).toEqual([{ status: 'pending', reason: null }]);
  }, TIMEOUT_MS);

  it('expires an older registration of the same number when a newer one is submitted', async () => {
    if (!applied) return;
    hash = newTokenHash();
    expect((await submit(await verifiedCheck(PHONE, '434343'), hash)).error).toBeNull();
    expect(await status(firstHash)).toEqual([{ status: 'expired', reason: 'replaced by a newer registration' }]);
    expect(await status(hash)).toEqual([{ status: 'pending', reason: null }]);
  }, TIMEOUT_MS);

  it('lets the admin list it, open its photos, approve it and delete the photos', async () => {
    if (!applied) return;
    if (!writerWasAdmin) expect((await admin.from('admin_accounts').insert({ user_id: writerId })).error).toBeNull();
    expect((await writer.rpc('is_admin')).data).toBe(true);

    const listed = (await writer.rpc('console_registrations')).data as { registration_id: string; status: string; phone_e164: string; vehicle_id: string; id_photo_path: string; active_device: string | null }[];
    const ours = listed.find((row) => row.phone_e164 === PHONE && row.status === 'pending')!;
    expect(ours).toMatchObject({ vehicle_id: VEHICLE, active_device: null });
    registrationId = ours.registration_id;
    expect((await writer.storage.from(BUCKET).createSignedUrl(ours.id_photo_path, 60)).error).toBeNull();

    const decided = await writer.rpc('console_decide', { registration: registrationId, approve: true, decision_reason: null, notice_ttl_min: 0 });
    expect(decided.error).toBeNull();
    const paths = (decided.data as { id_photo_path: string; vehicle_photo_path: string }[]).flatMap((row) => [row.id_photo_path, row.vehicle_photo_path]);
    expect(paths).toHaveLength(2);
    const notice = await admin.from('sms_outbox').select('kind, encoding, body_text, created_at, expires_at').eq('to_e164', PHONE).eq('kind', 'notice');
    expect(notice.data).toHaveLength(1);
    expect(notice.data![0].body_text).toBe("You're approved. Open Tunton Driver while connected to the internet.");
    expect(Date.parse(notice.data![0].expires_at)).toBeLessThanOrEqual(Date.parse(notice.data![0].created_at));

    expect((await writer.storage.from(BUCKET).remove(paths)).error).toBeNull();
    expect((await writer.rpc('console_photos_deleted', { registration: registrationId })).data).toBe(true);
    const row = await admin.from('driver_registrations').select('id_photo_path, photos_deleted_at, decided_by').eq('registration_id', registrationId).single();
    expect(row.data).toMatchObject({ id_photo_path: null, decided_by: writerId });
    expect(row.data!.photos_deleted_at).not.toBeNull();
    expect((await writer.rpc('console_decide', { registration: registrationId, approve: false, decision_reason: 'again', notice_ttl_min: 0 })).error?.message).toBe('not_pending');
    expect(await status(hash)).toEqual([{ status: 'approved', reason: null }]);
  }, TIMEOUT_MS);

  it('collects the setup once, after the admin PIN is set', async () => {
    if (!applied) return;
    if (!savedPin?.admin_pin_hash) expect((await collect(hash)).error?.message).toBe('pin_not_set');
    expect((await writer.rpc('console_set_pin', TEST_PIN)).error).toBeNull();
    expect((await writer.rpc('console_pin_is_set')).data).toBe(true);

    const first = await collect(hash);
    expect(first.error).toBeNull();
    const setup = (first.data as Record<string, unknown>[])[0];
    expect(setup).toMatchObject({ vehicle_id: VEHICLE, route_id: ROUTE, plate: PLATE, admin_pin_hash: TEST_PIN.pin_hash, admin_pin_salt: TEST_PIN.pin_salt });
    expect(setup.device_id).toMatch(/^DRV-\d{4}$/);
    expect(setup.beacon_secret).toMatch(HEX64);
    expect(setup.sms_key).toMatch(HEX64);
    expect(setup.beacon_secret).not.toBe(setup.sms_key);
    expect(Array.isArray(setup.gateway_numbers)).toBe(true);

    expect((await collect(hash)).error?.message).toBe('not_approved');
    expect(await status(hash)).toEqual([{ status: 'collected', reason: null }]);

    const drivers = (await writer.rpc('console_drivers')).data as { device_id: string; plate: string }[];
    expect(drivers.find((row) => row.device_id === setup.device_id)).toMatchObject({ plate: PLATE });
    // The retire notice (20261028000000_retire_notice.sql), expiring at once: nothing is sent
    expect((await writer.rpc('console_retire', { device: setup.device_id, notice_ttl_min: 0 })).data).toBe(true);
    const notice = await admin.from('sms_outbox').select('body_text').eq('to_e164', PHONE).like('body_text', 'HM2|RETIRED|%');
    expect(notice.data).toHaveLength(1);
    expect(verifiedRetiredNotice(notice.data![0].body_text, setup.sms_key as string)).toBe(setup.device_id);
    // The first console_retire (no notice) can no longer be called
    expect((await writer.rpc('console_retire', { device: setup.device_id })).error).not.toBeNull();
  }, TIMEOUT_MS);

  it('rejects only with a reason, which the driver then sees', async () => {
    if (!applied) return;
    const rejectedHash = newTokenHash();
    expect((await submit(await verifiedCheck(PHONE_REJECTED, '454545'), rejectedHash)).error).toBeNull();
    const listed = (await writer.rpc('console_registrations')).data as { registration_id: string; phone_e164: string; status: string }[];
    const id = listed.find((row) => row.phone_e164 === PHONE_REJECTED && row.status === 'pending')!.registration_id;
    const decide = (reason: string | null) => writer.rpc('console_decide', { registration: id, approve: false, decision_reason: reason, notice_ttl_min: 0 });
    expect((await decide('  ')).error?.message).toBe('reason_needed');
    expect((await decide('The ID photo is blurry')).error).toBeNull();
    expect(await status(rejectedHash)).toEqual([{ status: 'rejected', reason: 'The ID photo is blurry' }]);
    expect((await admin.from('sms_outbox').select('id').eq('to_e164', PHONE_REJECTED).eq('kind', 'notice')).data).toEqual([]);
  }, TIMEOUT_MS);
});
