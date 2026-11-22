-- A plain Approve or Reject for driver registrations (owner, 2026-11-23): the five Pass, Fail or N/A
-- checks of 20261119000000_ltfrb_selfie_registration.sql are no longer asked. The admin still looks at
-- the selfie with the LTFRB document, the plate photo and the typed name and plate, and checks the
-- LTFRB list outside the console, then approves, or rejects with a reason the driver sees.
--
-- console_decide as in that migration, replaced in place with the same arguments: review may be null
-- (the console sends null); if one is sent it must still be well formed, and it is kept. Approve needs
-- no checks; Reject needs a reason. Registrations decided before keep their checks. No row is changed.

create or replace function public.console_decide(registration uuid, approve boolean, review jsonb, decision_reason text, notice_ttl_min integer)
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
  if review is not null and not public.registration_checks_valid(review) then raise exception 'invalid_checks' using errcode = '22023'; end if;
  select * into reg from public.driver_registrations r where r.registration_id = registration for update;
  if not found or reg.status <> 'pending' then raise exception 'not_pending'; end if;

  if approve then
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
    if decision_reason is null or char_length(trim(decision_reason)) = 0 then raise exception 'reason_needed' using errcode = '22023'; end if;
    update public.driver_registrations r
    set status = 'rejected', reason = left(trim(decision_reason), 200), checks = review, full_name = null,
        decided_by = (select auth.uid()), decided_at = now()
    where r.registration_id = registration;
  end if;
  return query select reg.id_photo_path, reg.vehicle_photo_path;
end;
$$;

revoke execute on function public.console_decide(uuid, boolean, jsonb, text, integer) from public, anon;
grant execute on function public.console_decide(uuid, boolean, jsonb, text, integer) to authenticated;
