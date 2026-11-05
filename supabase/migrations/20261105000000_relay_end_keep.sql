-- Ended Crowdsource relays stay in the feed (Emjay, 2026-11-05). Until now a Crowdsource relay left
-- the feed the moment it ended. Commuters further along the route lost the report as soon as the
-- rider got off. Now an ended Crowdsource relay stays until app_config.feed_lifetime_min (60) after
-- it was posted, the old one-hour limit, and the feed marks it as ended, so readers know its seats
-- may have changed. A relay that ran longer than that leaves at once, as before.
-- - Relays on the live map still leave at once: their marker status follows the running relay.
-- - A post that had already lapsed (no "still riding" signal) is not brought back by its end.
-- - A hidden post stays hidden; renew_report still refuses an ended post.
-- - feed_posts.ended (readable) says only that the relay ended; ended_at stays unreadable.
-- No table, row, grant or function is removed.

alter table public.feed_posts
  add column ended boolean generated always as (ended_at is not null) stored;

grant select (ended) on public.feed_posts to authenticated;

-- The relay ended (at the stop, idle, the cap, or Stop). On the live map the post leaves now; in
-- Crowdsource it stays, marked ended, until feed_lifetime_min after it was posted
create or replace function public.end_report(post bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.app_config;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into cfg from public.app_config;
  update public.feed_posts f
     set ended_at = now(),
         expires_at = case
           when not f.live_map and f.expires_at > now()
             then f.created_at + make_interval(mins => cfg.feed_lifetime_min)
           else least(f.expires_at, now())
         end
   where f.id = end_report.post
     and f.user_id = uid
     and f.ended_at is null;
end;
$$;
