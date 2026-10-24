// Static checks on the migration text. They catch a forgotten security statement, but they do NOT
// prove what the database enforces: that needs the live project (tests/integration, S4 part 2).

import * as fs from 'node:fs';
import * as path from 'node:path';

import { BEACON_PAYLOAD_VERSION, BEACON_SLOT_S, BEACON_SLOT_TOLERANCE, BEACON_VERIFY_PER_MIN, SMS_SEQ_MODULUS } from '../config';

const ROOT = path.join(__dirname, '..', '..', '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

const FILES = fs
  .readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort();
// DR3's migration and its later fixes
const DRIVER_SIDE = '20261013000000_driver_side.sql';
const DRIVER_SIDE_FILES = FILES.filter((name) => name.startsWith('20261013'));

const read = (names: string[]) =>
  names
    .map((name) => fs.readFileSync(path.join(MIGRATIONS, name), 'utf8'))
    .join('\n')
    // Drop comments, so a word in a comment cannot satisfy or fail a check
    .replace(/--.*$/gm, '')
    .toLowerCase();

const sql = read(FILES);
// The commuter side, where no table may hold a rider's personal details
const riderSql = read(FILES.filter((name) => !DRIVER_SIDE_FILES.includes(name)));
// DR3: the driver side (driver SIM numbers, the SMS queue), server-only
const driverSql = read([DRIVER_SIDE]);
const DRIVER_SIDE_TABLES = [
  'public.vehicle_beacons',
  'public.driver_devices',
  'public.gateways',
  'public.sms_outbox',
  'public.sms_dispatch_state',
  'public.ops_alerts',
];

// Function bodies ($$ ... $$) are checked on their own; outside them, statements split on ';'
const bodies = [...sql.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((match) => match[1]);
const outside = sql.replace(/\$\$[\s\S]*?\$\$/g, '$$body$$');
const statements = outside.split(';').map((s) => s.replace(/\s+/g, ' ').trim());
const functions = statements.filter((s) => s.startsWith('create function'));
const tables = [...sql.matchAll(/create table (public\.\w+)/g)].map((match) => match[1]);
const CLIENT_ROLES = /\b(anon|authenticated|public)\b/;

const grantsOn = (table: string) => statements.filter((s) => s.startsWith('grant ') && s.includes(` on ${table} `));
const clientGrantsOn = (table: string) =>
  grantsOn(table).filter((s) => CLIENT_ROLES.test(s.slice(s.indexOf(' to ') + 4)));
const policiesOn = (table: string) => statements.filter((s) => s.startsWith('create policy') && s.includes(` on ${table} `));

describe('migration: tables', () => {
  it('creates the commuter-side tables (SB1), with the allowlist renamed to team_accounts', () => {
    expect(tables).toEqual(
      expect.arrayContaining([
        'public.app_config',
        'public.team_accounts',
        'public.profiles',
        'public.vehicles',
        'public.telemetry_latest',
        'public.telemetry_raw',
        'public.telemetry_ingest_log',
        'public.checkins',
        'public.energy_ledger',
        'public.feed_posts',
        'public.feed_flags',
        'public.feed_review_queue',
      ]),
    );
    expect(sql).not.toContain('telemetry_writers');
  });

  it('app_config holds the agreed rules', () => {
    for (const rule of [
      /night_start\s+time not null default '21:00'/,
      /night_end\s+time not null default '04:59'/,
      /night_tz\s+text not null default 'asia\/manila'/,
      /energy_wallet_cap\s+numeric\(4, 1\) not null default 5/,
      /energy_gps_report\s+numeric\(4, 1\) not null default 1\.0/,
      /energy_no_gps_report\s+numeric\(4, 1\) not null default 0\.5/,
      /energy_checkin\s+numeric\(4, 1\) not null default 0\.3/,
      /energy_passive_interval_h\s+smallint not null default 12/,
      /energy_passive_daily_max\s+smallint not null default 2/,
      /tracking_session_min\s+smallint not null default 30/,
      /feed_lifetime_min\s+smallint not null default 60/,
      /feed_flag_hide_count\s+smallint not null default 3/,
      /checkin_lifetime_min\s+smallint not null default 15/,
      /trust_badge_points smallint not null default 5/,
      /trust_daily_max smallint not null default 3/,
    ]) {
      expect(sql).toMatch(rule);
    }
  });

  it('profiles hold the user id and a 3 to 20 character unique username only', () => {
    const body = sql.slice(sql.indexOf('create table public.profiles'));
    const columns = body.slice(0, body.indexOf(');'));
    expect(columns).toMatch(/username\s+text unique check \(username ~ '\^\[a-za-z0-9_\]\{3,20\}\$'\)/);
    for (const word of ['gender', 'avatar', 'fare', 'destination', 'email']) expect(columns).not.toContain(word);
  });

  it('feed posts carry no coordinates and no free text, and clients never see user_id', () => {
    const body = sql.slice(sql.indexOf('create table public.feed_posts'));
    const columns = body.slice(0, body.indexOf(');'));
    expect(columns).not.toMatch(/\blat\b|\blon\b|\btext\s+text\b|message|comment/);
    expect(columns).toMatch(/phrase\s+text not null check \(phrase in \('full', 'few_seats', 'not_moving', 'heavy_traffic', 'loading'\)\)/);
    // B6 added stop_code and author_trusted in grants of their own, RL2a live_map
    const grants = clientGrantsOn('public.feed_posts');
    expect(grants).toHaveLength(4);
    for (const grant of grants) {
      expect(grant).toMatch(/^grant select \(/);
      expect(grant).not.toContain('user_id');
    }
  });

  it('B6: posts name a stop code (never coordinates) and say whether the author was Trusted', () => {
    expect(sql).toMatch(/alter table public.feed_posts\s+add column stop_code text check \(stop_code ~ '\^\[a-z0-9\]\{2,8\}\$'\)/);
    expect(statements).toContain('grant select (stop_code) on public.feed_posts to authenticated');
    expect(statements).toContain('grant select (author_trusted) on public.feed_posts to authenticated');
    expect(statements).toContain('grant execute on function public.post_report(text, text, text, text, boolean, text) to authenticated');
    expect(statements).toContain('grant execute on function public.post_report(text, text, text, text, boolean, text, text) to authenticated');
  });

  it('B6: trust points live on the profile and only server triggers change them', () => {
    expect(sql).toMatch(/add column trust_points integer not null default 0 check \(trust_points >= 0\)/);
    for (const fn of ['trust_award(uuid)', 'trust_on_checkin()', 'trust_on_post()', 'trust_on_flag()']) {
      expect(statements).toContain(`revoke execute on function public.${fn} from public, anon, authenticated`);
      expect(statements.some((s) => s.startsWith(`grant execute on function public.${fn}`))).toBe(false);
    }
    expect(statements.filter((s) => s.startsWith('create trigger')).map((s) => s.split(' ')[2])).toEqual(['checkins_trust', 'feed_posts_trust', 'feed_flags_trust']);
  });

  it('B4: the phrase is optional later, and still only a preset when given', () => {
    expect(statements).toContain('alter table public.feed_posts alter column phrase drop not null');
    expect(sql).not.toMatch(/drop constraint[^;]*phrase/);
  });

  it('gives telemetry_latest the verification columns with safe defaults', () => {
    expect(sql).toMatch(/verified\s+boolean not null default false/);
    expect(sql).toMatch(/verification_reasons\s+jsonb not null default '\[\]'::jsonb/);
  });

  it('stores no rider category, avatar, name, email or phone in any table', () => {
    for (const word of ['classification', 'avatar', 'full_name', 'email', 'discount']) {
      expect(sql).not.toContain(word);
    }
    // The driver side (20261013000000_driver_side) keeps the numbers of driver phones and SMS
    // gateways, never a rider's: only those two tables have a phone column
    const withPhone = [...sql.matchAll(/create table (public\.\w+) \(([\s\S]*?)\);/g)]
      .filter((match) => match[2].includes('phone'))
      .map((match) => match[1]);
    expect(withPhone).toEqual(['public.driver_devices', 'public.gateways']);
    // Phone numbers exist only on the driver side (driver and gateway SIMs), never for riders
    expect(riderSql).not.toContain('phone');
  });

  it('keeps the user id out of telemetry_latest, so rider identity cannot reach the map', () => {
    const body = sql.slice(sql.indexOf('create table public.telemetry_latest'));
    expect(body.slice(0, body.indexOf(');'))).not.toContain('user_id');
  });
});

describe('migration: row level security and grants', () => {
  it.each(tables)('%s enables row level security', (table) => {
    expect(statements).toContain(`alter table ${table} enable row level security`);
  });

  it.each(tables)('%s revokes default access from client roles and grants the service role', (table) => {
    expect(statements).toContain(`revoke all on ${table} from anon, authenticated`);
    expect(statements).toContain(`grant all on ${table} to service_role`);
  });

  it('never grants anything to anon or to public', () => {
    const toAnon = statements.filter((s) => s.startsWith('grant ') && /\bto\b.*\b(anon|public)\b/.test(s));
    expect(toAnon).toEqual([]);
  });

  it('telemetry_latest is read-only for clients: one SELECT grant, one SELECT policy, no write', () => {
    expect(clientGrantsOn('public.telemetry_latest')).toEqual(['grant select on public.telemetry_latest to authenticated']);
    const policies = policiesOn('public.telemetry_latest');
    expect(policies).toHaveLength(1);
    expect(policies[0]).toContain('for select to authenticated');
    expect(policies[0]).toContain('v.active');
    expect(policies[0]).toContain('public.is_team_account()');
  });

  it('vehicles is read-only for clients and limited to active vehicles', () => {
    expect(clientGrantsOn('public.vehicles')).toEqual(['grant select on public.vehicles to authenticated']);
    const policies = policiesOn('public.vehicles');
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatch(/for select to authenticated using \(active and \(select public\.is_team_account\(\)\)\)/);
  });

  it('server-only tables are invisible to clients: no grant and no policy', () => {
    for (const table of [
      'public.team_accounts',
      'public.telemetry_ingest_log',
      'public.telemetry_raw',
      'public.feed_flags',
      'public.feed_review_queue',
      ...DRIVER_SIDE_TABLES,
    ]) {
      expect(clientGrantsOn(table)).toEqual([]);
      expect(policiesOn(table)).toEqual([]);
    }
  });

  it('clients only read tables: every client grant is SELECT; writes go through functions', () => {
    for (const table of tables) {
      for (const grant of clientGrantsOn(table)) expect(grant).toMatch(/^grant select\b/);
    }
  });

  it('own-row tables let a user read only their own rows', () => {
    for (const table of ['public.profiles', 'public.checkins', 'public.energy_ledger']) {
      const policies = policiesOn(table);
      expect(policies).toHaveLength(1);
      expect(policies[0]).toContain('for select to authenticated using (user_id = (select auth.uid()))');
    }
  });

  it('the live map hides moving vehicles during Night Mode, on the server', () => {
    expect(policiesOn('public.telemetry_latest')[0]).toContain('not public.is_night(now())');
  });

  it('every function is security definer with an empty search_path, and only signed-in users may run it', () => {
    expect(functions.length).toBeGreaterThanOrEqual(14);
    for (const fn of functions) {
      expect(fn).toContain('security definer');
      expect(fn).toContain("set search_path = ''");
      const name = /create function (public\.\w+\([^)]*\))/.exec(fn)![1].replace(/\s*\w+\s+(\w+)(,|\))/g, '$1$2');
      expect(statements.some((s) => s.startsWith(`revoke execute on function ${name.replace(/\(.*$/, '')}`) && / from public, anon/.test(s))).toBe(true);
    }
  });

  it('team-only functions check the allowlist; the internal earn function is not callable by clients', () => {
    expect(statements).toContain('revoke execute on function public.energy_earn(text, text) from public, anon, authenticated');
    expect(statements.some((s) => s.startsWith('grant execute on function public.energy_earn'))).toBe(false);
    const teamOnly = bodies.filter((body) => body.includes('team accounts only in v0'));
    expect(teamOnly.length).toBeGreaterThanOrEqual(6);
  });

  it('delete_my_account removes the profile, ledger, check-ins, posts and flags of the caller', () => {
    const body = bodies.find((b) => b.includes('delete from auth.users'))!;
    for (const table of ['feed_flags', 'feed_posts', 'checkins', 'energy_ledger', 'profiles']) {
      expect(body).toContain(`delete from public.${table} where user_id = uid`);
    }
  });

  it('every policy names the authenticated role, never anon or public', () => {
    const policies = statements.filter((s) => s.startsWith('create policy'));
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) expect(policy).toMatch(/ to authenticated /);
  });

  it('open sign-up: the commuter functions and the live map take any participant; publishing positions stays team-only', () => {
    expect(sql).toMatch(/alter table public.app_config add column open_signup boolean not null default true/);
    expect(bodies.filter((body) => body.includes('sign in to take part')).length).toBeGreaterThanOrEqual(6);
    expect(statements.filter((s) => s.startsWith('alter policy') && s.includes('may_participate()')).length).toBe(2);
    const ingest = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'ingest', 'index.ts'), 'utf8');
    expect(ingest).toMatch(/from\('team_accounts'\)/);
  });

  it('night feed delay (PRD 10.4): a post naming a stop, posted at night, waits for others but not its author', () => {
    expect(sql).toMatch(/add column night_feed_delay_min int not null default 2/);
    const feed = statements.filter((s) => s.startsWith('alter policy "feed_posts:'));
    expect(feed).toHaveLength(1);
    expect(feed[0]).toContain('stop_code is null');
    expect(feed[0]).toContain('user_id = (select auth.uid())');
    expect(feed[0]).toContain('not public.is_night(created_at)');
    expect(feed[0]).toContain('night_feed_delay_min');
  });

  it('v0: the live map is for team accounts only again; the moving-vehicle night rule stays', () => {
    const last = (table: string) => statements.filter((s) => s.startsWith(`alter policy "${table}:`) && s.includes(' using ')).pop() ?? '';
    expect(last('vehicles')).toContain('public.is_team_account()');
    expect(last('telemetry_latest')).toContain('public.is_team_account()');
    expect(last('telemetry_latest')).toContain('not public.is_night(now())');
    expect(sql).toMatch(/rename to "telemetry_latest: team accounts read active vehicles"/);
  });

  it('ST2-D2: the last Energy switch makes tracking cost Energy again (applied live; kept, Emjay 2026-10-12)', () => {
    const switches = statements.filter((s) => s.startsWith('update public.app_config set energy_enabled'));
    expect(switches.pop()).toBe('update public.app_config set energy_enabled = true');
  });

  it('CA1.1: check-ins spend 0.3 a route before they count; GPS relays and waiting refill; every account starts full', () => {
    expect(sql).toMatch(/add column energy_checkin_route_cost numeric\(4, 1\) not null default 0\.3/);
    expect(sql).toMatch(/add column energy_welcome numeric\(4, 1\) not null default 5/);
    expect(statements.filter((s) => s.startsWith('update public.app_config set energy_no_gps_report')).pop()).toBe('update public.app_config set energy_no_gps_report = 0');
    expect(statements).toContain('revoke execute on function public.energy_charge_checkin(int, text) from public, anon, authenticated');
    expect(statements.some((s) => s.startsWith('grant execute on function public.energy_charge_checkin'))).toBe(false);
    // The newest check_in and check_in_routes charge before inserting, and no longer earn
    for (const name of ['public.check_in(', 'public.check_in_routes(']) {
      const last = [...sql.matchAll(/create (?:or replace )?function ([\w.]+\()[^$]*\$\$([\s\S]*?)\$\$/g)].filter((m) => m[1] === name).pop()![2];
      expect(last.indexOf('energy_charge_checkin')).toBeGreaterThan(-1);
      expect(last.indexOf('energy_charge_checkin')).toBeLessThan(last.indexOf('insert into public.checkins'));
      expect(last).not.toContain("energy_earn('checkin'");
    }
  });

  it('publishes telemetry_latest, and only it, to Realtime', () => {
    const published = statements.filter((s) => s.startsWith('alter publication supabase_realtime'));
    expect(published).toEqual(['alter publication supabase_realtime add table public.telemetry_latest']);
  });

  it('contains no destructive statement', () => {
    expect(statements.filter((s) => /^(drop|truncate|delete) /.test(s))).toEqual([]);
  });
});

