-- Night relays go to Crowdsource (owner, 2026-11-23; PRD 10.4). From 9 PM to 5 AM (is_night) the live
-- map shows no multicab, so a relay sent then is posted to Crowdsource whatever the app asked
-- (live_map is stored false), and it earns energy_live_report (+1.0) as a live map relay would: the
-- rider could not choose the live map. The night Crowdsource rules stay as they are (a post naming a
-- stop waits night_feed_delay_min; at night only authors who relayed before show).
--
-- post_report as in 20261101000000_relay_energy.sql, replaced in place with the same arguments; only
-- the live_map value stored and the earning kind change. No row is changed.

create or replace function public.post_report(route text, phrase text, seat_tier text, vehicle text, with_gps boolean, stop text, beacon text, live_map boolean, request_key text)
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
  night boolean := public.is_night(now());
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
  if exists (
    select 1 from public.feed_posts f
     where f.user_id = uid
       and f.vehicle_id = checked.vehicle_id
       and f.beacon_ok
       and f.created_at > now() - make_interval(hours => (select c.relay_same_vehicle_gap_h from public.app_config c))
  ) then
    raise exception 'you already relayed this multicab' using errcode = 'P0001';
  end if;
  insert into public.feed_posts (user_id, author_username, route_id, vehicle_id, phrase, seat_tier, with_gps, stop_code, beacon_ok, live_map, expires_at)
  values (uid, name, route, checked.vehicle_id, post_report.phrase, post_report.seat_tier, with_gps, post_report.stop, true,
          post_report.live_map and not night,
          now() + make_interval(mins => (select c.relay_post_grace_min from public.app_config c)))
  returning id into post;
  -- At night the rider could not choose the live map, so the relay earns as one
  perform public.energy_earn(case when post_report.live_map or night then 'live_report' else 'feed_report' end, post_report.request_key);
  return post;
end;
$$;

revoke execute on function public.post_report(text, text, text, text, boolean, text, text, boolean, text) from public, anon;
grant execute on function public.post_report(text, text, text, text, boolean, text, text, boolean, text) to authenticated;
