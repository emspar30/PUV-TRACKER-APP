// A plain Approve or Reject for driver registrations (owner, 2026-11-23; migration
// 20261123000003_plain_registration_decision.sql).

import fs from 'node:fs';
import path from 'node:path';

const sql = fs
  .readFileSync(path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261123000003_plain_registration_decision.sql'), 'utf8')
  .replace(/--.*$/gm, '')
  .toLowerCase();

describe('migration: plain registration decision (2026-11-23)', () => {
  it('approves without the checklist and rejects only with a reason', () => {
    expect(sql).toContain('create or replace function public.console_decide(registration uuid, approve boolean, review jsonb, decision_reason text, notice_ttl_min integer)');
    expect(sql).toContain('if review is not null and not public.registration_checks_valid(review)');
    expect(sql).not.toContain('checks_not_passed');
    expect(sql).not.toContain('no_failed_check');
    expect(sql).toContain("raise exception 'reason_needed'");
  });

  it('is still admin only, clears a rejected driver\'s name, and drops nothing', () => {
    expect(sql).toContain("if not public.is_admin() then raise exception 'admins only'");
    expect(sql).toContain('full_name = null');
    expect(sql).toContain('grant execute on function public.console_decide(uuid, boolean, jsonb, text, integer) to authenticated');
    expect(sql).not.toMatch(/\b(drop|truncate)\b|delete from/);
  });
});
