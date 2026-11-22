-- Admin action log (owner, 2026-11-22): every approve, reject, retire and driver PIN change is
-- recorded with who did it and when, so the research team can account for each admin action.
-- Triggers on the tables those actions change write it, so no console function changes and no path
-- (console, script, dashboard) is missed. The actor is the signed-in admin (auth.uid()); an action by
-- the service role or the SQL editor has none and shows as "system".
--
-- The log holds no personal data beyond what the console already shows: a registration's plate and
-- route, a driver ID (DRV-0000). No name, phone number, photo or PIN. Nothing is ever updated or
-- deleted in it; a row goes only with its actor's account (on delete set null keeps the action).
-- No existing row is changed.

create table public.admin_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   uuid references auth.users (id) on delete set null,
  action  text not null check (action in ('approve', 'reject', 'retire', 'pin_change')),
  target  text check (char_length(target) <= 80),
  detail  text check (char_length(detail) <= 200)
);

create index admin_log_at on public.admin_log (at desc);

alter table public.admin_log enable row level security;

revoke all on public.admin_log from anon, authenticated;
grant all on public.admin_log to service_role;
-- No policy on purpose: client roles are denied everything; the console reads it through
-- console_admin_log().

-- ---------------------------------------------------------------------------
-- The triggers
-- ---------------------------------------------------------------------------

-- A registration approved or rejected
create function public.log_registration_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('approved', 'rejected') and old.status = 'pending' then
    insert into public.admin_log (actor, action, target, detail)
    values (coalesce(new.decided_by, (select auth.uid())),
            case new.status when 'approved' then 'approve' else 'reject' end,
            new.plate || ' · ' || new.route_id,
            case when new.status = 'rejected' then left(new.reason, 200) else null end);
  end if;
  return new;
end;
$$;

create trigger driver_registrations_log_decision
after update of status on public.driver_registrations
for each row execute function public.log_registration_decision();

-- A driver phone retired
create function public.log_device_retired()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.active and not new.active then
    insert into public.admin_log (actor, action, target, detail)
    values ((select auth.uid()), 'retire', new.device_id, new.vehicle_id);
  end if;
  return new;
end;
$$;

create trigger driver_devices_log_retired
after update of active on public.driver_devices
for each row execute function public.log_device_retired();

-- The driver phones' admin PIN changed (only that it changed: never the PIN or its hash)
create function public.log_pin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.admin_pin_hash is distinct from old.admin_pin_hash then
    insert into public.admin_log (actor, action) values ((select auth.uid()), 'pin_change');
  end if;
  return new;
end;
$$;

create trigger driver_settings_log_pin
after update of admin_pin_hash on public.driver_settings
for each row execute function public.log_pin_change();

-- ---------------------------------------------------------------------------
-- The console's read: the newest entries, with the actor's account id (admins only; the console
-- shows its own account as "You")
-- ---------------------------------------------------------------------------
create function public.console_admin_log(max_rows integer)
returns table (at timestamptz, actor uuid, action text, target text, detail text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
  select l.at, l.actor, l.action, l.target, l.detail
  from public.admin_log l
  order by l.at desc
  limit least(greatest(max_rows, 1), 500);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Functions are executable by PUBLIC by default.
-- ---------------------------------------------------------------------------
revoke execute on function public.log_registration_decision() from public, anon, authenticated;
revoke execute on function public.log_device_retired() from public, anon, authenticated;
revoke execute on function public.log_pin_change() from public, anon, authenticated;
revoke execute on function public.console_admin_log(integer) from public, anon;
grant execute on function public.console_admin_log(integer) to authenticated;
