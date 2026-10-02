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

const statements = sql.split(';').map((s) => s.replace(/\s+/g, ' ').trim());
const tables = [...sql.matchAll(/create table (public\.\w+)/g)].map((match) => match[1]);
const CLIENT_ROLES = /\b(anon|authenticated|public)\b/;

const grantsOn = (table: string) => statements.filter((s) => s.startsWith('grant ') && s.includes(` on ${table} `));
const clientGrantsOn = (table: string) =>
  grantsOn(table).filter((s) => CLIENT_ROLES.test(s.slice(s.indexOf(' to ') + 4)));
const policiesOn = (table: string) => statements.filter((s) => s.startsWith('create policy') && s.includes(` on ${table} `));

describe('migration: tables', () => {
  it('creates the tables needed for the live map, and the allowlist', () => {
    expect(tables).toEqual(
      expect.arrayContaining(['public.profiles', 'public.vehicles', 'public.telemetry_latest', 'public.telemetry_writers']),
    );
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
  });

  it('vehicles is read-only for clients and limited to active vehicles', () => {
    expect(clientGrantsOn('public.vehicles')).toEqual(['grant select on public.vehicles to authenticated']);
    const policies = policiesOn('public.vehicles');
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatch(/for select to authenticated using \(active\)/);
  });

  it('the allowlist and the audit log are invisible to clients: no grant and no policy', () => {
    for (const table of ['public.telemetry_writers', 'public.telemetry_ingest_log']) {
      expect(clientGrantsOn(table)).toEqual([]);
      expect(policiesOn(table)).toEqual([]);
    }
  });

  it('profiles lets a user read and create only their own row, and never update or delete', () => {
    expect(clientGrantsOn('public.profiles')).toEqual(['grant select, insert on public.profiles to authenticated']);
    const policies = policiesOn('public.profiles');
    expect(policies).toHaveLength(2);
    for (const policy of policies) expect(policy).toContain('user_id = (select auth.uid())');
  });

  it('every policy names the authenticated role, never anon or public', () => {
    const policies = statements.filter((s) => s.startsWith('create policy'));
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) expect(policy).toMatch(/ to authenticated /);
  });

  it('publishes telemetry_latest, and only it, to Realtime', () => {
    const published = statements.filter((s) => s.startsWith('alter publication supabase_realtime'));
    expect(published).toEqual(['alter publication supabase_realtime add table public.telemetry_latest']);
  });

  it('contains no destructive statement', () => {
    expect(statements.filter((s) => /^(drop|truncate|delete) /.test(s))).toEqual([]);
  });
});
