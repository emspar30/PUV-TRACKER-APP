-- RL2b (Emjay's D10, 2026-10-23): Energy for relays. Every relay has a verified multicab beacon
-- since RL2a, so each one earns, with no daily limit: on the live map energy_live_report (+1.0), in
-- Crowdsource energy_feed_report (+0.5). The wallet cap stays. The kinds 'gps_report' and
-- 'no_gps_report' stay for the history of earlier relays.
-- A relay on a multicab this rider relayed (with a valid beacon) within relay_same_vehicle_gap_h
-- (3) hours is refused with 'you already relayed this multicab', whatever came between; different
-- multicabs always earn.
-- No table, row or function is removed; post_report keeps its RL2a signature and grants.

alter table public.app_config
  add column energy_live_report numeric(4, 1) not null default 1.0 check (energy_live_report between 0 and 5),
  add column energy_feed_report numeric(4, 1) not null default 0.5 check (energy_feed_report between 0 and 5),
  add column relay_same_vehicle_gap_h smallint not null default 3 check (relay_same_vehicle_gap_h between 0 and 48);

alter table public.energy_ledger drop constraint energy_ledger_kind_check;
alter table public.energy_ledger add constraint energy_ledger_kind_check
  check (kind in ('gps_report', 'no_gps_report', 'live_report', 'feed_report', 'checkin', 'passive', 'tracking', 'welcome'));

-- For the same-multicab check
create index feed_posts_user_vehicle_idx on public.feed_posts (user_id, vehicle_id, created_at);

-- As before, plus the relay kinds, which have no daily limit
create or replace function public.energy_earn(earn_kind text, request_key text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.app_config;
  today date;
  wanted numeric;
  balance numeric;
  booked numeric;
  used_today int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  select * into cfg from public.app_config;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if exists (select 1 from public.energy_ledger l where l.user_id = uid and l.request_key = energy_earn.request_key) then
    return 0;
  end if;
  today := public.manila_day(now());
  wanted := case earn_kind
    when 'gps_report' then cfg.energy_gps_report
    when 'no_gps_report' then cfg.energy_no_gps_report
    when 'live_report' then cfg.energy_live_report
    when 'feed_report' then cfg.energy_feed_report
    when 'checkin' then cfg.energy_checkin
    when 'passive' then cfg.energy_passive_amount
    else null end;
  if wanted is null then raise exception 'unknown earning kind' using errcode = '22023'; end if;
  if earn_kind not in ('live_report', 'feed_report') then
    select count(*) into used_today from public.energy_ledger l
      where l.user_id = uid and l.manila_day = today and l.kind = earn_kind;
    if used_today >= (case when earn_kind = 'passive' then cfg.energy_passive_daily_max else 1 end) then
      return 0;
    end if;
  end if;
  select coalesce(sum(l.amount), 0) into balance from public.energy_ledger l where l.user_id = uid;
  booked := greatest(0, least(wanted, cfg.energy_wallet_cap - balance));
  if booked = 0 then return 0; end if;
  insert into public.energy_ledger (user_id, kind, amount, manila_day, request_key)
  values (uid, earn_kind, booked, today, energy_earn.request_key);
  return booked;
end;
$$;

-- RL2a's relay, with the same-multicab check and the RL2b earning
create or replace function public.post_report(route text, phrase text, seat_tier text, vehicle text, with_gps boolean, stop text, beacon text, live_map boolean, request_key text)
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
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  select p.username into name from public.profiles p where p.user_id = uid;
  if name is null then raise exception 'set a username first' using errcode = 'P0001'; end if;
  if beacon is null then raise exception 'a registered multicab beacon is needed' using errcode = 'P0001'; end if;
  select * into checked from public.beacon_check(beacon);
  if checked.status is distinct from 'ok' or checked.route_id is distinct from route
     or (vehicle is not null and vehicle is distinct from checked.vehicle_id) then
    raise exception 'a registered multicab beacon is needed' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.feed_posts f
     where f.user_id = uid
       and f.vehicle_id = checked.vehicle_id
       and f.beacon_ok
       and f.created_at > now() - make_interval(hours => (select c.relay_same_vehicle_gap_h from public.app_config c))
  ) then
    raise exception 'you already relayed this multicab' using errcode = 'P0001';
  end if;
  insert into public.feed_posts (user_id, author_username, route_id, vehicle_id, phrase, seat_tier, with_gps, stop_code, beacon_ok, live_map, expires_at)
  values (uid, name, route, checked.vehicle_id, post_report.phrase, post_report.seat_tier, with_gps, post_report.stop, true, post_report.live_map,
          now() + make_interval(mins => (select c.relay_post_grace_min from public.app_config c)))
  returning id into post;
  perform public.energy_earn(case when post_report.live_map then 'live_report' else 'feed_report' end, post_report.request_key);
  return post;
end;
$$;
