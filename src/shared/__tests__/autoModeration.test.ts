// Automatic moderation (owner, 2026-11-23): the rules mirrored from migration
// 20261123000000_auto_moderation.sql, the console's evidence hint, and the migration's own text.

import fs from 'node:fs';
import path from 'node:path';

import { BAN_STRIKES, MODERATION_LIST_DAYS, SUSPENSION_STRIKES } from '../config';
import { evidenceHint, waitingCount } from '../moderation/console';
import { autoStrike, isBan, needsReview, settleOutcome, type Strike } from '../moderation/rules';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 23, 12);

const strike = (daysAgo: number, extra: Partial<Strike> = {}): Strike => ({
  id: String(daysAgo),
  reason: 'flagged_unverified',
  createdMs: NOW - daysAgo * DAY,
  expiresMs: NOW + 60 * DAY,
  absorbed: false,
  lifted: false,
  appealState: 'none',
  ...extra,
});

describe('automatic strikes', () => {
  it('phone evidence first; a verified ride waits for the admin; else flagged_unverified', () => {
    expect(autoStrike(true, true)).toBe('auto_evidence');
    expect(autoStrike(true, false)).toBe('auto_evidence');
    expect(autoStrike(false, true)).toBeNull();
    expect(autoStrike(false, false)).toBe('flagged_unverified');
  });

  it('a hidden verified ride with no strike needs the admin', () => {
    expect(needsReview({ hidden: true, verified: true, struck: false })).toBe(true);
    expect(needsReview({ hidden: true, verified: false, struck: true })).toBe(false);
    expect(needsReview({ hidden: false, verified: true, struck: false })).toBe(false);
    expect(needsReview({ hidden: true, verified: true, struck: true })).toBe(false);
  });
});

describe('suspension, then ban', () => {
  const fresh = { suspensions: 0, lastSuspendedMs: null, suspendedUntilMs: null };

  it('suspends at SUSPENSION_STRIKES strikes in 30 days', () => {
    expect(SUSPENSION_STRIKES).toBe(2);
    expect(settleOutcome([strike(1)], fresh, NOW)).toBe('none');
    expect(settleOutcome([strike(1), strike(10)], fresh, NOW)).toBe('suspend');
    expect(settleOutcome([strike(1), strike(40)], fresh, NOW)).toBe('none');
    expect(settleOutcome([strike(1), strike(2, { absorbed: true })], fresh, NOW)).toBe('none');
    expect(settleOutcome([strike(1), strike(2, { lifted: true })], fresh, NOW)).toBe('none');
  });

  it('after a suspension, only strikes made since it started count toward a ban', () => {
    expect(BAN_STRIKES).toBe(2);
    const after = { suspensions: 1, lastSuspendedMs: NOW - 10 * DAY, suspendedUntilMs: NOW - 3 * DAY };
    // The two strikes that caused the suspension do not count again
    expect(settleOutcome([strike(11), strike(12), strike(1)], after, NOW)).toBe('none');
    expect(settleOutcome([strike(11), strike(12), strike(1), strike(2)], after, NOW)).toBe('ban');
  });

  it('does nothing while a suspension runs', () => {
    expect(settleOutcome([strike(1), strike(2)], { suspensions: 1, lastSuspendedMs: NOW - DAY, suspendedUntilMs: NOW + DAY }, NOW)).toBe('none');
  });

  it('reads a suspension more than 10 years ahead as a ban', () => {
    expect(isBan(NOW + 7 * DAY, NOW)).toBe(false);
    expect(isBan(NOW + 100 * 365 * DAY, NOW)).toBe(true);
    expect(isBan(null, NOW)).toBe(false);
  });
});

