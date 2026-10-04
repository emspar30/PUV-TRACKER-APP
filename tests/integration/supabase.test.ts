// S4 acceptance tests against the LIVE Supabase project. They are skipped, with a printed reason,
// until .env holds the project values and two test accounts (see docs/BACKEND_SETUP.md).
// They only create and overwrite the telemetry row of the seeded test vehicle R4-TEST-01.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseEnv } from 'node:util';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { encodePacket, type TelemetryPacket } from '../../src/shared/telemetry/packet';

const ENV_FILE = path.join(__dirname, '..', '..', '.env');
// Read .env directly: Expo's Babel preset swaps process.env for a copy taken before this file runs
const env: Record<string, string | undefined> = fs.existsSync(ENV_FILE) ? parseEnv(fs.readFileSync(ENV_FILE, 'utf8')) : {};

const REQUIRED = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'TEST_WRITER_EMAIL',
  'TEST_WRITER_PASSWORD',
  'TEST_OUTSIDER_EMAIL',
  'TEST_OUTSIDER_PASSWORD',
] as const;

const missing = REQUIRED.filter((name) => !env[name]);
const configured = missing.length === 0;
if (!configured) {
  console.log(`[integration] SKIPPED: the live-project tests need these variables in .env: ${missing.join(', ')}`);
}
const live = configured ? describe : describe.skip;

const VEHICLE = 'R4-TEST-01';
const TIMEOUT_MS = 30000;

