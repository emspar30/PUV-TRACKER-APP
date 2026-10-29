-- A retired driver phone is told so (owner, 2026-10-28). When the admin console retires a phone,
-- console_retire first queues one text to that phone: a retire notice signed with the phone's own SMS
-- key, which the driver app shows as "This phone was removed from Tunton" (and stops its beacon). Then
-- it retires the phone as before (admin_retire_device), which wipes that key, so the notice must be
-- signed here, in the same transaction.
--
-- The text is HM2|RETIRED|<device id>|<mac>, mac being the first 4 bytes of HMAC-SHA256 over
-- everything before the last pipe, upper-case hex, keyed with the key's text (as the phone does:
-- src/shared/sms/protocol.ts signRetiredNotice; a test checks pgcrypto gives the same). It goes out as
-- a "notice" row to the phone's number, so the gateway sends it like the "approved" text; it expires
-- unsent after notice_ttl_min (the live tests pass 0).
--
-- Migrations never drop (src/shared/__tests__/migration.test.ts), so this is a second console_retire,
-- with the notice's lifetime; PostgREST picks it by its arguments. The first one (no notice) stays but
-- no account may call it any more.

revoke execute on function public.console_retire(text) from authenticated;
create function public.console_retire(device text, notice_ttl_min integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  phone text;
  sms_key text;
  signed_part text;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select d.phone_e164, s.decrypted_secret into phone, sms_key
  from public.driver_devices d
  join vault.decrypted_secrets s on s.id = d.sms_key_id
  where d.device_id = device and d.active;
  if not found then return false; end if;

  if phone is not null and device ~ '^[A-Z0-9-]{1,24}$' then
    signed_part := 'HM2|RETIRED|' || device;
    insert into public.sms_outbox (kind, to_e164, encoding, body_text, expires_at)
    values ('notice', phone, 'text',
            signed_part || '|' || upper(left(encode(extensions.hmac(signed_part, sms_key, 'sha256'), 'hex'), 8)),
            now() + make_interval(mins => notice_ttl_min));
  end if;
  return public.admin_retire_device(device, encode(extensions.gen_random_bytes(32), 'hex'));
end;
$$;
revoke execute on function public.console_retire(text, integer) from public, anon;
grant execute on function public.console_retire(text, integer) to authenticated;