describe('migration: driver side (DR3)', () => {
  const driverStatements = driverSql
    .replace(/\$\$[\s\S]*?\$\$/g, '$$body$$')
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim());
  const driverFunctions = driverStatements
    .filter((s) => s.startsWith('create function'))
    .map((s) => /create function public\.(\w+)/.exec(s)![1]);
  const tableBody = (table: string) => {
    const body = driverSql.slice(driverSql.indexOf(`create table ${table} (`));
    return body.slice(0, body.indexOf(');'));
  };

  it('creates the driver-side tables, all server-only', () => {
    expect(tables).toEqual(expect.arrayContaining(DRIVER_SIDE_TABLES));
    for (const table of DRIVER_SIDE_TABLES) {
      expect(clientGrantsOn(table)).toEqual([]);
      expect(policiesOn(table)).toEqual([]);
    }
  });

  it('leaves the commuter tables alone: vehicles, which signed-in users read, gains no column', () => {
    expect(driverStatements.filter((s) => s.startsWith('alter table') && !s.endsWith('enable row level security'))).toEqual([]);
    expect(driverStatements.filter((s) => /^(alter|create) policy/.test(s))).toEqual([]);
  });

  it('keeps secrets in Vault: tables hold only Vault ids, never a secret, key or token', () => {
    for (const table of DRIVER_SIDE_TABLES) expect(tableBody(table)).not.toMatch(/\b(secret|sms_key|token)\s+text\b/);
    expect(tableBody('public.vehicle_beacons')).toMatch(/secret_id\s+uuid not null/);
    expect(tableBody('public.driver_devices')).toMatch(/sms_key_id\s+uuid not null/);
    expect(tableBody('public.gateways')).toContain("token_hash         text not null check (token_hash ~ '^[0-9a-f]{64}$')");
  });

  it('holds driver numbers only in the two server-only tables, in E.164', () => {
    expect(DRIVER_SIDE_TABLES.filter((table) => tableBody(table).includes('phone_e164'))).toEqual(['public.driver_devices', 'public.gateways']);
    expect(tableBody('public.driver_devices')).toContain(String.raw`phone_e164      text not null check (phone_e164 ~ '^\+639[0-9]{9}$')`);
  });

  it('lets only the service role run the worker and admin functions; vault_put is internal', () => {
    expect(driverFunctions).toHaveLength(14);
    expect(driverStatements).toContain('revoke execute on function public.vault_put(text, text, text) from public, anon, authenticated');
    expect(driverStatements.some((s) => s.startsWith('grant execute on function public.vault_put'))).toBe(false);
    for (const name of driverFunctions.filter((fn) => fn !== 'vault_put')) {
      expect(name).toMatch(/^(worker|admin)_/);
      const revoke = driverStatements.find((s) => s.startsWith(`revoke execute on function public.${name}(`));
      expect(revoke).toMatch(/ from public, anon, authenticated$/);
      const grants = driverStatements.filter((s) => s.startsWith(`grant execute on function public.${name}(`));
      expect(grants).toHaveLength(1);
      expect(grants[0]).toMatch(/ to service_role$/);
    }
  });

  it('wraps sequence numbers at the protocol modulus and keeps one active phone per vehicle', () => {
    expect(driverSql).toContain(`% ${SMS_SEQ_MODULUS}`);
    expect(driverSql).toContain(`last_seq        integer check (last_seq between 0 and ${SMS_SEQ_MODULUS - 1})`);
    expect(driverSql).toContain('create unique index driver_devices_one_active_per_vehicle on public.driver_devices (vehicle_id) where active');
  });

  it('fix 20261013000001: an alert kind may contain digits (latency_p90)', () => {
    const fix = read(['20261013000001_ops_alerts_kind.sql']);
    expect(fix).toContain("add constraint ops_alerts_kind_check check (kind ~ '^[a-z0-9_]{1,40}$')");
    expect(new RegExp('^[a-z0-9_]{1,40}$').test('latency_p90')).toBe(true);
  });

  it('counts waiting commuters by the same rule as checkin_counts', () => {
    const body = bodies.find((b) => b.includes('from public.checkins c') && b.includes('count(*)::bigint') && b.includes('group by c.route_id'));
    expect(body).toContain('c.expires_at > now()');
  });
});

