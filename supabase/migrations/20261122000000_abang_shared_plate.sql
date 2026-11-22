-- Abang: one multicab (one plate) driven by 2 or 3 drivers, each with their own driver ID (DRV-0000)
-- and phone (owner, 2026-11-19 and 2026-11-22; docs/DRIVER_CHANGES_PLAN.md Part A,
-- docs/APP_CHANGES_PLAN.md Phase 3). No existing row is changed or deleted.
--
-- The drivers of one multicab share its vehicle (route and plate) and so its beacon: the beacon
-- belongs to the vehicle (vehicle_beacons), relays and markers are keyed by vehicle_id, so one
-- multicab never shows as two markers, whoever's phone is on.
--
-- 1. One active phone per phone number, instead of one active phone per vehicle. Dropping the old
--    index removes a rule, not data (the only drop in the migrations; a test allows exactly this one).
-- 2. admin_provision_driver: a vehicle may have several active phones. A phone number that is already
--    active is refused. While another phone of the vehicle is active, its beacon secret is kept, and
--    a different secret is refused (the caller must give that phone the vehicle's secret).
-- 3. registration_collect: "Set up again" retires the same number's active phone only, no longer
--    every phone on the plate; a vehicle with an active driver hands the new phone its secret.
-- 4. admin_retire_device (and so console_retire): retiring one driver replaces the vehicle's beacon
--    secret only when no other phone of that vehicle stays active (owner decision Q1, 2026-11-19).
--    A lost phone that is retired while another driver is on keeps valid codes until the retire
--    notice reaches it (which stops its beacon), or until the last driver of the multicab is retired.
--
-- Not built (owner, 2026-11-19 and 2026-11-22): a "take over this unit" step. After setup the driver
-- app has no internet link to Tunton, so the server cannot know whose beacon is on. The SMS worker
-- keeps sending a route's waiting counts to every active phone on it (worker_devices), so each abang
-- driver of a multicab gets them; this counts against the gateway's daily SMS cap.
--
-- Before applying: no number may be active twice, or step 1 fails. Check with
--   select phone_e164, count(*) from public.driver_devices where active group by 1 having count(*) > 1;

-- ---------------------------------------------------------------------------
-- 1. The index
-- ---------------------------------------------------------------------------
drop index if exists public.driver_devices_one_active_per_vehicle;
create unique index driver_devices_one_active_per_phone on public.driver_devices (phone_e164) where active;

-- ---------------------------------------------------------------------------
-- 2. Provisioning a driver phone. Same arguments as in 20261013000000_driver_side.sql, replaced in
-- place (migrations never drop a function).
-- ---------------------------------------------------------------------------
create or replace function public.admin_provision_driver(
  vehicle text,
  plate text,
  route text,
  phone text,
  wanted_short_id integer,
  beacon_secret text,
  sms_key text,
  note text
)
returns table (device_id text, short_id integer, gateway_numbers text[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  new_device text;
  sid integer;
  beacon_id uuid;
  sms_secret_id uuid;
  existing text;
  shared boolean;
  stored text;
begin
  if beacon_secret !~ '^[0-9a-f]{64}$' or sms_key !~ '^[0-9a-f]{64}$' then
    raise exception 'secrets must be 64 lower-case hex characters' using errcode = '22023';
  end if;
  if phone !~ '^\+639[0-9]{9}$' then raise exception 'phone must be +639 and 9 digits' using errcode = '22023'; end if;
  if route !~ '^R[0-9]{1,2}$' then raise exception 'route must be like R4' using errcode = '22023'; end if;
  if char_length(trim(plate)) = 0 or char_length(plate) > 16 then raise exception 'plate must be 1 to 16 characters' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('admin_provision_driver'));

  select d.device_id into existing from public.driver_devices d where d.phone_e164 = phone and d.active;
  if found then
    raise exception 'phone % already has active device %; retire it first', phone, existing using errcode = '23505';
  end if;
  shared := exists (select 1 from public.driver_devices d where d.vehicle_id = vehicle and d.active);

  insert into public.vehicles (vehicle_id, plate, route_id, active) values (vehicle, plate, route, true)
  on conflict (vehicle_id) do update set plate = excluded.plate, route_id = excluded.route_id, active = true;

  select b.short_id, b.secret_id into sid, beacon_id from public.vehicle_beacons b where b.vehicle_id = vehicle;
  if found then
    if wanted_short_id is not null and wanted_short_id <> sid then
      raise exception 'vehicle % already has short id %', vehicle, sid using errcode = '23505';
    end if;
    if shared then
      -- Another driver of this multicab is on: its beacon keeps working, so the secret stays
      select s.decrypted_secret into stored from vault.decrypted_secrets s where s.id = beacon_id;
      if stored is distinct from beacon_secret then
        raise exception 'vehicle % is shared: give the new phone its beacon secret', vehicle using errcode = '22023';
      end if;
    else
      perform vault.update_secret(beacon_id, beacon_secret);
      update public.vehicle_beacons b set rotated_at = now() where b.vehicle_id = vehicle;
    end if;
  else
    sid := coalesce(wanted_short_id, (select coalesce(max(b.short_id), 0) + 1 from public.vehicle_beacons b));
    beacon_id := public.vault_put('beacon-' || vehicle, beacon_secret, 'Beacon secret of vehicle ' || vehicle);
    insert into public.vehicle_beacons (vehicle_id, short_id, secret_id) values (vehicle, sid, beacon_id);
  end if;

  new_device := 'DRV-' || lpad(((select coalesce(max(substr(d.device_id, 5)::integer), 0) from public.driver_devices d) + 1)::text, 4, '0');
  sms_secret_id := public.vault_put('sms-key-' || new_device, sms_key, 'Heatmap SMS key of driver phone ' || new_device);
  insert into public.driver_devices (device_id, vehicle_id, phone_e164, sms_key_id, note) values (new_device, vehicle, phone, sms_secret_id, note);

  return query
  select new_device, sid,
         coalesce((select array_agg(g.phone_e164 order by g.gateway_id) from public.gateways g where g.active and g.phone_e164 is not null), '{}'::text[]);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Retiring one driver phone. As in 20261119000000_ltfrb_selfie_registration.sql (which clears the
-- name), except that the vehicle's beacon secret is replaced only when no other phone of the vehicle
-- stays active. Same arguments, replaced in place.
-- ---------------------------------------------------------------------------
create or replace function public.admin_retire_device(device text, new_beacon_secret text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  vehicle text;
  sms_secret_id uuid;
  beacon_id uuid;
begin
  if new_beacon_secret is not null and new_beacon_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'secrets must be 64 lower-case hex characters' using errcode = '22023';
  end if;
  select d.vehicle_id, d.sms_key_id into vehicle, sms_secret_id from public.driver_devices d where d.device_id = device and d.active for update;
  if not found then return false; end if;

  update public.driver_devices d set active = false, retired_at = now() where d.device_id = device;
  update public.sms_outbox o set status = 'expired', error = 'device retired' where o.device_id = device and o.status in ('queued', 'claimed');
  perform vault.update_secret(sms_secret_id, 'retired ' || gen_random_uuid()::text);
  update public.driver_registrations r set full_name = null where r.device_id = device;

  -- Abang: the other drivers of this multicab keep its beacon working
  if new_beacon_secret is not null
     and not exists (select 1 from public.driver_devices d where d.vehicle_id = vehicle and d.active) then
    select b.secret_id into beacon_id from public.vehicle_beacons b where b.vehicle_id = vehicle;
    if found then
      perform vault.update_secret(beacon_id, new_beacon_secret);
      update public.vehicle_beacons b set rotated_at = now() where b.vehicle_id = vehicle;
    end if;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Collecting an approved setup. As in 20261027000000_driver_registration.sql, except: only the
-- same number's active phone is retired (Set up again), and a multicab with an active driver hands
-- the new phone its beacon secret instead of a new one. Same arguments, replaced in place.
-- ---------------------------------------------------------------------------
create or replace function public.registration_collect(token_hash text, setup_ttl_days integer)
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
  stored text;
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

  -- Set up again: this number's own phone is retired; other drivers of the multicab stay
  for old_device in
    select d.device_id from public.driver_devices d where d.active and d.phone_e164 = reg.phone_e164
  loop
    perform public.admin_retire_device(old_device, encode(extensions.gen_random_bytes(32), 'hex'));
  end loop;

  -- Abang: a multicab with an active driver keeps its beacon secret
  if exists (select 1 from public.driver_devices d where d.vehicle_id = reg.vehicle_id and d.active) then
    select s.decrypted_secret into stored
    from public.vehicle_beacons b join vault.decrypted_secrets s on s.id = b.secret_id
    where b.vehicle_id = reg.vehicle_id;
    if stored is not null then beacon := stored; end if;
  end if;

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
-- Grants: unchanged by create or replace, repeated so this file stands on its own
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_provision_driver(text, text, text, text, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_retire_device(text, text) from public, anon, authenticated;
revoke execute on function public.registration_collect(text, integer) from public, anon, authenticated;
grant execute on function public.admin_provision_driver(text, text, text, text, integer, text, text, text) to service_role;
grant execute on function public.admin_retire_device(text, text) to service_role;
grant execute on function public.registration_collect(text, integer) to service_role;
