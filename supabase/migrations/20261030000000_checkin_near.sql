-- Check in near the route (Emjay, 2026-10-30, CA3). The fill stops are gone; a commuter between
-- stops checks in "near the route" and is counted at the nearest stop, marked near. The phone checks
-- where it is (no coordinates are sent). The driver sees the two apart: "SM Butuan 3, Near 1".
-- Check-ins at a stop keep check_in and check_in_routes, which leave near false.

alter table public.checkins add column near boolean not null default false;

-- As check_in_routes, with `near`. Same Energy charge for each route pinged.
create function public.check_in_at(routes text[], station text, near boolean, request_key text)
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
  perform public.energy_charge_checkin(cardinality(picked), check_in_at.request_key);
  ends := now() + make_interval(mins => (select c.checkin_lifetime_min from public.app_config c));
  update public.checkins set expires_at = now() where user_id = uid and expires_at > now();
  insert into public.checkins (user_id, route_id, station_code, expires_at, near)
    select uid, r, station, ends, coalesce(check_in_at.near, false) from unnest(picked) r;
  return ends;
end;
$$;

revoke execute on function public.check_in_at(text[], text, boolean, text) from public, anon;
grant execute on function public.check_in_at(text[], text, boolean, text) to authenticated;

-- The worker's counts per route and stop, as worker_demand_snapshot (kept for an older worker), with
-- `near`: the part of `waiting` checked in near the stop
create function public.worker_demand_near()
returns table (route_id text, station_code text, waiting bigint, near bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.route_id, c.station_code, count(*)::bigint, count(*) filter (where c.near)::bigint
  from public.checkins c
  where c.expires_at > now()
  group by c.route_id, c.station_code;
$$;

revoke execute on function public.worker_demand_near() from public, anon, authenticated;
grant execute on function public.worker_demand_near() to service_role;
