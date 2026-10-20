-- DR8: commuter boarding detection (docs/IMPLEMENTATION_PLAN_DRIVER.md DR8; PRD 8.2, 0.2 S7). A
-- signed-in commuter's phone hears a multicab's beacon and asks verify_beacon whether the rotating
-- code is genuine and current; the answer names the vehicle, its route and plate, nothing else. A
-- relay sent with the code (post_report's beacon argument) records whether it checked out. The
-- beacon secrets stay in Vault and are read only inside beacon_check.

-- HMAC-SHA256 (pgcrypto). Hosted Supabase projects have it in the extensions schema already.
create extension if not exists pgcrypto with schema extensions;
-- feed_posts.beacon_ok: null when sent without a beacon code; true when the code was valid and named
-- the reported vehicle and route; false when it did not check out. Server-only for now: no grant.
alter table public.feed_posts add column beacon_ok boolean;
-- beacon_verify_calls: the caller's verify_beacon calls in the current minute, one row per user, for
-- the limit of 30 a minute. Server-only.
create table public.beacon_verify_calls (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  window_start  timestamptz not null,
  calls         integer not null check (calls >= 0)
);
alter table public.beacon_verify_calls enable row level security;
revoke all on public.beacon_verify_calls from anon, authenticated;
grant all on public.beacon_verify_calls to service_role;
-- No policy on purpose: client roles are denied everything.

-- Checks a beacon code by the rule of src/shared/beacon/code.ts and the driver phone's BeaconCode.kt
-- (all three are checked against tests/fixtures/beacon-vectors.json):
--   payload = version (1) | short id (2) | slot & 0xffff (2) | first 4 bytes of
--             HMAC-SHA256(secret, version | short id | slot as uint32), big-endian
-- valid in the server's current 60 s slot or one either side (BEACON_SLOT_S, BEACON_SLOT_TOLERANCE).
-- Internal: answers a status (ok, beacon_invalid, beacon_expired, unknown_vehicle) and never raises,
-- and the vehicle only when the code is ok.
create function public.beacon_check(payload_hex text)
returns table (vehicle_id text, route_id text, plate text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload bytea;
  code_version integer;
  sid integer;
  slot_low integer;
  mac bytea;
  secret bytea;
  found_vehicle text;
  found_route text;
  found_plate text;
  now_slot bigint := floor(extract(epoch from now()) / 60)::bigint;
  candidate bigint;
begin
  if payload_hex is null or payload_hex !~* '^[0-9a-f]{18}$' then
    return query select null::text, null::text, null::text, 'beacon_invalid'::text;
    return;
  end if;
  payload := decode(lower(payload_hex), 'hex');
  code_version := get_byte(payload, 0);
  sid := get_byte(payload, 1) * 256 + get_byte(payload, 2);
  slot_low := get_byte(payload, 3) * 256 + get_byte(payload, 4);
  mac := substring(payload from 6 for 4);
  if code_version <> 1 or sid = 0 then
    return query select null::text, null::text, null::text, 'beacon_invalid'::text;
    return;
  end if;

  select v.vehicle_id, v.route_id, v.plate, decode(s.decrypted_secret, 'hex')
    into found_vehicle, found_route, found_plate, secret
  from public.vehicle_beacons b
  join public.vehicles v on v.vehicle_id = b.vehicle_id
  join vault.decrypted_secrets s on s.id = b.secret_id
  where b.short_id = sid and v.active;
  if not found then
    return query select null::text, null::text, null::text, 'unknown_vehicle'::text;
    return;
  end if;

  for slot_offset in -1..1 loop
    candidate := now_slot + slot_offset;
    continue when (candidate & 65535) <> slot_low;
    -- Within the tolerance at most one slot has these low 16 bits
    if substring(
         extensions.hmac(
           decode(lpad(to_hex(code_version), 2, '0') || lpad(to_hex(sid), 4, '0') || lpad(to_hex(candidate), 8, '0'), 'hex'),
           secret,
           'sha256'
         ) from 1 for 4
       ) = mac then
      return query select found_vehicle, found_route, found_plate, 'ok'::text;
    else
      return query select null::text, null::text, null::text, 'beacon_invalid'::text;
    end if;
    return;
  end loop;
  return query select null::text, null::text, null::text, 'beacon_expired'::text;
end;
$$;
-- The commuter app's check (PRD 0.2 S7): one row with the vehicle, its route and plate when the code
-- is ok, else only the status (beacon_invalid, beacon_expired, unknown_vehicle, too_many_checks).
-- A status, not an exception: an exception would roll back the call counter with it, so failed codes
-- would never count towards the limit.
create function public.verify_beacon(payload_hex text)
returns table (vehicle_id text, route_id text, plate text, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  this_minute timestamptz := date_trunc('minute', now());
  used integer;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;

  insert into public.beacon_verify_calls as c (user_id, window_start, calls)
  values (uid, this_minute, 1)
  on conflict (user_id) do update
    set calls = case when c.window_start = this_minute then c.calls + 1 else 1 end,
        window_start = this_minute
  returning c.calls into used;
  if used > 30 then
    return query select null::text, null::text, null::text, 'too_many_checks'::text;
    return;
  end if;

  return query select b.vehicle_id, b.route_id, b.plate, b.status from public.beacon_check(payload_hex) b;
end;
$$;
-- post_report with the beacon code the phone heard (null when none). The relay is posted either way;
-- beacon_ok says whether the code was valid now and named the same route and vehicle (a report that
-- names no vehicle takes the beacon's). The seven-argument version stays, for builds from before DR8.
-- The beacon argument has no default, so the API never has two versions to choose between.
create function public.post_report(route text, phrase text, seat_tier text, vehicle text, with_gps boolean, stop text, beacon text, request_key text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  name text;
  post bigint;
  checked record;
  beacon_valid boolean := null;
  chosen_vehicle text := vehicle;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  select p.username into name from public.profiles p where p.user_id = uid;
  if name is null then raise exception 'set a username first' using errcode = 'P0001'; end if;
  if beacon is not null then
    select * into checked from public.beacon_check(beacon);
    beacon_valid := checked.status = 'ok' and checked.route_id = route and (vehicle is null or vehicle = checked.vehicle_id);
    if beacon_valid then chosen_vehicle := checked.vehicle_id; end if;
  end if;
  insert into public.feed_posts (user_id, author_username, route_id, vehicle_id, phrase, seat_tier, with_gps, stop_code, beacon_ok, expires_at)
  values (uid, name, route, chosen_vehicle, post_report.phrase, post_report.seat_tier, with_gps, post_report.stop, beacon_valid,
          now() + make_interval(mins => (select c.feed_lifetime_min from public.app_config c)))
  returning id into post;
  perform public.energy_earn(case when with_gps then 'gps_report' else 'no_gps_report' end, post_report.request_key);
  return post;
end;
$$;
-- beacon_check is internal; verify_beacon and the new post_report are for signed-in users only
revoke execute on function public.beacon_check(text) from public, anon, authenticated;
revoke execute on function public.verify_beacon(text) from public, anon;
grant execute on function public.verify_beacon(text) to authenticated;
revoke execute on function public.post_report(text, text, text, text, boolean, text, text, text) from public, anon;
grant execute on function public.post_report(text, text, text, text, boolean, text, text, text) to authenticated;
