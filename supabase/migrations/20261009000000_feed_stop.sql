-- B6: a relay names the stop nearest to where it was sent, so Crowdsource can show "Near <stop>".
-- The phone works out the stop from its own position, even with "Share with GPS" off, and sends
-- only the stop code: feed posts still carry no coordinates (PRD 19 D2).

alter table public.feed_posts
  add column stop_code text check (stop_code ~ '^[A-Z0-9]{2,8}$');

grant select (stop_code) on public.feed_posts to authenticated;

-- post_report with the stop (null when the phone knows no position or no stop is near). The
-- six-argument version stays, for app builds from before B6; it posts with no stop.

create function public.post_report(route text, phrase text, seat_tier text, vehicle text, with_gps boolean, stop text, request_key text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  name text;
  post bigint;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  select p.username into name from public.profiles p where p.user_id = uid;
  if name is null then raise exception 'set a username first' using errcode = 'P0001'; end if;
  insert into public.feed_posts (user_id, author_username, route_id, vehicle_id, phrase, seat_tier, with_gps, stop_code, expires_at)
  values (uid, name, route, vehicle, post_report.phrase, post_report.seat_tier, with_gps, post_report.stop,
          now() + make_interval(mins => (select c.feed_lifetime_min from public.app_config c)))
  returning id into post;
  perform public.energy_earn(case when with_gps then 'gps_report' else 'no_gps_report' end, post_report.request_key);
  return post;
end;
$$;

revoke execute on function public.post_report(text, text, text, text, boolean, text, text) from public, anon;
grant execute on function public.post_report(text, text, text, text, boolean, text, text) to authenticated;
