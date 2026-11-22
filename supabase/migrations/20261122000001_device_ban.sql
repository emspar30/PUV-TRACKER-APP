-- Device ban (PRD 10.3 "device fingerprint"; owner, 2026-11-22, replacing the deferral D7 of
-- docs/IMPLEMENTATION_PLAN_PRD_GAPS.md): a suspension also covers the other accounts used on the same
-- phone, so a suspended rider cannot carry on with a new account on that phone.
--
-- The phone sends its Android ID (Settings.Secure.ANDROID_ID: per app-signing key, user and device;
-- it survives a reinstall and changes on a factory reset). Only a keyed HMAC-SHA256 of it is stored,
-- with a key kept in Vault, as PRD 10.3 and 15.1 require: a plain hash of a stable identifier would
-- still be personal data that anyone could recompute. Rows go with the account (on delete cascade).
--
-- How the ban spreads (account_devices links accounts that used the same phone):
-- - register_device, at each sign-in: an account on a phone where another account is suspended now
--   takes the same suspension;
-- - a trigger on profiles.suspended_until: an account suspended later passes it to the accounts that
--   share its phones, and lifting it (an upheld appeal) lifts the copies that came from it.
-- The existing checks (may_participate, the ingest function's suspended check) read
-- profiles.suspended_until, so they need no change.
--
-- Limits (PRD 10.3): a factory reset, another phone, or a rooted phone faking the ID evades it; a
-- modified app could skip register_device. Two people sharing one phone share a ban. No existing row
-- is changed or deleted.

-- ---------------------------------------------------------------------------
-- The HMAC key, made once in Vault (never replaced: that would orphan every stored fingerprint)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets s where s.name = 'device-fingerprint-key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'device-fingerprint-key', 'HMAC key for device fingerprints (PRD 10.3)');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- account_devices: which accounts used which phone (fingerprint only). No client access.
-- ---------------------------------------------------------------------------
create table public.account_devices (
  user_id      uuid not null references auth.users (id) on delete cascade,
  device_hash  text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  primary key (user_id, device_hash)
);

create index account_devices_by_device on public.account_devices (device_hash);

alter table public.account_devices enable row level security;

revoke all on public.account_devices from anon, authenticated;
grant all on public.account_devices to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- register_device: records the signed-in account's phone and applies a ban already on that phone.
-- Returns whether the account is suspended now.
-- ---------------------------------------------------------------------------
create function public.register_device(android_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  fingerprint text;
  banned_until timestamptz;
begin
  if uid is null then raise exception 'sign_in' using errcode = '42501'; end if;
  if android_id is null or android_id !~ '^[0-9a-fA-F]{1,32}$' then raise exception 'invalid_device' using errcode = '22023'; end if;
  select encode(extensions.hmac(lower(android_id), s.decrypted_secret, 'sha256'), 'hex') into fingerprint
  from vault.decrypted_secrets s where s.name = 'device-fingerprint-key';
  if fingerprint is null then raise exception 'not_configured'; end if;

  insert into public.account_devices (user_id, device_hash) values (uid, fingerprint)
  on conflict (user_id, device_hash) do update set last_seen = now();

  select max(p.suspended_until) into banned_until
  from public.account_devices d
  join public.profiles p on p.user_id = d.user_id
  where d.device_hash = fingerprint and d.user_id <> uid and p.suspended_until > now();

  if banned_until is not null then
    update public.profiles p set suspended_until = banned_until
     where p.user_id = uid and (p.suspended_until is null or p.suspended_until < banned_until);
  end if;
  return exists (select 1 from public.profiles p where p.user_id = uid and p.suspended_until > now());
end;
$$;

-- ---------------------------------------------------------------------------
-- The trigger: a suspension set or lifted on one account reaches the accounts on its phones
-- ---------------------------------------------------------------------------
create function public.share_device_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only the account the moderation acted on spreads it (the copies it writes do not spread again)
  if pg_trigger_depth() > 1 then return new; end if;
  if new.suspended_until is not null and new.suspended_until > now()
     and new.suspended_until is distinct from old.suspended_until then
    update public.profiles p set suspended_until = new.suspended_until
     where p.user_id in (
       select other.user_id from public.account_devices mine
       join public.account_devices other on other.device_hash = mine.device_hash
       where mine.user_id = new.user_id and other.user_id <> new.user_id
     )
       and (p.suspended_until is null or p.suspended_until < new.suspended_until);
  elsif old.suspended_until is not null and old.suspended_until > now()
     and (new.suspended_until is null or new.suspended_until <= now()) then
    -- Lifted: the copies that came from this suspension go too
    update public.profiles p set suspended_until = null
     where p.user_id in (
       select other.user_id from public.account_devices mine
       join public.account_devices other on other.device_hash = mine.device_hash
       where mine.user_id = new.user_id and other.user_id <> new.user_id
     )
       and p.suspended_until = old.suspended_until;
  end if;
  return new;
end;
$$;

create trigger profiles_share_device_suspension
after update of suspended_until on public.profiles
for each row execute function public.share_device_suspension();

-- ---------------------------------------------------------------------------
-- Grants. Functions are executable by PUBLIC by default.
-- ---------------------------------------------------------------------------
revoke execute on function public.register_device(text) from public, anon;
revoke execute on function public.share_device_suspension() from public, anon, authenticated;
grant execute on function public.register_device(text) to authenticated;
