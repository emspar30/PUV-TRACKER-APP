-- DR3: the driver side's database (docs/IMPLEMENTATION_PLAN_DRIVER.md, sections 6 and 8; PRD 8.2,
-- 9.3, 9.5, 9.6, 12.2). Everything here is server-only: no client role gets a grant or a policy, and
-- the commuter tables are unchanged (vehicles included: the beacon lives in its own table, because
-- signed-in commuters read vehicles). Only the SMS worker and the admin scripts on Emjay's PC use it,
-- with the service role, through the worker_* and admin_* functions below.
--
-- Secrets (each vehicle's beacon secret, each driver phone's SMS key) live in Supabase Vault, never
-- in a table column: tables hold only the Vault id. Driver SIM numbers (PRD 5.1: "driver contact
-- numbers for SMS") are personal data, kept only in driver_devices, readable only by the worker.

-- Vault must be on (it is by default on hosted projects); stop with a clear message if it is not
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'vault') then
    raise exception 'Supabase Vault (supabase_vault) is not enabled on this project';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- vehicle_beacons: the beacon of a vehicle (PRD 8.2). short_id is what the beacon advertises
-- (1 to 65535); secret_id points to the 32-byte secret in Vault, as 64 hex characters.
-- ---------------------------------------------------------------------------
create table public.vehicle_beacons (
  vehicle_id  text primary key references public.vehicles (vehicle_id) on delete cascade,
  short_id    integer not null unique check (short_id between 1 and 65535),
  secret_id   uuid not null,
  rotated_at  timestamptz not null default now()
);

alter table public.vehicle_beacons enable row level security;

revoke all on public.vehicle_beacons from anon, authenticated;
grant all on public.vehicle_beacons to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- driver_devices: one driver phone, provisioned once by an admin (PRD 9.5). One active phone per
-- vehicle. last_seq is the last heatmap sequence number reserved for this phone (PRD 12.3).
-- ---------------------------------------------------------------------------
create table public.driver_devices (
  device_id       text primary key check (device_id ~ '^DRV-[0-9]{4}$'),
  vehicle_id      text not null references public.vehicles (vehicle_id),
  phone_e164      text not null check (phone_e164 ~ '^\+639[0-9]{9}$'),
  sms_key_id      uuid not null,
  last_seq        integer check (last_seq between 0 and 9999),
  active          boolean not null default true,
  provisioned_at  timestamptz not null default now(),
  retired_at      timestamptz,
  note            text check (char_length(note) <= 200)
);

create unique index driver_devices_one_active_per_vehicle on public.driver_devices (vehicle_id) where active;

alter table public.driver_devices enable row level security;

revoke all on public.driver_devices from anon, authenticated;
grant all on public.driver_devices to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- gateways: the phone that sends the heatmap SMS (PRD 9.6). The worker knows it by the SHA-256 of
-- its access token; the token itself is only on the gateway phone.
-- ---------------------------------------------------------------------------
create table public.gateways (
  gateway_id         text primary key check (gateway_id ~ '^GW-[0-9]{2}$'),
  token_hash         text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  phone_e164         text check (phone_e164 ~ '^\+639[0-9]{9}$'),
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  last_heartbeat_at  timestamptz,
  last_status        jsonb
);

alter table public.gateways enable row level security;

revoke all on public.gateways from anon, authenticated;
grant all on public.gateways to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- sms_outbox: the worker's queue (PRD 12.2). A message waits (queued), is taken by the gateway
-- (claimed), then sent, delivered or failed; one that waits past expires_at is dropped (expired),
-- because an old count is worse than none (PRD 9.4 greys the heatmap instead).
-- ---------------------------------------------------------------------------
create table public.sms_outbox (
  id            bigint generated always as identity primary key,
  device_id     text not null references public.driver_devices (device_id),
  route_id      text not null check (route_id ~ '^R[0-9]{1,2}$'),
  seq           integer not null check (seq between 0 and 9999),
  encoding      text not null check (encoding in ('text', 'data')),
  body_text     text not null check (char_length(body_text) <= 200),
  body_b64      text check (char_length(body_b64) <= 200),
  status        text not null default 'queued' check (status in ('queued', 'claimed', 'sent', 'delivered', 'failed', 'expired')),
  attempts      smallint not null default 0,
  gateway_id    text references public.gateways (gateway_id),
  error         text check (char_length(error) <= 200),
  created_at    timestamptz not null default now(),
  claimed_at    timestamptz,
  sent_at       timestamptz,
  delivered_at  timestamptz,
  expires_at    timestamptz not null,
  check (encoding = 'text' or body_b64 is not null)
);

