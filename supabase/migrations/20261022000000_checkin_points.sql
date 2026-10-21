-- Check-ins cost Energy (Emjay, 2026-10-22, CA1.1). Pinging the drivers of a route may cost money
-- later (SMS), so a check-in spends energy_checkin_route_cost (0.3) for each route pinged instead of
-- earning 0.3. Energy comes back only by waiting (the passive refill) or by a relay with GPS (the
-- verified kind, +1.0 once a Manila day); a relay without GPS earns nothing now. Every account starts
-- with energy_welcome (5, the wallet) the first time its wallet is read. Tracking still costs 1.
-- While energy_enabled is off, check-ins are free like tracking.

alter table public.energy_ledger drop constraint energy_ledger_kind_check;
alter table public.energy_ledger add constraint energy_ledger_kind_check
  check (kind in ('gps_report', 'no_gps_report', 'checkin', 'passive', 'tracking', 'welcome'));

alter table public.app_config add column energy_checkin_route_cost numeric(4, 1) not null default 0.3;
alter table public.app_config add column energy_welcome numeric(4, 1) not null default 5;
update public.app_config set energy_no_gps_report = 0;

-- Spends the check-in for `route_count` routes, or raises 'not enough energy' (P0001), which rolls
-- the check-in back. Idempotent by request_key; nothing while energy_enabled is off. Internal.
create function public.energy_charge_checkin(route_count int, request_key text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.app_config;
  balance numeric;
  cost numeric;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into cfg from public.app_config;
  if not cfg.energy_enabled then return 0; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if exists (select 1 from public.energy_ledger l where l.user_id = uid and l.request_key = energy_charge_checkin.request_key) then
    return 0;
  end if;
  cost := route_count * cfg.energy_checkin_route_cost;
  select coalesce(sum(l.amount), 0) into balance from public.energy_ledger l where l.user_id = uid;
  if least(balance, cfg.energy_wallet_cap) < cost then
    raise exception 'not enough energy' using errcode = 'P0001';
  end if;
  insert into public.energy_ledger (user_id, kind, amount, manila_day, request_key)
  values (uid, 'checkin', -cost, public.manila_day(now()), energy_charge_checkin.request_key);
  return cost;
end;
$$;

create or replace function public.check_in(route text, station text, request_key text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ends timestamptz;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  perform public.energy_charge_checkin(1, check_in.request_key);
  ends := now() + make_interval(mins => (select c.checkin_lifetime_min from public.app_config c));
  update public.checkins set expires_at = now() where user_id = uid and expires_at > now();
  insert into public.checkins (user_id, route_id, station_code, expires_at) values (uid, route, station, ends);
  return ends;
end;
$$;

create or replace function public.check_in_routes(routes text[], station text, request_key text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ends timestamptz;
  picked text[];
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  picked := array(select distinct r from unnest(routes) r where r is not null);
  if cardinality(picked) = 0 or cardinality(picked) > 8 then
    raise exception 'pick 1 to 8 routes' using errcode = '22023';
  end if;
  perform public.energy_charge_checkin(cardinality(picked), check_in_routes.request_key);
  ends := now() + make_interval(mins => (select c.checkin_lifetime_min from public.app_config c));
  update public.checkins set expires_at = now() where user_id = uid and expires_at > now();
  insert into public.checkins (user_id, route_id, station_code, expires_at)
    select uid, r, station, ends from unnest(picked) r;
  return ends;
end;
$$;

-- The passive refill, now also booking the welcome Energy once, on an account's first read; the
-- welcome starts the refill clock like a refill, so the first spend is not refilled at once
create or replace function public.energy_passive_refill()
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.app_config;
  last_passive timestamptz;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into cfg from public.app_config;
  if not exists (select 1 from public.energy_ledger l where l.user_id = uid) then
    insert into public.energy_ledger (user_id, kind, amount, manila_day, request_key)
    values (uid, 'welcome', least(cfg.energy_welcome, cfg.energy_wallet_cap), public.manila_day(now()), 'welcome-energy')
    on conflict (user_id, request_key) do nothing;
  end if;
  select max(l.created_at) into last_passive from public.energy_ledger l where l.user_id = uid and l.kind in ('passive', 'welcome');
  if last_passive is not null and last_passive > now() - make_interval(hours => cfg.energy_passive_interval_h) then
    return 0;
  end if;
  return public.energy_earn('passive', 'passive-' || to_char(now() at time zone cfg.night_tz, 'YYYYMMDD"T"HH24'));
end;
$$;

revoke execute on function public.energy_charge_checkin(int, text) from public, anon, authenticated;