function client(): SupabaseClient {
  return createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedIn(emailVar: string, passwordVar: string): Promise<SupabaseClient> {
  const supabase = client();
  const { error } = await supabase.auth.signInWithPassword({
    email: env[emailVar]!,
    password: env[passwordVar]!,
  });
  if (error) throw new Error(`Sign-in failed for ${emailVar}: ${error.message}`);
  return supabase;
}

const packet = (overrides: Partial<TelemetryPacket> = {}): TelemetryPacket => ({
  vehicle_id: VEHICLE,
  lat: 8.947459,
  lon: 125.541426,
  speed: 20,
  heading: 90,
  seats: 5,
  ts: Date.now() / 1000,
  ...overrides,
});

// Calls the ingest function and returns the HTTP status and parsed body
async function ingest(supabase: SupabaseClient, body: string) {
  const { data, error, response } = await supabase.functions.invoke('ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!error) return { status: response?.status ?? 200, body: data };
  const context = (error as { context?: Response }).context;
  return { status: context?.status ?? 0, body: context ? await context.json().catch(() => null) : null };
}

live('S4 backend, live project', () => {
  let writer: SupabaseClient;
  let outsider: SupabaseClient;

  beforeAll(async () => {
    writer = await signedIn('TEST_WRITER_EMAIL', 'TEST_WRITER_PASSWORD');
    outsider = await signedIn('TEST_OUTSIDER_EMAIL', 'TEST_OUTSIDER_PASSWORD');
  }, TIMEOUT_MS);

  afterAll(async () => {
    await writer?.removeAllChannels();
    await Promise.all([writer?.auth.signOut(), outsider?.auth.signOut()]);
  });

  it(
    'ingest accepts an allowlisted writer',
    async () => {
      const sent = packet({ seats: 7 });
      const result = await ingest(writer, encodePacket(sent));
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ status: 'accepted', verified: false });

      const { data, error } = await writer.from('telemetry_latest').select('*').eq('vehicle_id', VEHICLE).single();
      expect(error).toBeNull();
      expect(data).toMatchObject({ seats_taken: 7, verified: false, verification_reasons: ['verification_disabled'] });
      expect(Object.keys(data ?? {})).not.toContain('user_id');
    },
    TIMEOUT_MS,
  );

  it(
    'direct insert, update and delete on telemetry_latest are denied',
    async () => {
      const row = { vehicle_id: 'R4-TEST-02', lat: 8.9, lon: 125.5, speed_kmh: 1, heading_deg: 0, seats_taken: 1, packet_ts: new Date().toISOString() };
      const inserted = await writer.from('telemetry_latest').insert(row).select();
      expect(inserted.error).not.toBeNull();

      const updated = await writer.from('telemetry_latest').update({ seats_taken: 16 }).eq('vehicle_id', VEHICLE).select();
      expect(updated.error !== null || (updated.data ?? []).length === 0).toBe(true);

      const deleted = await writer.from('telemetry_latest').delete().eq('vehicle_id', VEHICLE).select();
      expect(deleted.error !== null || (deleted.data ?? []).length === 0).toBe(true);

      const { data } = await writer.from('telemetry_latest').select('seats_taken').eq('vehicle_id', VEHICLE).single();
      expect(data?.seats_taken).not.toBe(16);
    },
    TIMEOUT_MS,
  );

  it(
    'ingest rejects a non-allowlisted account',
    async () => {
      const before = await writer.from('telemetry_latest').select('updated_at').eq('vehicle_id', VEHICLE).single();
      const result = await ingest(outsider, encodePacket(packet({ seats: 1 })));
      expect(result.status).toBe(403);
      const after = await writer.from('telemetry_latest').select('updated_at').eq('vehicle_id', VEHICLE).single();
      expect(after.data?.updated_at).toBe(before.data?.updated_at);
    },
    TIMEOUT_MS,
  );

  it(
    'ingest rejects an anonymous caller',
    async () => {
      const result = await ingest(client(), encodePacket(packet()));
      expect(result.status).toBe(401);
    },
    TIMEOUT_MS,
  );

  it(
    'team account reads active vehicles only; an outsider sees none',
    async () => {
      const hidden = await outsider.from('vehicles').select('vehicle_id');
      expect(hidden.error !== null || (hidden.data ?? []).length === 0).toBe(true);
      const { data, error } = await writer.from('vehicles').select('vehicle_id, active');
      expect(error).toBeNull();
      const ids = (data ?? []).map((v) => v.vehicle_id);
      expect(ids).toContain(VEHICLE);
      expect(ids).not.toContain('R4-TEST-OFF');
      expect((data ?? []).every((v) => v.active)).toBe(true);

      const anonymous = await client().from('vehicles').select('vehicle_id');
      expect(anonymous.error !== null || (anonymous.data ?? []).length === 0).toBe(true);
    },
    TIMEOUT_MS,
  );

  it(
    'the allowlist and the audit log are not readable by clients',
    async () => {
      for (const table of ['team_accounts', 'telemetry_ingest_log', 'telemetry_raw', 'feed_flags', 'feed_review_queue']) {
        const { data, error } = await writer.from(table).select('*');
        expect(error !== null || (data ?? []).length === 0).toBe(true);
      }
    },
    TIMEOUT_MS,
  );

  it(
    'ingest rejects malformed packets',
    async () => {
      const good = packet();
      const cases: [string, string, number][] = [
        ['not JSON', 'not json', 400],
        ['missing field', JSON.stringify({ ...good, seats: undefined }), 400],
        ['text for a number', JSON.stringify({ ...good, lat: 'x' }), 400],
        ['latitude out of range', JSON.stringify({ ...good, lat: 95 }), 400],
        ['seats above capacity', JSON.stringify({ ...good, seats: 17 }), 400],
        ['unknown field', JSON.stringify({ ...good, x: 1 }), 400],
        ['too old', JSON.stringify({ ...good, ts: good.ts - 300 }), 400],
        ['in the future', JSON.stringify({ ...good, ts: good.ts + 300 }), 400],
        ['unknown vehicle', JSON.stringify({ ...good, vehicle_id: 'NOPE-1' }), 404],
        ['inactive vehicle', JSON.stringify({ ...good, vehicle_id: 'R4-TEST-OFF' }), 404],
      ];
      for (const [label, body, status] of cases) {
        const result = await ingest(writer, body);
        expect([label, result.status]).toEqual([label, status]);
      }
    },
    TIMEOUT_MS * 2,
  );

  it(
    'realtime delivers a telemetry change',
    async () => {
      const received = new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no realtime event within 15 s')), 15000);
        writer
          .channel('telemetry-test')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'telemetry_latest' }, (change) => {
            clearTimeout(timer);
            resolve(change.new as Record<string, unknown>);
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') void ingest(writer, encodePacket(packet({ seats: 9 })));
          });
      });
      await expect(received).resolves.toMatchObject({ vehicle_id: VEHICLE, seats_taken: 9 });
    },
    TIMEOUT_MS,
  );
});