create index sms_outbox_status_idx on public.sms_outbox (status, created_at);
create index sms_outbox_created_idx on public.sms_outbox (created_at);

alter table public.sms_outbox enable row level security;

revoke all on public.sms_outbox from anon, authenticated;
grant all on public.sms_outbox to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- sms_dispatch_state: what each route's drivers were last sent (the dispatch rule's "last")
-- ---------------------------------------------------------------------------
create table public.sms_dispatch_state (
  route_id      text primary key check (route_id ~ '^R[0-9]{1,2}$'),
  last_counts   jsonb not null,
  last_sent_at  timestamptz not null
);

alter table public.sms_dispatch_state enable row level security;

revoke all on public.sms_dispatch_state from anon, authenticated;
grant all on public.sms_dispatch_state to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- ops_alerts: problems the worker found (Q9: read in the dashboard; nobody is notified)
-- ---------------------------------------------------------------------------
create table public.ops_alerts (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind ~ '^[a-z_]{1,40}$'),
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index ops_alerts_kind_idx on public.ops_alerts (kind, created_at);

alter table public.ops_alerts enable row level security;

revoke all on public.ops_alerts from anon, authenticated;
grant all on public.ops_alerts to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- Worker functions (DR6). The worker holds the thresholds (src/shared/config) and passes them in.
-- ---------------------------------------------------------------------------

