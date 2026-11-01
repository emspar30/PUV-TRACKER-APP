-- BT1 (PRD 8.3, 0.2 S8; 2026-11-02): Primary and Secondary relay riders, the "baton". Several team
-- riders relaying the same multicab on the live map: only the Primary's positions move its marker; the
-- others are Secondary (backup) and send none. The Primary is kept while it heartbeats; one silent for
-- relay_liveness_s is replaced by the best live rider: eligible first (battery 30% or more, not in
-- battery saver, location on), then riders who kept their drop-off since joining, then the most
-- distance left along the line to their drop-off, then who joined first. The drop-off itself stays on
-- the phone (PRD 19): the phone sends only the distance left and whether it changed. Promotion happens on
-- any rider's heartbeat (riders heartbeat every 30 s), so a handoff takes at most liveness + 30 s.
-- The same rule is in src/shared/relay/baton.ts (tested there).

alter table public.app_config add column relay_liveness_s smallint not null default 90;

create table public.relay_sessions (
  vehicle_id    text not null references public.vehicles (vehicle_id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  left_m        real not null check (left_m >= 0),
  eligible      boolean not null,
  -- The rider changed their drop-off after joining: to the back of the queue
  moved_back    boolean not null default false,
  role          text not null default 'secondary' check (role in ('primary', 'secondary')),
  joined_at     timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);
alter table public.relay_sessions enable row level security;
revoke all on public.relay_sessions from anon, authenticated;
grant all on public.relay_sessions to service_role;

-- A rider's heartbeat: joins or updates their row, promotes a new Primary when the current one went
-- silent, and answers the rider's role. Team accounts only, like the live map.
create function public.relay_heartbeat(vehicle text, left_m real, eligible boolean, changed boolean)
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
  if not public.is_team_account() then raise exception 'team accounts only' using errcode = '42501'; end if;
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

-- The rider's relay ended: they leave the queue at once
create function public.relay_leave(vehicle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from public.relay_sessions r where r.vehicle_id = relay_leave.vehicle and r.user_id = uid;
end;
$$;

-- For the ingest function: the multicab's live Primary, or null when it has none (then any team
-- rider's positions move the marker, as before BT1)
create function public.relay_primary(vehicle text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id
    from public.relay_sessions r
   where r.vehicle_id = relay_primary.vehicle
     and r.role = 'primary'
     and r.last_seen > now() - make_interval(secs => (select c.relay_liveness_s from public.app_config c))
   limit 1;
$$;

revoke execute on function public.relay_heartbeat(text, real, boolean, boolean) from public, anon;
grant execute on function public.relay_heartbeat(text, real, boolean, boolean) to authenticated;
revoke execute on function public.relay_leave(text) from public, anon;
grant execute on function public.relay_leave(text) to authenticated;
revoke execute on function public.relay_primary(text) from public, anon, authenticated;
grant execute on function public.relay_primary(text) to service_role;
