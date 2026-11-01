// MOD1a: the moderation migration's rules, read from its SQL (comments dropped).

import fs from 'node:fs';
import path from 'node:path';

const SQL = fs
  .readFileSync(path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261102000002_moderation.sql'), 'utf8')
  .replace(/--.*$/gm, '');

describe('migration: moderation (MOD1a)', () => {
  it('keeps strikes and appeals server-only, behind row-level security', () => {
    for (const table of ['strikes', 'appeals']) {
      expect(SQL).toContain(`alter table public.${table} enable row level security`);
      expect(SQL).toContain(`revoke all on public.${table} from anon, authenticated`);
    }
  });

  it('defaults match the app config: 2 strikes in 30 days give 7 days; strikes last 60 days; Merit 1 per 100, at most 3', () => {
    for (const fragment of [
      'suspension_strikes smallint not null default 2',
      'suspension_window_days smallint not null default 30',
      'suspension_days smallint not null default 7',
      'strike_expiry_days smallint not null default 60',
      'merit_points_per smallint not null default 100',
      'merit_max smallint not null default 3',
      'flag_min_account_days smallint not null default 7',
      'flag_weight_min_age_h smallint not null default 48',
      'trust_level_min_reports smallint not null default 10',
    ]) {
      expect(SQL).toContain(fragment);
    }
  });

  it('a suspended account may not take part; flags are tagged, eligible, limited and weighted', () => {
    expect(SQL).toContain('create or replace function public.may_participate()');
    expect(SQL).toContain('p.suspended_until > now()');
    expect(SQL).toContain("check (tag in ('false_location', 'spamming', 'not_a_puv'))");
    expect(SQL).toContain("raise exception 'flag_too_new'");
    expect(SQL).toContain("raise exception 'flag_limit'");
    expect(SQL).toContain('where f.post_id = flag_report.post and f.weighted');
    expect(SQL).toContain("perform public.strike_author(author, flag_report.post, 'auto_evidence')");
    expect(SQL).toContain('revoke execute on function public.flag_post(bigint) from authenticated');
  });

  it('only admins (or the dashboard) confirm reports and decide appeals; an upheld appeal gives back the Merit point', () => {
    expect(SQL.match(/if not \(public\.is_admin\(\) or \(select auth\.role\(\)\) = 'service_role'\) then raise exception 'admins only'/g)).toHaveLength(2);
    expect(SQL).toContain('set merit_used = greatest(p.merit_used - 1, 0)');
    expect(SQL).toContain('perform public.moderation_settle(s.user_id)');
  });

  it('internal functions are not callable by clients', () => {
    for (const fn of ['active_strikes(uuid, timestamptz)', 'moderation_settle(uuid)', 'strike_author(uuid, bigint, text)']) {
      expect(SQL).toContain(`revoke execute on function public.${fn} from public, anon, authenticated`);
      expect(SQL).not.toContain(`grant execute on function public.${fn}`);
    }
  });
});
