-- RL2a (Emjay's D9 to D12, 2026-10-23): the relay gate on the server.
-- - Every relay needs a valid multicab beacon code (DR8's beacon_check): the nine-argument
--   post_report refuses one without, or with a code that names another route or vehicle. The older
--   versions lose their grant, so builds from before RL2a can no longer relay.
-- - feed_posts.live_map: the relay shows on the live map, so it is left out of Crowdsource. Existing
--   rows take with_gps (before RL2a, a relay with GPS went to the live map). with_gps now only says
--   that the phone used GPS.
-- - A relay's post lapses app_config.relay_post_grace_min after it was sent or last renewed. The
--   phone renews it every few minutes while the relay runs (renew_report, no coordinates) and ends
--   it when the relay ends (end_report). If the battery runs out, it lapses by itself. A post that
--   lapsed less than relay_post_revive_min ago (a dead zone) comes back on the next renewal; an ended
--   or hidden one never does.
-- - Energy is unchanged until RL2b: a relay on the live map books 'gps_report' (once a Manila day),
--   one in Crowdsource 'no_gps_report' (0 since CA1.1).
-- No table, row or function is removed; the older post_report versions stay, without a grant.

alter table public.app_config
  add column relay_post_grace_min smallint not null default 15 check (relay_post_grace_min between 1 and 180),
  add column relay_post_revive_min smallint not null default 30 check (relay_post_revive_min between 0 and 180);

alter table public.feed_posts
  add column live_map boolean not null default false,
  add column ended_at timestamptz;

update public.feed_posts set live_map = with_gps;

grant select (live_map) on public.feed_posts to authenticated;

-- The relay, with the beacon code the phone heard (required) and whether it goes to the live map
create function public.post_report(route text, phrase text, seat_tier text, vehicle text, with_gps boolean, stop text, beacon text, live_map boolean, request_key text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  name text;
  post bigint;
  checked record;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  select p.username into name from public.profiles p where p.user_id = uid;
  if name is null then raise exception 'set a username first' using errcode = 'P0001'; end if;
  if beacon is null then raise exception 'a registered multicab beacon is needed' using errcode = 'P0001'; end if;
  select * into checked from public.beacon_check(beacon);
  if checked.status is distinct from 'ok' or checked.route_id is distinct from route
     or (vehicle is not null and vehicle is distinct from checked.vehicle_id) then
    raise exception 'a registered multicab beacon is needed' using errcode = 'P0001';
  end if;
  insert into public.feed_posts (user_id, author_username, route_id, vehicle_id, phrase, seat_tier, with_gps, stop_code, beacon_ok, live_map, expires_at)
  values (uid, name, route, checked.vehicle_id, post_report.phrase, post_report.seat_tier, with_gps, post_report.stop, true, post_report.live_map,
          now() + make_interval(mins => (select c.relay_post_grace_min from public.app_config c)))
  returning id into post;
  perform public.energy_earn(case when post_report.live_map then 'gps_report' else 'no_gps_report' end, post_report.request_key);
  return post;
end;
$$;

-- "Still riding": the author's post stays up relay_post_grace_min more. false when it is not theirs,
-- ended, hidden, or lapsed relay_post_revive_min ago or more
create function public.renew_report(post bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.app_config;
  renewed int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into cfg from public.app_config;
  update public.feed_posts f
     set expires_at = now() + make_interval(mins => cfg.relay_post_grace_min)
   where f.id = renew_report.post
     and f.user_id = uid
     and f.ended_at is null
     and not f.hidden
     and f.expires_at > now() - make_interval(mins => cfg.relay_post_revive_min);
  get diagnostics renewed = row_count;
  return renewed = 1;
end;
$$;

-- The relay ended (at the stop, idle, the cap, or Stop): the author's post leaves the feed now
create function public.end_report(post bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update public.feed_posts f
     set ended_at = now(), expires_at = least(f.expires_at, now())
   where f.id = end_report.post
     and f.user_id = uid
     and f.ended_at is null;
end;
$$;

-- Only the nine-argument post_report is callable now
revoke execute on function public.post_report(text, text, text, text, boolean, text) from authenticated;
revoke execute on function public.post_report(text, text, text, text, boolean, text, text) from authenticated;
revoke execute on function public.post_report(text, text, text, text, boolean, text, text, text) from authenticated;
revoke execute on function public.post_report(text, text, text, text, boolean, text, text, boolean, text) from public, anon;
grant execute on function public.post_report(text, text, text, text, boolean, text, text, boolean, text) to authenticated;
revoke execute on function public.renew_report(bigint) from public, anon;
grant execute on function public.renew_report(bigint) to authenticated;
revoke execute on function public.end_report(bigint) from public, anon;
grant execute on function public.end_report(bigint) to authenticated;
