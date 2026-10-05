-- One check-in for several routes at a shared stop (2026-10-07).
-- A stop served by R3, R4 and R5 lets the commuter ping one route or all of them in one go. Each
-- route gets its own row, so checkin_counts and the per-route SMS heatmap stay as they are, and the
-- commuter is counted only on the routes they would take: no SMS goes to drivers of routes they
-- will not ride. Like check_in, it ends the caller's previous check-in and earns Energy once.

create function public.check_in_routes(routes text[], station text, request_key text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ends timestamptz;
  picked text[];
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  picked := array(select distinct r from unnest(routes) r where r is not null);
  if cardinality(picked) = 0 or cardinality(picked) > 8 then
    raise exception 'pick 1 to 8 routes' using errcode = '22023';
  end if;
  ends := now() + make_interval(mins => (select c.checkin_lifetime_min from public.app_config c));
  update public.checkins set expires_at = now() where user_id = uid and expires_at > now();
  insert into public.checkins (user_id, route_id, station_code, expires_at)
    select uid, r, station, ends from unnest(picked) r;
  perform public.energy_earn('checkin', check_in_routes.request_key);
  return ends;
end;
$$;

revoke execute on function public.check_in_routes(text[], text, text) from public, anon;
grant execute on function public.check_in_routes(text[], text, text) to authenticated;