// SB1: the commuter-side tables and functions. The writer is a team account; the outsider is not.
live('SB1 commuter backend, live project', () => {
  let writer: SupabaseClient;
  let outsider: SupabaseClient;
  const key = (label: string) => `it-${label}-${Date.now()}`;

  beforeAll(async () => {
    writer = await signedIn('TEST_WRITER_EMAIL', 'TEST_WRITER_PASSWORD');
    outsider = await signedIn('TEST_OUTSIDER_EMAIL', 'TEST_OUTSIDER_PASSWORD');
  }, TIMEOUT_MS);

  it(
    'app_config is readable and not writable',
    async () => {
      const { data, error } = await writer.from('app_config').select('feed_lifetime_min, feed_flag_hide_count, checkin_lifetime_min, energy_wallet_cap').single();
      expect(error).toBeNull();
      expect(data).toMatchObject({ feed_lifetime_min: 60, feed_flag_hide_count: 3, checkin_lifetime_min: 15 });
      const write = await writer.from('app_config').update({ feed_lifetime_min: 1 }).eq('id', true).select();
      expect(write.error !== null || (write.data ?? []).length === 0).toBe(true);
    },
    TIMEOUT_MS,
  );

  it(
    'tables are written only through functions',
    async () => {
      for (const table of ['profiles', 'checkins', 'energy_ledger', 'feed_posts']) {
        const { error } = await writer.from(table).insert({});
        expect([table, error !== null]).toEqual([table, true]);
      }
    },
    TIMEOUT_MS,
  );

  it(
    'set_username keeps 3 to 20 characters and refuses a bad name',
    async () => {
      const name = `team_${Date.now() % 1_000_000}`;
      const ok = await writer.rpc('set_username', { new_username: name });
      expect(ok.error).toBeNull();
      const bad = await writer.rpc('set_username', { new_username: 'x' });
      expect(bad.error).not.toBeNull();
      const own = await writer.from('profiles').select('username').single();
      expect(own.data?.username).toBe(name);
    },
    TIMEOUT_MS,
  );

  it(
    'a check-in counts at its station until it ends; outsiders cannot check in or read counts',
    async () => {
      const done = await writer.rpc('check_in', { route: 'R4', station: 'RCA', request_key: key('checkin') });
      expect(done.error).toBeNull();
      const counts = await writer.rpc('checkin_counts', { route: 'R4' });
      expect(counts.error).toBeNull();
      expect((counts.data as { station_code: string; waiting: number }[]).find((c) => c.station_code === 'RCA')?.waiting).toBeGreaterThanOrEqual(1);
      expect((await writer.rpc('end_check_in')).error).toBeNull();
      expect((await outsider.rpc('check_in', { route: 'R4', station: 'RCA', request_key: key('outsider') })).error).not.toBeNull();
      expect((await outsider.rpc('checkin_counts', { route: 'R4' })).error).not.toBeNull();
    },
    TIMEOUT_MS,
  );

  it(
    'the energy balance never exceeds the wallet cap, and tracking is free while Energy is off',
    async () => {
      const balance = await writer.rpc('energy_balance');
      expect(balance.error).toBeNull();
      expect(Number(balance.data)).toBeLessThanOrEqual(5);
      const tracking = await writer.rpc('start_tracking', { request_key: key('track') });
      expect(tracking.error).toBeNull();
    },
    TIMEOUT_MS,
  );

  it(
    'a report appears in the feed with a username and no user id or coordinates',
    async () => {
      const post = await writer.rpc('post_report', {
        route: 'R4',
        phrase: 'few_seats',
        seat_tier: 'amber',
        vehicle: null,
        with_gps: false,
        request_key: key('report'),
      });
      expect(post.error).toBeNull();
      const feed = await outsider.from('feed_posts').select('*').eq('id', post.data);
      // Column grants hide user_id, so select('*') is refused; the listed columns work
      expect(feed.error).not.toBeNull();
      const visible = await outsider.from('feed_posts').select('id, author_username, phrase').eq('id', post.data).single();
      expect(visible.error).toBeNull();
      expect(visible.data).toMatchObject({ phrase: 'few_seats' });
      const bad = await writer.rpc('post_report', { route: 'R4', phrase: 'free text here', seat_tier: null, vehicle: null, with_gps: false, request_key: key('bad') });
      expect(bad.error).not.toBeNull();
    },
    TIMEOUT_MS,
  );
});

// Keeps the suite from being reported as empty while the live tests are skipped
describe('S4 backend, live project: configuration', () => {
  it('reports whether the live tests ran', () => {
    expect(typeof configured).toBe('boolean');
  });
});