describe('the console evidence hint', () => {
  const base = { verified: false, beacon_ok: null as boolean | null, risk_events: 0, flags: 3, weighted_flags: 3 };

  it('phone evidence says false; a verified beacon ride says real', () => {
    expect(evidenceHint({ ...base, risk_events: 1, verified: true, beacon_ok: true })).toBe('likely_false');
    expect(evidenceHint({ ...base, verified: true, beacon_ok: true })).toBe('likely_real');
  });

  it('no checks and every flag counted says false; anything else is mixed', () => {
    expect(evidenceHint(base)).toBe('likely_false');
    expect(evidenceHint({ ...base, weighted_flags: 2 })).toBe('unclear');
    expect(evidenceHint({ ...base, verified: true, beacon_ok: false })).toBe('unclear');
  });

  it('counts what needs the admin', () => {
    expect(waitingCount({ reviews: 2, appeals: 1 })).toBe(3);
    expect(waitingCount(null)).toBe(0);
  });
});

describe('migration: automatic moderation (2026-11-23)', () => {
  const sql = fs
    .readFileSync(path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261123000000_auto_moderation.sql'), 'utf8')
    .replace(/--.*$/gm, '')
    .toLowerCase();
  const statements = sql
    .replace(/\$\$[\s\S]*?\$\$/g, '$$body$$')
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  it('defaults match the app config', () => {
    expect(sql).toContain(`ban_strikes smallint not null default ${BAN_STRIKES}`);
    expect(sql).toContain(`moderation_list_days smallint not null default ${MODERATION_LIST_DAYS}`);
    expect(sql).toContain("reason in ('confirmed_report', 'auto_evidence', 'flagged_unverified')");
  });

  it('strikes a hidden post only when it was not a verified ride, and tells the author of each flag', () => {
    expect(sql).toContain("elsif not coalesce(ride_verified, false) then");
    expect(sql).toContain("perform public.strike_author(author, flag_report.post, 'flagged_unverified')");
    expect(sql).toContain("perform public.moderation_notify(author, 'flagged', flag_report.tag, flag_report.post, null)");
  });

  it('bans after a suspension only on strikes made since it started; lifts only what the rules set', () => {
    expect(sql).toContain('public.active_strikes(uid, greatest(since, prof.last_suspended_at))');
    expect(sql).toContain("ends := now() + interval '100 years'");
    expect(sql).toContain('if prof.suspension_by_rules');
    // A copy from the device ban is never lifted by the rules
    expect(sql).toContain('set suspended_until = new.suspended_until, suspension_by_rules = false');
  });

  it('keeps its tables from clients, and every console function checks is_admin()', () => {
    for (const table of ['moderation_notices', 'moderation_log']) {
      expect(statements).toContain(`alter table public.${table} enable row level security`);
      expect(statements).toContain(`revoke all on public.${table} from anon, authenticated`);
      expect(statements.some((s) => s.startsWith('create policy') && s.includes(`public.${table}`))).toBe(false);
    }
    const consoleBodies = [...sql.matchAll(/create function public\.console_\w+\([^)]*\)[\s\S]*?\$\$([\s\S]*?)\$\$/g)].map((match) => match[1]);
    expect(consoleBodies.length).toBe(10);
    for (const body of consoleBodies) expect(body).toContain("if not public.is_admin() then raise exception 'admins only'");
  });

  it('internal helpers are not callable by clients', () => {
    for (const fn of ['moderation_name(uuid)', 'moderation_record(boolean, text, uuid, text)', 'moderation_notify(uuid, text, text, bigint, timestamptz)']) {
      expect(statements).toContain(`revoke execute on function public.${fn} from public, anon, authenticated`);
      expect(statements.some((s) => s.startsWith(`grant execute on function public.${fn}`))).toBe(false);
    }
  });

  it('closes the manual suspend functions to every client (rules only, 2026-11-23)', () => {
    const closed = fs
      .readFileSync(path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261123000001_rules_only_suspend.sql'), 'utf8')
      .replace(/--.*$/gm, '');
    expect(closed).toContain('revoke execute on function public.console_suspend(uuid, integer, boolean, text) from public, anon, authenticated');
    expect(closed).toContain('revoke execute on function public.console_find_accounts(text) from public, anon, authenticated');
    expect(closed).not.toMatch(/grant/);
  });

  it('holds no contact details, location or destination', () => {
    expect(sql).not.toMatch(/\b(email|phone|lat|lon|destination)\b/);
  });
});
