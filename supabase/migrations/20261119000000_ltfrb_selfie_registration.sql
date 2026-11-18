-- LTFRB selfie registration (owner, 2026-11-19; docs/DRIVER_CHANGES_PLAN.md, Part B). Multicabs are
-- PUVs under the LTFRB, not the city transport office. A registering driver now gives:
--   - the full name as written on the document;
--   - the document type: the old Driver's Academy ID, or the Driver's Academy certificate;
--   - a selfie holding that document, and the multicab photo, as before.
--
-- The selfie goes where the ID photo went (<check id>/id.jpg), so the bucket, its policies and the
-- upload links are unchanged, and both photos are still deleted at the decision (D1).
--
-- The admin fills a checklist (document, name, list, face, plate: pass, fail or na). The database
-- applies the approve rule of supabase/functions/_shared/registrationRules.ts canApprove, so the
-- console cannot skip it. The decision record keeps:
--   - the checks;
--   - the document type;
--   - who decided, and when.
-- It never keeps an image, or anything from the LTFRB list beyond its pass/fail result.
--
-- The name is kept only while the driver takes part. It is cleared when:
--   - the registration is rejected;
--   - it is replaced by a newer one;
--   - its approval expires;
--   - the driver phone is retired.
--
-- Migrations never drop: the new submit and decide are overloads, and PostgREST picks them by their
-- arguments. The old console_decide is closed to the console, so every decision now goes through the
-- checklist. The old registration_submit stays for the service role only, and the Edge Function no
-- longer calls it.

alter table public.driver_registrations
  add column full_name text check (char_length(full_name) between 2 and 80),
  add column document_type text check (document_type in ('academy_id', 'academy_certificate')),
  add column selfie_taken_at timestamptz,
  add column checks jsonb check (checks is null or jsonb_typeof(checks) = 'object');

