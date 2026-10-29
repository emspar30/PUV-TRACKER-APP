-- The retire notice goes out as a hidden data SMS (owner, 2026-10-29), so the driver's Messages app
-- no longer shows a line of code; the driver sees "This phone was removed from Tunton" in the driver
-- app only. console_retire is otherwise as in 20261028000000_retire_notice.sql: it signs the notice
-- with the phone's own SMS key, queues it to the phone's number, then retires the phone (which wipes
-- that key), all in one transaction.
--
-- The bytes are the notice's data form (src/shared/sms/binary.ts encodeRetiredNoticeBinary; a test
-- builds them the way this function does):
--   0x48 'H' | 0x02 | 0x00 (route byte 0: a notice) | id length | device id | mac (4)
-- The gateway sends a data row to the driver app's data port as it sends heatmap messages; the
-- driver app turns the bytes back into HM2|RETIRED|<device id>|<mac> and checks the signature. The
-- text stays in body_text, for the log. The driver app still takes the notice as a plain text too.
--
-- Same name and arguments, so it is replaced in place (migrations never drop).

create or replace function public.console_retire(device text, notice_ttl_min integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  phone text;
  sms_key text;
  signed_part text;
  mac text;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select d.phone_e164, s.decrypted_secret into phone, sms_key
  from public.driver_devices d
  join vault.decrypted_secrets s on s.id = d.sms_key_id
  where d.device_id = device and d.active;
  if not found then return false; end if;

  if phone is not null and device ~ '^[A-Z0-9-]{1,24}$' then
    signed_part := 'HM2|RETIRED|' || device;
    mac := upper(left(encode(extensions.hmac(signed_part, sms_key, 'sha256'), 'hex'), 8));
    insert into public.sms_outbox (kind, to_e164, encoding, body_text, body_b64, expires_at)
    values ('notice', phone, 'data', signed_part || '|' || mac,
            encode(decode('480200' || lpad(to_hex(length(device)), 2, '0') || encode(convert_to(device, 'UTF8'), 'hex') || mac, 'hex'), 'base64'),
            now() + make_interval(mins => notice_ttl_min));
  end if;
  return public.admin_retire_device(device, encode(extensions.gen_random_bytes(32), 'hex'));
end;
$$;
revoke execute on function public.console_retire(text, integer) from public, anon;
grant execute on function public.console_retire(text, integer) to authenticated;
