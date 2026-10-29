-- DRG2: driver self-registration with admin approval (PRD 9.5, 12.2;
-- docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md, owner decisions D1 to D6).
--
-- A driver registers in the driver app through the Edge Functions of DRG3, which use the service role
-- and the registration_* functions below: a number check (one SMS the app reads by itself), then the
-- plate, route, install token hash and two photos. The admin console signs in with the one admin
-- account (D4) and uses the console_* functions, each of which checks is_admin(). When the driver
-- opens the app after approval, registration_collect makes the secrets and provisions the phone with
-- the DR3 function admin_provision_driver, in one transaction, so no secret waits in storage.
--
-- Tables are server-only (no client grant, no policy), like the DR3 tables. The photos sit in a
-- private storage bucket that only the admin account may read and delete; they are deleted at the
-- decision (D1). Limits come from src/shared/config and are passed in by the callers, as the worker does.

-- ---------------------------------------------------------------------------
-- admin_accounts: who may use the admin console (D4: one account for now; more are added the same
-- way, by inserting a row in the SQL Editor)
-- ---------------------------------------------------------------------------
create table public.admin_accounts (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  added_at  timestamptz not null default now()
);
alter table public.admin_accounts enable row level security;
revoke all on public.admin_accounts from anon, authenticated;
grant all on public.admin_accounts to service_role;
-- No policy on purpose: client roles are denied everything.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_accounts a where a.user_id = (select auth.uid()));
$$;
-- ---------------------------------------------------------------------------
-- driver_settings: one row. The admin PIN of every pilot driver phone (D5), as the salted SHA-256
-- the setup payload carries (src/shared/driver/provisioning.ts hashAdminPin); the PIN itself is
-- never stored.
-- ---------------------------------------------------------------------------
create table public.driver_settings (
  id              boolean primary key default true check (id),
  admin_pin_hash  text check (admin_pin_hash ~ '^[0-9a-f]{64}$'),
  admin_pin_salt  text check (admin_pin_salt ~ '^[0-9a-f]{32}$'),
  updated_at      timestamptz not null default now()
);
insert into public.driver_settings (id) values (true);
alter table public.driver_settings enable row level security;
revoke all on public.driver_settings from anon, authenticated;
grant all on public.driver_settings to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- registration_checks: the number checks (PRD 9.5 step 2). The code goes to the number by SMS and
-- the app sends it back; a few wrong tries void it.
-- ---------------------------------------------------------------------------
create table public.registration_checks (
  check_id     uuid primary key default gen_random_uuid(),
  phone_e164   text not null check (phone_e164 ~ '^\+639[0-9]{9}$'),
  code         text not null check (code ~ '^[0-9]{6}$'),
  tries        smallint not null default 0,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  verified_at  timestamptz,
  used_at      timestamptz
);
create index registration_checks_phone_idx on public.registration_checks (phone_e164, created_at);
create index registration_checks_created_idx on public.registration_checks (created_at);
alter table public.registration_checks enable row level security;
revoke all on public.registration_checks from anon, authenticated;
grant all on public.registration_checks to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- driver_registrations (PRD 12.2). The photo paths are cleared when the photos are deleted, at the
-- decision; the row keeps who decided, when and the outcome.
-- ---------------------------------------------------------------------------
create table public.driver_registrations (
  registration_id     uuid primary key default gen_random_uuid(),
  phone_e164          text not null check (phone_e164 ~ '^\+639[0-9]{9}$'),
  plate               text not null check (plate ~ '^[A-Z0-9]+( [A-Z0-9]+)*$' and char_length(plate) <= 16),
  route_id            text not null check (route_id ~ '^R[1-9][0-9]?$'),
  vehicle_id          text not null check (vehicle_id ~ '^[A-Z0-9][A-Z0-9-]{0,23}$'),
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'collected', 'expired')),
  reason              text check (char_length(reason) <= 200),
  install_token_hash  text not null unique check (install_token_hash ~ '^[0-9a-f]{64}$'),
  id_photo_path       text check (char_length(id_photo_path) <= 200),
  vehicle_photo_path  text check (char_length(vehicle_photo_path) <= 200),
  replaces_device     text references public.driver_devices (device_id),
  device_id           text references public.driver_devices (device_id),
  created_at          timestamptz not null default now(),
  decided_by          uuid references auth.users (id) on delete set null,
  decided_at          timestamptz,
  collected_at        timestamptz,
  photos_deleted_at   timestamptz
);
create index driver_registrations_status_idx on public.driver_registrations (status, created_at);
create index driver_registrations_phone_idx on public.driver_registrations (phone_e164);
alter table public.driver_registrations enable row level security;
revoke all on public.driver_registrations from anon, authenticated;
grant all on public.driver_registrations to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- sms_outbox: a row may now go to a number that is not a driver phone yet (the number check and the
-- "approved" notice). Heatmap rows are unchanged: a driver phone, a route and a sequence number.
-- ---------------------------------------------------------------------------
alter table public.sms_outbox add column kind text not null default 'heatmap' check (kind in ('heatmap', 'check', 'notice'));
alter table public.sms_outbox add column to_e164 text check (to_e164 ~ '^\+639[0-9]{9}$');
alter table public.sms_outbox alter column device_id drop not null;
alter table public.sms_outbox alter column route_id drop not null;
alter table public.sms_outbox alter column seq drop not null;
alter table public.sms_outbox add constraint sms_outbox_addressee check (
  (kind = 'heatmap' and device_id is not null and route_id is not null and seq is not null and to_e164 is null)
  or (kind <> 'heatmap' and to_e164 is not null and device_id is null and route_id is null and seq is null)
);
-- The gateway takes up to max_rows messages, oldest first (DR3, unchanged), now also those addressed
-- to a number: a heatmap row goes to its active driver phone, any other row to its own number.
create or replace function public.worker_claim(gateway text, max_rows integer, lease_s integer, max_attempts integer)
returns table (id bigint, to_e164 text, encoding text, body_text text, body_b64 text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.gateways g where g.gateway_id = gateway and g.active) then
    raise exception 'unknown or inactive gateway' using errcode = '42501';
  end if;
  update public.sms_outbox o
  set status = case when o.attempts >= max_attempts then 'failed' else 'queued' end,
      error = coalesce(o.error, 'lease expired'),
      claimed_at = null
  where o.status = 'claimed' and o.claimed_at < now() - make_interval(secs => lease_s);
  update public.sms_outbox o set status = 'expired' where o.status = 'queued' and o.expires_at <= now();

  return query
  with picked as (
    select o.id, coalesce(o.to_e164, d.phone_e164) as addressee
    from public.sms_outbox o
    left join public.driver_devices d on d.device_id = o.device_id
    where o.status = 'queued' and (o.device_id is null or d.active)
    order by o.created_at, o.id
    limit max_rows
    for update of o skip locked
  )
  update public.sms_outbox o
  set status = 'claimed', claimed_at = now(), gateway_id = gateway, attempts = o.attempts + 1
  from picked p
  where o.id = p.id
  returning o.id, p.addressee, o.encoding, o.body_text, o.body_b64;
