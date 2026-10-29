-- NM1 Night Mode stop view (PRD 10.4; docs/IMPLEMENTATION_PLAN_PRD_GAPS.md).
--
-- At night the map shows "R4 passed CSU · 3 min ago" instead of moving markers. The ingest function
-- records a passage when an accepted position comes within NODE_PASS_RADIUS_M of a stop of the
-- vehicle's route (supabase/functions/_shared/nodePassage.ts), at most once per vehicle and stop
-- every NODE_PASS_GAP_MIN. A passage holds no rider and no position, only route, stop and time.
--
-- Clients never read the table. night_stop_updates(route) returns, during the Night Mode window
-- only, the newest passage per stop of the route that is at least app_config.night_feed_delay_min
-- old (the same night delay as the feed) and at most app_config.night_stop_window_min old. It names
-- no vehicle and no plate. Retention: 7 days (supabase/cron/retention.sql).
--
-- Nothing is removed or changed.

alter table public.app_config
  add column night_stop_window_min int not null default 60 check (night_stop_window_min between 5 and 240);

create table public.node_events (
  id          bigint generated always as identity primary key,
  vehicle_id  text not null references public.vehicles (vehicle_id),
  route_id    text not null check (route_id ~ '^R[0-9]{1,2}$'),
  stop_code   text not null check (stop_code ~ '^[A-Z]{2,4}$'),
  passed_at   timestamptz not null
);

create index node_events_route_idx on public.node_events (route_id, passed_at desc);
create index node_events_vehicle_idx on public.node_events (vehicle_id, passed_at desc);

alter table public.node_events enable row level security;
revoke all on public.node_events from anon, authenticated;
grant all on public.node_events to service_role;

create function public.night_stop_updates(route text)
returns table (stop_code text, passed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (e.stop_code) e.stop_code, e.passed_at
  from public.node_events e, public.app_config c
  where e.route_id = route
    and public.is_night(now())
    and e.passed_at <= now() - make_interval(mins => c.night_feed_delay_min)
    and e.passed_at > now() - make_interval(mins => c.night_stop_window_min)
  order by e.stop_code, e.passed_at desc;
$$;

revoke execute on function public.night_stop_updates(text) from public, anon;
grant execute on function public.night_stop_updates(text) to authenticated;
