// Night relays go to Crowdsource and earn as a live map relay (owner, 2026-11-23; migration
// 20261123000002_night_relays_feed.sql).

import fs from 'node:fs';
import path from 'node:path';

const sql = fs
  .readFileSync(path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261123000002_night_relays_feed.sql'), 'utf8')
  .replace(/--.*$/gm, '')
  .toLowerCase();

describe('migration: night relays (2026-11-23)', () => {
  it('stores a night relay off the live map, and pays it as a live map relay', () => {
    expect(sql).toContain('night boolean := public.is_night(now())');
    expect(sql).toContain('post_report.live_map and not night');
    expect(sql).toContain("case when post_report.live_map or night then 'live_report' else 'feed_report' end");
  });

  it('keeps the beacon and same-multicab checks before anything is posted', () => {
    const insertAt = sql.indexOf('insert into public.feed_posts');
    expect(sql.indexOf("raise exception 'a registered multicab beacon is needed'")).toBeLessThan(insertAt);
    expect(sql.indexOf("raise exception 'you already relayed this multicab'")).toBeLessThan(insertAt);
  });

  it('replaces post_report in place, for signed-in accounts only, and drops nothing', () => {
    expect(sql).toContain('create or replace function public.post_report(route text, phrase text, seat_tier text, vehicle text, with_gps boolean, stop text, beacon text, live_map boolean, request_key text)');
    expect(sql).toContain('revoke execute on function public.post_report(text, text, text, text, boolean, text, text, boolean, text) from public, anon');
    expect(sql).not.toMatch(/\b(drop|truncate)\b|delete from/);
  });
});