end;
$$;
-- ---------------------------------------------------------------------------
-- Storage: the private bucket for the photos (JPEG only, 1 MB at most: REGISTRATION_PHOTO_MAX_BYTES).
-- Uploads use short-lived upload links made by the Edge Functions with the service role; only the
-- admin account may read and delete.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('driver-registrations', 'driver-registrations', false, 1000000, array['image/jpeg'])
on conflict (id) do nothing;
create policy "driver-registrations: the admin reads" on storage.objects
  for select to authenticated using (bucket_id = 'driver-registrations' and (select public.is_admin()));
create policy "driver-registrations: the admin deletes" on storage.objects
  for delete to authenticated using (bucket_id = 'driver-registrations' and (select public.is_admin()));
-- ---------------------------------------------------------------------------
-- Registration functions (DRG3's Edge Functions, service role). Errors carry a short reason as the
-- message, which the functions turn into the app's wording.
-- ---------------------------------------------------------------------------

-- Starts a number check: refuses by the shared rule checkAllowed (src/shared/driver/registration.ts:
-- per_day checks in total and per_number per number per Manila day, resend_min between two to the
-- same number), records the code, and queues its SMS. The SMS expires after sms_ttl_min (0 queues
-- nothing the gateway would send: the live tests use it).
create function public.registration_check_start(
  phone text,
  code text,
  encoding text,
  body_text text,
  body_b64 text,
  ttl_min integer,
  sms_ttl_min integer,
  resend_min integer,
  per_number integer,
  per_day integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  new_check uuid;
begin
  if phone !~ '^\+639[0-9]{9}$' then raise exception 'invalid_number' using errcode = '22023'; end if;
  if code !~ '^[0-9]{6}$' then raise exception 'code must be 6 digits' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('registration_check_start'));

  if (select count(*) from public.registration_checks c where (c.created_at at time zone 'Asia/Manila')::date = today) >= per_day then
    raise exception 'daily_limit';
  end if;
  if (select count(*) from public.registration_checks c
      where c.phone_e164 = phone and (c.created_at at time zone 'Asia/Manila')::date = today) >= per_number then
    raise exception 'number_limit';
  end if;
  if exists (select 1 from public.registration_checks c
             where c.phone_e164 = phone and c.created_at > now() - make_interval(mins => resend_min)) then
    raise exception 'too_soon';
  end if;

  insert into public.registration_checks (phone_e164, code, expires_at)
  values (phone, code, now() + make_interval(mins => ttl_min))
  returning check_id into new_check;
  insert into public.sms_outbox (kind, to_e164, encoding, body_text, body_b64, expires_at)
  values ('check', phone, encoding, body_text, body_b64, now() + make_interval(mins => sms_ttl_min));
  return new_check;
end;
$$;
-- Checks a code against the number's newest open check. Returns the check id on a match, or null
-- (no open check, too many wrong tries, or a wrong code, which counts as a try).
create function public.registration_check_verify(phone text, code text, max_tries integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  open_check public.registration_checks%rowtype;
begin
  select * into open_check from public.registration_checks c
  where c.phone_e164 = phone and c.verified_at is null and c.expires_at > now()
  order by c.created_at desc limit 1
  for update;
  if not found or open_check.tries >= max_tries then return null; end if;
  if open_check.code <> registration_check_verify.code then
    update public.registration_checks c set tries = c.tries + 1 where c.check_id = open_check.check_id;
    return null;
  end if;
  update public.registration_checks c set verified_at = now() where c.check_id = open_check.check_id;
  return open_check.check_id;
end;
$$;
-- Makes a pending registration from a verified, unused check (verified within verified_within_min).
-- The photos must already be in the bucket under the check's own folder. A newer registration from
-- the same number expires an older one that is still pending or approved.
create function public.registration_submit(
  check_ref uuid,
  plate text,
  route text,
  token_hash text,
  verified_within_min integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked public.registration_checks%rowtype;
  id_path text := check_ref::text || '/id.jpg';
  vehicle_path text := check_ref::text || '/vehicle.jpg';
  new_registration uuid;
begin
  if plate !~ '^[A-Z0-9]+( [A-Z0-9]+)*$' or char_length(plate) > 16 then raise exception 'invalid_plate' using errcode = '22023'; end if;
  if route !~ '^R[1-9][0-9]?$' then raise exception 'invalid_route' using errcode = '22023'; end if;
  if token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_token' using errcode = '22023'; end if;

  select * into checked from public.registration_checks c where c.check_id = check_ref for update;
  if not found or checked.verified_at is null or checked.used_at is not null
     or checked.verified_at < now() - make_interval(mins => verified_within_min) then
    raise exception 'check_not_verified';
  end if;
  if (select count(*) from storage.objects s
      where s.bucket_id = 'driver-registrations' and s.name in (id_path, vehicle_path)) <> 2 then
    raise exception 'photos_missing';
  end if;

  update public.registration_checks c set used_at = now() where c.check_id = check_ref;
  update public.driver_registrations r
  set status = 'expired', reason = 'replaced by a newer registration'
  where r.phone_e164 = checked.phone_e164 and r.status in ('pending', 'approved');
  insert into public.driver_registrations (phone_e164, plate, route_id, vehicle_id, install_token_hash, id_photo_path, vehicle_photo_path)
  values (checked.phone_e164, plate, route, route || '-' || replace(plate, ' ', ''), token_hash, id_path, vehicle_path)
  returning registration_id into new_registration;
  return new_registration;
end;
$$;
-- The status the app shows, for its install token; an approval older than setup_ttl_days expires here
create function public.registration_status(token_hash text, setup_ttl_days integer)
returns table (status text, reason text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.driver_registrations r set status = 'expired'
  where r.install_token_hash = token_hash and r.status = 'approved'
    and r.decided_at < now() - make_interval(days => setup_ttl_days);
  return query
  select r.status, r.reason from public.driver_registrations r where r.install_token_hash = token_hash;
end;
$$;
-- Collects an approved setup, once: retires every active phone on the same plate, makes the vehicle's
-- beacon secret and the phone's SMS key, provisions the phone (admin_provision_driver), and returns
-- what the setup payload needs. Refuses with not_approved, expired or pin_not_set.
create function public.registration_collect(token_hash text, setup_ttl_days integer)
returns table (
  device_id text,
  vehicle_id text,
  short_id integer,
  route_id text,
  plate text,
  gateway_numbers text[],
  beacon_secret text,
  sms_key text,
  admin_pin_hash text,
  admin_pin_salt text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  reg public.driver_registrations%rowtype;
  settings public.driver_settings%rowtype;
  old_device text;
  beacon text := encode(extensions.gen_random_bytes(32), 'hex');
  sms_secret text := encode(extensions.gen_random_bytes(32), 'hex');
  made record;
begin
  select * into reg from public.driver_registrations r where r.install_token_hash = token_hash for update;
  if not found or reg.status <> 'approved' then raise exception 'not_approved'; end if;
  if reg.decided_at < now() - make_interval(days => setup_ttl_days) then
    update public.driver_registrations r set status = 'expired' where r.registration_id = reg.registration_id;
    return;
  end if;
  select * into settings from public.driver_settings s where s.id;
  if settings.admin_pin_hash is null or settings.admin_pin_salt is null then raise exception 'pin_not_set'; end if;

  for old_device in
    select d.device_id from public.driver_devices d
    join public.vehicles v on v.vehicle_id = d.vehicle_id
    where d.active and replace(v.plate, ' ', '') = replace(reg.plate, ' ', '')
  loop
    perform public.admin_retire_device(old_device, encode(extensions.gen_random_bytes(32), 'hex'));
  end loop;

  select * into made from public.admin_provision_driver(
    reg.vehicle_id, reg.plate, reg.route_id, reg.phone_e164, null, beacon, sms_secret, 'registration ' || reg.registration_id::text
  );
  update public.driver_registrations r
  set status = 'collected', collected_at = now(), device_id = made.device_id
  where r.registration_id = reg.registration_id;

  return query
  select made.device_id, reg.vehicle_id, made.short_id, reg.route_id, reg.plate, made.gateway_numbers,
         beacon, sms_secret, settings.admin_pin_hash, settings.admin_pin_salt;
end;
$$;
-- ---------------------------------------------------------------------------
-- Admin console functions (D3, D4): signed-in callers, and each one checks is_admin() first
-- ---------------------------------------------------------------------------

-- Registrations, pending first then newest, with the active phone already on the same plate (the
-- console's warning)
create function public.console_registrations()
returns table (
  registration_id uuid,
  status text,
  phone_e164 text,
  plate text,
  route_id text,
  vehicle_id text,
  reason text,
  id_photo_path text,
  vehicle_photo_path text,
  created_at timestamptz,
  decided_at timestamptz,
  active_device text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
  select r.registration_id, r.status, r.phone_e164, r.plate, r.route_id, r.vehicle_id, r.reason,
         r.id_photo_path, r.vehicle_photo_path, r.created_at, r.decided_at,
         (select d.device_id from public.driver_devices d
          join public.vehicles v on v.vehicle_id = d.vehicle_id
          where d.active and replace(v.plate, ' ', '') = replace(r.plate, ' ', '')
          order by d.provisioned_at desc limit 1)
  from public.driver_registrations r
  order by (r.status = 'pending') desc, r.created_at desc
  limit 200;
end;
$$;
-- Approves or rejects a pending registration (a rejection needs a reason the driver sees). An
-- approval queues the "approved" text (PRD 9.5), which expires after notice_ttl_min. Returns the photo
-- paths, which the console deletes from the bucket at once (D1) and then reports with
-- console_photos_deleted.
create function public.console_decide(registration uuid, approve boolean, decision_reason text, notice_ttl_min integer)
returns table (id_photo_path text, vehicle_photo_path text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  reg public.driver_registrations%rowtype;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select * into reg from public.driver_registrations r where r.registration_id = registration for update;
  if not found or reg.status <> 'pending' then raise exception 'not_pending'; end if;

  if approve then
    update public.driver_registrations r
    set status = 'approved', decided_by = (select auth.uid()), decided_at = now(),
        replaces_device = (select d.device_id from public.driver_devices d
                           join public.vehicles v on v.vehicle_id = d.vehicle_id
                           where d.active and replace(v.plate, ' ', '') = replace(reg.plate, ' ', '')
                           order by d.provisioned_at desc limit 1)
    where r.registration_id = registration;
    insert into public.sms_outbox (kind, to_e164, encoding, body_text, expires_at)
    values ('notice', reg.phone_e164, 'text', 'You''re approved. Open Tunton Driver while connected to the internet.',
            now() + make_interval(mins => notice_ttl_min));
  else
    if decision_reason is null or char_length(trim(decision_reason)) = 0 then raise exception 'reason_needed' using errcode = '22023'; end if;
    update public.driver_registrations r
    set status = 'rejected', reason = left(trim(decision_reason), 200), decided_by = (select auth.uid()), decided_at = now()
    where r.registration_id = registration;
  end if;
  return query select reg.id_photo_path, reg.vehicle_photo_path;
end;
$$;
-- Records that a decided (or replaced) registration's photos are gone from the bucket
create function public.console_photos_deleted(registration uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  update public.driver_registrations r
  set id_photo_path = null, vehicle_photo_path = null, photos_deleted_at = now()
  where r.registration_id = registration and r.status <> 'pending';
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;
-- The active driver phones
create function public.console_drivers()
returns table (device_id text, vehicle_id text, plate text, route_id text, phone_e164 text, provisioned_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
  select d.device_id, d.vehicle_id, v.plate, v.route_id, d.phone_e164, d.provisioned_at
  from public.driver_devices d
  join public.vehicles v on v.vehicle_id = d.vehicle_id
  where d.active
  order by d.device_id;
end;
$$;
-- Retires a driver phone and gives its vehicle a new beacon secret nobody holds (as retire-device.ts)
create function public.console_retire(device text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return public.admin_retire_device(device, encode(extensions.gen_random_bytes(32), 'hex'));
end;
$$;
-- Sets the admin PIN of the pilot driver phones (D5), given as the salted hash
create function public.console_set_pin(pin_hash text, pin_salt text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if pin_hash !~ '^[0-9a-f]{64}$' or pin_salt !~ '^[0-9a-f]{32}$' then raise exception 'invalid_pin' using errcode = '22023'; end if;
  update public.driver_settings s set admin_pin_hash = pin_hash, admin_pin_salt = pin_salt, updated_at = now() where s.id;
end;
$$;
-- Whether the admin PIN is set, for the console's settings page
create function public.console_pin_is_set()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return exists (select 1 from public.driver_settings s where s.id and s.admin_pin_hash is not null);
end;
$$;
-- ---------------------------------------------------------------------------
-- Grants. Functions are executable by PUBLIC by default.
-- ---------------------------------------------------------------------------
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.worker_claim(text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.registration_check_start(text, text, text, text, text, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.registration_check_verify(text, text, integer) from public, anon, authenticated;
revoke execute on function public.registration_submit(uuid, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.registration_status(text, integer) from public, anon, authenticated;
revoke execute on function public.registration_collect(text, integer) from public, anon, authenticated;
revoke execute on function public.console_registrations() from public, anon;
revoke execute on function public.console_decide(uuid, boolean, text, integer) from public, anon;
revoke execute on function public.console_photos_deleted(uuid) from public, anon;
revoke execute on function public.console_drivers() from public, anon;
revoke execute on function public.console_retire(text) from public, anon;
revoke execute on function public.console_set_pin(text, text) from public, anon;
revoke execute on function public.console_pin_is_set() from public, anon;
-- is_admin is used by the storage policies, so signed-in users may run it (it only answers for themselves)
grant execute on function public.is_admin() to authenticated;
grant execute on function public.worker_claim(text, integer, integer, integer) to service_role;
grant execute on function public.registration_check_start(text, text, text, text, text, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.registration_check_verify(text, text, integer) to service_role;
grant execute on function public.registration_submit(uuid, text, text, text, integer) to service_role;
grant execute on function public.registration_status(text, integer) to service_role;
grant execute on function public.registration_collect(text, integer) to service_role;
grant execute on function public.console_registrations() to authenticated;
grant execute on function public.console_decide(uuid, boolean, text, integer) to authenticated;
grant execute on function public.console_photos_deleted(uuid) to authenticated;
grant execute on function public.console_drivers() to authenticated;
grant execute on function public.console_retire(text) to authenticated;
grant execute on function public.console_set_pin(text, text) to authenticated;
grant execute on function public.console_pin_is_set() to authenticated;
