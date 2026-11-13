-- The live map for every signed-in account (Emjay, 2026-11-13). Since 2026-10-10 only accounts in
-- public.team_accounts could read live vehicles, send live positions and join the relay baton: in v0
-- nothing checked a relay, so a fake marker had to be kept off the map (PRD 0.7). Relays are now
-- checked: a beacon the server verifies (RL2a), the rider on the route, the ride itself (V1a), flags,
-- strikes and suspensions (MOD1). The team rule goes; app_config.live_map_team_only brings it back
-- without another migration.
-- - Reading live vehicles: any signed-in account (Night Mode and the active rule unchanged).
-- - Sending positions and the baton: any account that may take part (may_participate: signed in,
--   open sign-up or team, not suspended). The ingest function applies the same switch.
-- No table, row, grant or function is removed; team_accounts stays and counts while the switch is on.

alter table public.app_config add column live_map_team_only boolean not null default false;

-- Whether the signed-in account may see and use the live map: team accounts always; everyone else
-- while live_map_team_only is off
create function public.may_use_live_map()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (not (select c.live_map_team_only from public.app_config c) or public.is_team_account());
$$;

revoke execute on function public.may_use_live_map() from public, anon;
grant execute on function public.may_use_live_map() to authenticated;

alter policy "vehicles: team accounts read active vehicles" on public.vehicles
  using (active and (select public.may_use_live_map()));
alter policy "vehicles: team accounts read active vehicles" on public.vehicles
  rename to "vehicles: live map users read active vehicles";

alter policy "telemetry_latest: team accounts read active vehicles" on public.telemetry_latest
  using (
    (select public.may_use_live_map())
    and exists (
      select 1 from public.vehicles v
      where v.vehicle_id = telemetry_latest.vehicle_id and v.active
    )
    and not public.is_night(now())
  );
alter policy "telemetry_latest: team accounts read active vehicles" on public.telemetry_latest
  rename to "telemetry_latest: live map users read active vehicles";

-- BT1's heartbeat, unchanged except who may join: any participant who may use the live map
create or replace function public.relay_heartbeat(vehicle text, left_m real, eligible boolean, changed boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  liveness interval := make_interval(secs => (select c.relay_liveness_s from public.app_config c));
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

  -- Riders gone for good (ten times the liveness) are let go
  delete from public.relay_sessions r
   where r.vehicle_id = relay_heartbeat.vehicle and r.last_seen < now() - liveness * 10;

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