describe('migration: boarding detection (DR8)', () => {
  const beaconSql = read(['20261014000000_beacon_verify.sql']);
  const body = (fn: string) => {
    const start = beaconSql.indexOf(`create function public.${fn}(`);
    const rest = beaconSql.slice(start);
    return rest.slice(0, rest.indexOf('$$;', rest.indexOf('as $$')));
  };

  it('verify_beacon is for signed-in users only: one grant, to authenticated', () => {
    expect(statements).toContain('revoke execute on function public.verify_beacon(text) from public, anon');
    expect(statements.filter((s) => s.startsWith('grant execute on function public.verify_beacon'))).toEqual(['grant execute on function public.verify_beacon(text) to authenticated']);
    expect(body('verify_beacon')).toContain('public.may_participate()');
  });

  it('the check that reads the secrets is internal: no client may call beacon_check', () => {
    expect(statements).toContain('revoke execute on function public.beacon_check(text) from public, anon, authenticated');
    expect(statements.some((s) => s.startsWith('grant execute on function public.beacon_check'))).toBe(false);
    expect(body('beacon_check')).toContain('vault.decrypted_secrets');
    // Only the vehicle, its route and plate (and a status) ever leave it
    expect(beaconSql).toContain('returns table (vehicle_id text, route_id text, plate text, status text)');
  });

  it('checks codes by the shared rule: version, 60 s slots, one slot either side', () => {
    const check = body('beacon_check');
    expect(check).toContain(`code_version <> ${BEACON_PAYLOAD_VERSION}`);
    expect(check).toContain(`extract(epoch from now()) / ${BEACON_SLOT_S}`);
    expect(check).toContain(`for slot_offset in -${BEACON_SLOT_TOLERANCE}..${BEACON_SLOT_TOLERANCE} loop`);
    expect(check).toContain("extensions.hmac(");
    expect(check).toContain("'sha256'");
  });

  it(`limits a user to ${BEACON_VERIFY_PER_MIN} checks a minute, counted in a server-only table`, () => {
    expect(body('verify_beacon')).toContain(`used > ${BEACON_VERIFY_PER_MIN}`);
    expect(clientGrantsOn('public.beacon_verify_calls')).toEqual([]);
    expect(policiesOn('public.beacon_verify_calls')).toEqual([]);
    expect(beaconSql).toContain('user_id       uuid primary key references auth.users (id) on delete cascade');
  });

  it('answers a bad code with a status, never an exception, so failed checks still count', () => {
    expect(body('verify_beacon')).not.toMatch(/raise exception '%'/);
    expect(body('beacon_check')).not.toContain('raise');
  });

  it('a relay may carry the code: an eight-argument post_report, the beacon without a default; beacon_ok stays server-only', () => {
    expect(statements).toContain('grant execute on function public.post_report(text, text, text, text, boolean, text, text, text) to authenticated');
    expect(beaconSql).toContain('stop text, beacon text, request_key text)');
    expect(beaconSql).not.toMatch(/beacon text default/);
    expect(statements).toContain('alter table public.feed_posts add column beacon_ok boolean');
    expect(statements.some((s) => s.startsWith('grant') && s.includes('beacon_ok'))).toBe(false);
  });
});