-- Live waiting counts per route and stop, by the same rule as checkin_counts (expires_at in the future)
create function public.worker_demand_snapshot()
returns table (route_id text, station_code text, waiting bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.route_id, c.station_code, count(*)::bigint
  from public.checkins c
  where c.expires_at > now()
  group by c.route_id, c.station_code;
$$;

-- Active driver phones with their route and SMS key (from Vault)
create function public.worker_devices()
returns table (device_id text, vehicle_id text, route_id text, phone_e164 text, sms_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.device_id, d.vehicle_id, v.route_id, d.phone_e164, s.decrypted_secret
  from public.driver_devices d
  join public.vehicles v on v.vehicle_id = d.vehicle_id
  join vault.decrypted_secrets s on s.id = d.sms_key_id
  where d.active and v.active
  order by d.device_id;
$$;

-- What each route was last sent
create function public.worker_dispatch_state()
returns table (route_id text, last_counts jsonb, last_sent_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.route_id, s.last_counts, s.last_sent_at from public.sms_dispatch_state s;
$$;

-- Reserves n sequence numbers (1 to 10) for one phone, wrapping at 10000 (SMS_SEQ_MODULUS);
-- returns the first. Safe when two workers run: the row is locked.
create function public.worker_next_seq(device text, n integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  prev_seq integer;
begin
  if n < 1 or n > 10 then raise exception 'reserve 1 to 10 sequence numbers' using errcode = '22023'; end if;
  select d.last_seq into prev_seq from public.driver_devices d where d.device_id = device and d.active for update;
  if not found then raise exception 'no active driver device %', device using errcode = 'P0002'; end if;
  update public.driver_devices d set last_seq = (coalesce(prev_seq, -1) + n) % 10000 where d.device_id = device;
  return (coalesce(prev_seq, -1) + 1) % 10000;
end;
$$;

-- Queues one route's messages and records what the route was sent, in one transaction.
-- messages: [{ "device_id", "seq", "encoding", "body_text", "body_b64" }]
create function public.worker_enqueue(route text, counts jsonb, messages jsonb, ttl_min integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued integer;
begin
  if jsonb_typeof(messages) <> 'array' or jsonb_typeof(counts) <> 'object' then
    raise exception 'messages must be an array and counts an object' using errcode = '22023';
  end if;
  insert into public.sms_outbox (device_id, route_id, seq, encoding, body_text, body_b64, expires_at)
  select m ->> 'device_id', route, (m ->> 'seq')::integer, m ->> 'encoding', m ->> 'body_text', m ->> 'body_b64',
         now() + make_interval(mins => ttl_min)
  from jsonb_array_elements(messages) m;
  get diagnostics queued = row_count;
  insert into public.sms_dispatch_state (route_id, last_counts, last_sent_at) values (route, counts, now())
  on conflict (route_id) do update set last_counts = excluded.last_counts, last_sent_at = excluded.last_sent_at;
  return queued;
end;
$$;

-- The gateway takes up to max_rows messages, oldest first. Before that: claims older than lease_s
-- go back to the queue (or fail after max_attempts), and queued messages past expires_at expire.
create function public.worker_claim(gateway text, max_rows integer, lease_s integer, max_attempts integer)
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
    select o.id
    from public.sms_outbox o
    join public.driver_devices d on d.device_id = o.device_id
    where o.status = 'queued' and d.active
    order by o.created_at, o.id
    limit max_rows
    for update of o skip locked
  )
  update public.sms_outbox o
  set status = 'claimed', claimed_at = now(), gateway_id = gateway, attempts = o.attempts + 1
  from picked p, public.driver_devices d
  where o.id = p.id and d.device_id = o.device_id
  returning o.id, d.phone_e164, o.encoding, o.body_text, o.body_b64;
end;
$$;

-- The gateway reports a message: sent, delivered, or failed (queued again until max_attempts).
-- Returns false when the message is not this gateway's or not in a state for that result.
create function public.worker_result(message_id bigint, gateway text, result text, error_text text, max_attempts integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  changed integer;
begin
  if result = 'sent' then
    update public.sms_outbox o set status = 'sent', sent_at = now(), error = null
    where o.id = message_id and o.gateway_id = gateway and o.status = 'claimed';
  elsif result = 'delivered' then
    update public.sms_outbox o set status = 'delivered', delivered_at = now(), sent_at = coalesce(o.sent_at, now())
    where o.id = message_id and o.gateway_id = gateway and o.status in ('claimed', 'sent');
  elsif result = 'failed' then
    update public.sms_outbox o
    set status = case when o.attempts >= max_attempts then 'failed' else 'queued' end,
        error = left(coalesce(error_text, 'failed'), 200),
        claimed_at = null
    where o.id = message_id and o.gateway_id = gateway and o.status = 'claimed';
  else
    raise exception 'result must be sent, delivered or failed' using errcode = '22023';
  end if;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- The active gateway whose token has this SHA-256, or null
create function public.worker_gateway_auth(hash text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select g.gateway_id from public.gateways g where g.token_hash = hash and g.active;
$$;

create function public.worker_heartbeat(gateway text, status jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.gateways g set last_heartbeat_at = now(), last_status = status where g.gateway_id = gateway and g.active;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- Records a problem unless the same kind is already open from the last quiet_min minutes
create function public.worker_alert(kind text, detail jsonb, quiet_min integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.ops_alerts a
    where a.kind = worker_alert.kind and a.resolved_at is null and a.created_at > now() - make_interval(mins => quiet_min)
  ) then
    return false;
  end if;
  insert into public.ops_alerts (kind, detail) values (worker_alert.kind, coalesce(detail, '{}'::jsonb));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin functions (DR3 scripts on Emjay's PC, service role).
-- ---------------------------------------------------------------------------

-- Stores a secret in Vault under a name, replacing the value if that name exists already (a vehicle
-- or device id provisioned again after its row was removed); returns the secret's id
create function public.vault_put(secret_name text, secret_value text, secret_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
begin
  select s.id into found_id from vault.decrypted_secrets s where s.name = secret_name;
  if found then
    perform vault.update_secret(found_id, secret_value);
    return found_id;
  end if;
  return vault.create_secret(secret_value, secret_name, secret_description);
end;
$$;

-- ---------------------------------------------------------------------------
-- (Admin functions continued) The scripts make the secrets with a
-- secure random source and hand them over here; they go straight into Vault.
-- ---------------------------------------------------------------------------

-- Provisions a driver phone for a vehicle (creating or updating the vehicle) and gives the vehicle a
-- new beacon secret (a new phone always gets a fresh one). Refuses when the vehicle already has an
-- active phone: retire it first. Returns the new device id, the vehicle's short id and the active
-- gateway numbers for the setup QR.
create function public.admin_provision_driver(
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
begin
  if beacon_secret !~ '^[0-9a-f]{64}$' or sms_key !~ '^[0-9a-f]{64}$' then
    raise exception 'secrets must be 64 lower-case hex characters' using errcode = '22023';
  end if;
  if phone !~ '^\+639[0-9]{9}$' then raise exception 'phone must be +639 and 9 digits' using errcode = '22023'; end if;
  if route !~ '^R[0-9]{1,2}$' then raise exception 'route must be like R4' using errcode = '22023'; end if;
  if char_length(trim(plate)) = 0 or char_length(plate) > 16 then raise exception 'plate must be 1 to 16 characters' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('admin_provision_driver'));

  select d.device_id into existing from public.driver_devices d where d.vehicle_id = vehicle and d.active;
  if found then
    raise exception 'vehicle % already has active phone %; retire it first', vehicle, existing using errcode = '23505';
  end if;

  insert into public.vehicles (vehicle_id, plate, route_id, active) values (vehicle, plate, route, true)
  on conflict (vehicle_id) do update set plate = excluded.plate, route_id = excluded.route_id, active = true;

  select b.short_id, b.secret_id into sid, beacon_id from public.vehicle_beacons b where b.vehicle_id = vehicle;
  if found then
    if wanted_short_id is not null and wanted_short_id <> sid then
      raise exception 'vehicle % already has short id %', vehicle, sid using errcode = '23505';
    end if;
    perform vault.update_secret(beacon_id, beacon_secret);
    update public.vehicle_beacons b set rotated_at = now() where b.vehicle_id = vehicle;
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

-- Retires a driver phone (lost, replaced, or the pilot ended): it gets no more messages, its queued
-- messages expire, its SMS key in Vault is overwritten with a random value, and, when a new secret is given, its vehicle's
-- beacon secret is replaced so codes from the old phone stop validating at once (runbook 11.5).
create function public.admin_retire_device(device text, new_beacon_secret text)
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

-- Adds a gateway or replaces its token (and number); the gateway is active afterwards
create function public.admin_provision_gateway(gateway text, hash text, phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if hash !~ '^[0-9a-f]{64}$' then raise exception 'hash must be a SHA-256 in lower-case hex' using errcode = '22023'; end if;
  if phone is not null and phone !~ '^\+639[0-9]{9}$' then raise exception 'phone must be +639 and 9 digits' using errcode = '22023'; end if;
  insert into public.gateways (gateway_id, token_hash, phone_e164, active) values (gateway, hash, phone, true)
  on conflict (gateway_id) do update set token_hash = excluded.token_hash, phone_e164 = excluded.phone_e164, active = true;
end;
$$;

-- Functions are executable by PUBLIC by default: only the service role (worker, admin scripts) may run these
revoke execute on function public.worker_demand_snapshot() from public, anon, authenticated;
revoke execute on function public.worker_devices() from public, anon, authenticated;
revoke execute on function public.worker_dispatch_state() from public, anon, authenticated;
revoke execute on function public.worker_next_seq(text, integer) from public, anon, authenticated;
revoke execute on function public.worker_enqueue(text, jsonb, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.worker_claim(text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.worker_result(bigint, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.worker_gateway_auth(text) from public, anon, authenticated;
revoke execute on function public.worker_heartbeat(text, jsonb) from public, anon, authenticated;
revoke execute on function public.worker_alert(text, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.admin_provision_driver(text, text, text, text, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_retire_device(text, text) from public, anon, authenticated;
revoke execute on function public.admin_provision_gateway(text, text, text) from public, anon, authenticated;
revoke execute on function public.vault_put(text, text, text) from public, anon, authenticated;

grant execute on function public.worker_demand_snapshot() to service_role;
grant execute on function public.worker_devices() to service_role;
grant execute on function public.worker_dispatch_state() to service_role;
grant execute on function public.worker_next_seq(text, integer) to service_role;
grant execute on function public.worker_enqueue(text, jsonb, jsonb, integer) to service_role;
grant execute on function public.worker_claim(text, integer, integer, integer) to service_role;
grant execute on function public.worker_result(bigint, text, text, text, integer) to service_role;
grant execute on function public.worker_gateway_auth(text) to service_role;
grant execute on function public.worker_heartbeat(text, jsonb) to service_role;
grant execute on function public.worker_alert(text, jsonb, integer) to service_role;
grant execute on function public.admin_provision_driver(text, text, text, text, integer, text, text, text) to service_role;
grant execute on function public.admin_retire_device(text, text) to service_role;
grant execute on function public.admin_provision_gateway(text, text, text) to service_role;
-- vault_put is internal: called only by the admin functions above, not granted to anyone
