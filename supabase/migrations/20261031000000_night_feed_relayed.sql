-- Night Crowdsource from known relayers (Emjay, 2026-10-31, option a; PRD 10.4). During Night Mode
-- Crowdsource shows only relays from accounts that had relayed at least once before, so a brand-new
-- account cannot post at night until it has relayed by day. The author always sees their own post,
-- and relays on the live map are not affected (at night the map shows passed stops only).
-- No table, row, grant or function is removed.

-- Each post says whether its author had a relay before it that nobody hid
alter table public.feed_posts
  add column author_relayed_before boolean not null default false;

update public.feed_posts f
  set author_relayed_before = exists (
    select 1 from public.feed_posts e
    where e.user_id = f.user_id and e.id < f.id and not e.hidden
  );

-- As in trust_points, with author_relayed_before stamped from the posts before it
create or replace function public.trust_on_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_trusted := coalesce(
    (select p.trust_points from public.profiles p where p.user_id = new.user_id), 0
  ) >= (select c.trust_badge_points from public.app_config c);
  new.author_relayed_before := exists (
    select 1 from public.feed_posts f where f.user_id = new.user_id and not f.hidden
  );
  new.trust_earned := public.trust_award(new.user_id);
  return new;
end;
$$;

-- As in night_feed_delay_team_live, and at night a Crowdsource post shows only when its author had
-- relayed before
alter policy "feed_posts: signed-in users read live, visible posts" on public.feed_posts
  using (
    not hidden
    and expires_at > now()
    and (
      stop_code is null
      or user_id = (select auth.uid())
      or not public.is_night(created_at)
      or created_at <= now() - make_interval(mins => (select c.night_feed_delay_min from public.app_config c))
    )
    and (
      live_map
      or author_relayed_before
      or user_id = (select auth.uid())
      or not public.is_night(now())
    )
  );
