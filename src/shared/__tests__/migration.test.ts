// Static checks on the migration text. They catch a forgotten security statement, but they do NOT
// prove what the database enforces: that needs the live project (tests/integration, S4 part 2).

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.join(__dirname, '..', '..', '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

const sql = fs
  .readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => fs.readFileSync(path.join(MIGRATIONS, name), 'utf8'))
  .join('\n')
  // Drop comments, so a word in a comment cannot satisfy or fail a check
  .replace(/--.*$/gm, '')
  .toLowerCase();

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
    const grant = clientGrantsOn('public.feed_posts');
    expect(grant).toHaveLength(1);
    expect(grant[0]).toMatch(/^grant select \(/);
    expect(grant[0]).not.toContain('user_id');
  });

  it('gives telemetry_latest the verification columns with safe defaults', () => {
    expect(sql).toMatch(/verified\s+boolean not null default false/);
    expect(sql).toMatch(/verification_reasons\s+jsonb not null default '\[\]'::jsonb/);
  });

  it('stores no rider category, avatar, name, email or phone in any table', () => {
    for (const word of ['classification', 'avatar', 'full_name', 'email', 'phone', 'discount']) {
      expect(sql).not.toContain(word);
    }
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
    for (const table of ['public.team_accounts', 'public.telemetry_ingest_log', 'public.telemetry_raw', 'public.feed_flags', 'public.feed_review_queue']) {
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

  it('publishes telemetry_latest, and only it, to Realtime', () => {
    const published = statements.filter((s) => s.startsWith('alter publication supabase_realtime'));
    expect(published).toEqual(['alter publication supabase_realtime add table public.telemetry_latest']);
  });

  it('contains no destructive statement', () => {
    expect(statements.filter((s) => /^(drop|truncate|delete) /.test(s))).toEqual([]);
  });
});