describe('migration: relay gate (RL2a)', () => {
  const gateSql = read(['20261023000000_relay_gate.sql']);
  const postReport = 'public.post_report(text, text, text, text, boolean, text, text, boolean, text)';

  it('only the nine-argument post_report is callable; the older versions lose their grant', () => {
    expect(statements).toContain(`grant execute on function ${postReport} to authenticated`);
    for (const old of [
      'public.post_report(text, text, text, text, boolean, text)',
      'public.post_report(text, text, text, text, boolean, text, text)',
      'public.post_report(text, text, text, text, boolean, text, text, text)',
    ]) {
      expect(statements).toContain(`revoke execute on function ${old} from authenticated`);
    }
  });

  it('refuses a relay without a valid beacon code for the same route and vehicle', () => {
    expect(gateSql).toContain("if beacon is null then raise exception 'a registered multicab beacon is needed'");
    expect(gateSql).toMatch(/checked\.status is distinct from 'ok' or checked\.route_id is distinct from route/);
  });

  it('live_map is readable by clients, ended_at is not; old relays with GPS move to the live map', () => {
    expect(statements).toContain('grant select (live_map) on public.feed_posts to authenticated');
    expect(statements.some((s) => s.startsWith('grant') && s.includes('ended_at'))).toBe(false);
    expect(statements).toContain('update public.feed_posts set live_map = with_gps');
  });

  it('a post lapses after the grace minutes unless renewed; only its author renews or ends it', () => {
    expect(gateSql).toMatch(/relay_post_grace_min smallint not null default 15/);
    expect(gateSql).toMatch(/relay_post_revive_min smallint not null default 30/);
    for (const fn of ['renew_report', 'end_report']) {
      expect(statements).toContain(`grant execute on function public.${fn}(bigint) to authenticated`);
      const body = gateSql.slice(gateSql.indexOf(`create function public.${fn}`));
      expect(body.slice(0, body.indexOf('$$;'))).toContain('f.user_id = uid');
    }
    // An ended or hidden post never comes back
    expect(gateSql).toMatch(/f\.ended_at is null\s+and not f\.hidden/);
  });
});
