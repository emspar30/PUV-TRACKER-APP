-- A multicab with no new position is gone (2026-11-24). Field test: a relaying rider's app was
-- force-stopped and its multicab stayed on other phones' live maps. telemetry_latest kept serving the
-- last row however old it was, and a relay_sessions row was only let go when some other rider's
-- heartbeat came for the same multicab (after ten times relay_liveness_s), so a lone relay never
-- closed. Now, after vehicle_gone_s with no position or heartbeat:
-- - the live map no longer reads the multicab's telemetry_latest row (the app removes it at the same
--   age: COVERAGE_STALE_MAX_AGE_S = VEHICLE_GONE_S in serverConfig.ts);
-- - its relay sessions are closed, by any heartbeat and by relay_sessions_sweep(), which the
--   relay-sessions-sweep cron job runs every minute (supabase/cron/retention.sql).
-- No table, row or column is removed. The Primary handoff (relay_liveness_s) is unchanged.

alter table public.app_config add column vehicle_gone_s smallint not null default 600
  check (vehicle_gone_s > 0);

alter policy "telemetry_latest: live map users read active vehicles" on public.telemetry_latest
  using (
    (select public.may_use_live_map())
    and exists (
      select 1 from public.vehicles v
      where v.vehicle_id = telemetry_latest.vehicle_id and v.active
    )
    and not public.is_night(now())
    and telemetry_latest.packet_ts > now() - make_interval(secs => (select c.vehicle_gone_s from public.app_config c))
  );

-- BT1's heartbeat as in 20261113000000_live_map_open.sql, except that riders are let go after
-- vehicle_gone_s instead of ten times the liveness
create or replace function public.relay_heartbeat(vehicle text, left_m real, eligible boolean, changed boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  liveness interval := make_interval(secs => (select c.relay_liveness_s from public.app_config c));
  gone interval := make_interval(secs => (select c.vehicle_gone_s from public.app_config c));
  current_primary uuid;
  chosen uuid;
  mine text;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not (public.may_participate() and public.may_use_live_map()) then
    raise exception 'live map not allowed' using errcode = '42501';
  end if;
  -- One heartbeat at a time per multicab
  perform pg_advisory_xact_lock(hashtext('relay_baton:' || relay_heartbeat.vehicle));

  insert into public.relay_sessions as r (vehicle_id, user_id, left_m, eligible, moved_back)
  values (relay_heartbeat.vehicle, uid, greatest(relay_heartbeat.left_m, 0), relay_heartbeat.eligible, coalesce(relay_heartbeat.changed, false))
  on conflict (vehicle_id, user_id) do update
    set left_m = excluded.left_m,
        eligible = excluded.eligible,
        moved_back = r.moved_back or excluded.moved_back,
        last_seen = now();

  -- Riders silent for vehicle_gone_s are let go: their relay has ended
  delete from public.relay_sessions r
   where r.vehicle_id = relay_heartbeat.vehicle and r.last_seen < now() - gone;

  select r.user_id into current_primary
    from public.relay_sessions r
   where r.vehicle_id = relay_heartbeat.vehicle and r.role = 'primary' and r.last_seen > now() - liveness
   limit 1;

  if current_primary is null then
    select r.user_id into chosen
      from public.relay_sessions r
     where r.vehicle_id = relay_heartbeat.vehicle and r.last_seen > now() - liveness
     order by r.eligible desc, r.moved_back asc, r.left_m desc, r.joined_at asc
     limit 1;
    update public.relay_sessions r
       set role = case when r.user_id = chosen then 'primary' else 'secondary' end
     where r.vehicle_id = relay_heartbeat.vehicle;
  end if;

  select r.role into mine from public.relay_sessions r where r.vehicle_id = relay_heartbeat.vehicle and r.user_id = uid;
  return mine;
end;
$$;

-- Closes every relay session silent for vehicle_gone_s, also when no other rider heartbeats the
-- multicab (a lone relay whose app was stopped). Run by the relay-sessions-sweep cron job.
create function public.relay_sessions_sweep()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed integer;
begin
  delete from public.relay_sessions r
   where r.last_seen < now() - make_interval(secs => (select c.vehicle_gone_s from public.app_config c));
  get diagnostics closed = row_count;
  return closed;
end;
$$;

revoke execute on function public.relay_sessions_sweep() from public, anon, authenticated;
grant execute on function public.relay_sessions_sweep() to service_role;
