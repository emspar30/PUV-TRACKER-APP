-- DT1 (PRD 10.5; 2026-11-02): detours. The known alternative lines ship with the app and the ingest
-- function (src/data/seed/detours.ts); this table says which are active. An admin turns one on or off
-- (admin_set_detour); the app reads the active ones (active_detours) and the ingest function accepts
-- a ride on an active one. Unknown detours: when relays on a route fail the route test 3 times in a
-- Manila day (note_off_route, from the ingest function), ops_alerts gets one 'unknown_detour' row
-- for that route and day, for an admin to add or correct a line. Fares never use detours.

alter table public.app_config add column unknown_detour_alert_count smallint not null default 3;

create table public.route_alternatives (
  alternative_id  text primary key check (alternative_id ~ '^[A-Za-z0-9-]{1,40}$'),
  route_id        text not null,
  active          boolean not null default false,
  updated_at      timestamptz not null default now()
);
alter table public.route_alternatives enable row level security;
revoke all on public.route_alternatives from anon, authenticated;
grant all on public.route_alternatives to service_role;

create table public.off_route_days (
  route_id  text not null,
  day       date not null,
  failures  integer not null default 0,
  primary key (route_id, day)
);
alter table public.off_route_days enable row level security;
revoke all on public.off_route_days from anon, authenticated;
grant all on public.off_route_days to service_role;

-- The active detours, for every signed-in rider (no personal data)
create function public.active_detours()
returns table (alternative_id text, route_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.alternative_id, a.route_id from public.route_alternatives a where a.active;
$$;

-- An admin turns a known detour on or off
create function public.admin_set_detour(route text, alternative text, active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or (select auth.role()) = 'service_role') then raise exception 'admins only' using errcode = '42501'; end if;
  insert into public.route_alternatives as a (alternative_id, route_id, active)
  values (admin_set_detour.alternative, admin_set_detour.route, admin_set_detour.active)
  on conflict (alternative_id) do update set route_id = excluded.route_id, active = excluded.active, updated_at = now();
end;
$$;

-- The ingest function: a relay on this route failed the route test. The third in a Manila day raises
-- one unknown_detour alert for the route and day.
create function public.note_off_route(route text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'asia/manila')::date;
  count_now integer;
begin
  insert into public.off_route_days as d (route_id, day, failures) values (note_off_route.route, today, 1)
  on conflict (route_id, day) do update set failures = d.failures + 1
  returning d.failures into count_now;
  if count_now = (select c.unknown_detour_alert_count from public.app_config c) then
    insert into public.ops_alerts (kind, detail) values ('unknown_detour', jsonb_build_object('route', note_off_route.route, 'day', today));
  end if;
end;
$$;

revoke execute on function public.active_detours() from public, anon;
grant execute on function public.active_detours() to authenticated, service_role;
revoke execute on function public.admin_set_detour(text, text, boolean) from public, anon;
grant execute on function public.admin_set_detour(text, text, boolean) to authenticated, service_role;
revoke execute on function public.note_off_route(text) from public, anon, authenticated;
grant execute on function public.note_off_route(text) to service_role;