-- ---------------------------------------------------------------------------
-- The checklist rule, in one place for console_decide. A list of exactly the five checks, each one
-- pass, fail or na.
-- ---------------------------------------------------------------------------
create function public.registration_checks_valid(review jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_typeof(review) = 'object'
     and (select count(*) from jsonb_object_keys(review)) = 5
     and (select bool_and(review ->> k in ('pass', 'fail', 'na'))
          from unnest(array['document', 'name', 'list', 'face', 'plate']) as k);
$$;

-- Approve needs document, name, list and plate to pass. Face must pass for the old ID and be na for
-- the certificate. A registration from before this change has no document type, so either one is
-- taken.
create function public.registration_can_approve(document text, review jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select public.registration_checks_valid(review)
     and review ->> 'document' = 'pass' and review ->> 'name' = 'pass'
     and review ->> 'list' = 'pass' and review ->> 'plate' = 'pass'
     and case document
           when 'academy_id' then review ->> 'face' = 'pass'
           when 'academy_certificate' then review ->> 'face' = 'na'
           else review ->> 'face' in ('pass', 'na')
         end;
$$;

-- ---------------------------------------------------------------------------
-- registration_submit with the name, the document type and the selfie time (null when the phone's
-- clock was far off: the Edge Function decides)
-- ---------------------------------------------------------------------------
create function public.registration_submit(
  check_ref uuid,
  plate text,
  route text,
  token_hash text,
  verified_within_min integer,
  driver_name text,
  document text,
  selfie_at timestamptz
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
  if driver_name is null or char_length(driver_name) not between 2 and 80 or driver_name <> btrim(driver_name) then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if document is null or document not in ('academy_id', 'academy_certificate') then raise exception 'invalid_document' using errcode = '22023'; end if;

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
  set status = 'expired', reason = 'replaced by a newer registration', full_name = null
  where r.phone_e164 = checked.phone_e164 and r.status in ('pending', 'approved');
  insert into public.driver_registrations
    (phone_e164, plate, route_id, vehicle_id, install_token_hash, id_photo_path, vehicle_photo_path, full_name, document_type, selfie_taken_at)
  values
    (checked.phone_e164, plate, route, route || '-' || replace(plate, ' ', ''), token_hash, id_path, vehicle_path, driver_name, document, selfie_at)
  returning registration_id into new_registration;
  return new_registration;
end;
$$;

-- An approval older than setup_ttl_days expires here (as before), and its name is cleared
create or replace function public.registration_status(token_hash text, setup_ttl_days integer)
returns table (status text, reason text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.driver_registrations r set status = 'expired', full_name = null
  where r.install_token_hash = token_hash and r.status = 'approved'
    and r.decided_at < now() - make_interval(days => setup_ttl_days);
  return query
  select r.status, r.reason from public.driver_registrations r where r.install_token_hash = token_hash;
end;
$$;

-- ---------------------------------------------------------------------------
-- The console's list, with the new fields. It is a new name because a function's columns cannot
-- change in place without a drop.
-- ---------------------------------------------------------------------------
create function public.console_registrations_ltfrb()
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
  active_device text,
  full_name text,
  document_type text,
  selfie_taken_at timestamptz,
  checks jsonb
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
          order by d.provisioned_at desc limit 1),
         r.full_name, r.document_type, r.selfie_taken_at, r.checks
  from public.driver_registrations r
  order by (r.status = 'pending') desc, r.created_at desc
  limit 200;
end;
$$;

-- ---------------------------------------------------------------------------
-- console_decide with the checklist. An approval must pass registration_can_approve. A rejection
-- needs at least one failed check and a reason, which the console builds from the failed checks. The
-- checks are kept on either outcome. As before, it returns the photo paths, which the console deletes
-- at once and then reports with console_photos_deleted.
-- ---------------------------------------------------------------------------
create function public.console_decide(registration uuid, approve boolean, review jsonb, decision_reason text, notice_ttl_min integer)
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
  if not public.registration_checks_valid(review) then raise exception 'invalid_checks' using errcode = '22023'; end if;
  select * into reg from public.driver_registrations r where r.registration_id = registration for update;
  if not found or reg.status <> 'pending' then raise exception 'not_pending'; end if;

  if approve then
    if not public.registration_can_approve(reg.document_type, review) then raise exception 'checks_not_passed' using errcode = '22023'; end if;
    update public.driver_registrations r
    set status = 'approved', checks = review, decided_by = (select auth.uid()), decided_at = now(),
        replaces_device = (select d.device_id from public.driver_devices d
                           join public.vehicles v on v.vehicle_id = d.vehicle_id
                           where d.active and replace(v.plate, ' ', '') = replace(reg.plate, ' ', '')
                           order by d.provisioned_at desc limit 1)
    where r.registration_id = registration;
    insert into public.sms_outbox (kind, to_e164, encoding, body_text, expires_at)
    values ('notice', reg.phone_e164, 'text', 'You''re approved. Open Tunton Driver while connected to the internet.',
            now() + make_interval(mins => notice_ttl_min));
  else
    if not exists (select 1 from jsonb_each_text(review) e where e.value = 'fail') then
      raise exception 'no_failed_check' using errcode = '22023';
    end if;
    if decision_reason is null or char_length(trim(decision_reason)) = 0 then raise exception 'reason_needed' using errcode = '22023'; end if;
    update public.driver_registrations r
    set status = 'rejected', reason = left(trim(decision_reason), 200), checks = review, full_name = null,
        decided_by = (select auth.uid()), decided_at = now()
    where r.registration_id = registration;
  end if;
  return query select reg.id_photo_path, reg.vehicle_photo_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retiring a driver phone also clears the name on its registration. Otherwise the function is as in
-- 20261013000000_driver_side.sql (same arguments, replaced in place).
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

  if new_beacon_secret is not null then
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
-- Grants. Functions are executable by PUBLIC by default.
-- ---------------------------------------------------------------------------
revoke execute on function public.registration_checks_valid(jsonb) from public, anon, authenticated;
revoke execute on function public.registration_can_approve(text, jsonb) from public, anon, authenticated;
revoke execute on function public.registration_submit(uuid, text, text, text, integer, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.console_registrations_ltfrb() from public, anon;
revoke execute on function public.console_decide(uuid, boolean, jsonb, text, integer) from public, anon;
-- Every decision now goes through the checklist
revoke execute on function public.console_decide(uuid, boolean, text, integer) from authenticated;

grant execute on function public.registration_submit(uuid, text, text, text, integer, text, text, timestamptz) to service_role;
grant execute on function public.console_registrations_ltfrb() to authenticated;
grant execute on function public.console_decide(uuid, boolean, jsonb, text, integer) to authenticated;
