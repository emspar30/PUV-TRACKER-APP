-- Open sign-up (2026-10-05, Emjay: "publishable" commuter app). Anyone with an account may read
-- the live map, check in, report, flag and use Energy. Publishing positions stays team-only: the
-- ingest Edge Function checks public.team_accounts itself and is not changed here.
-- app_config.open_signup switches it back to team accounts only, without another migration.
-- No table, row or grant is removed. Each function below is the SB1 body with one line changed:
-- the team check becomes public.may_participate().

alter table public.app_config add column open_signup boolean not null default true;

-- Any signed-in user while open_signup is on; otherwise team accounts only
create function public.may_participate()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and ((select c.open_signup from public.app_config c) or public.is_team_account());
$$;

revoke execute on function public.may_participate() from public, anon;
grant execute on function public.may_participate() to authenticated;

alter policy "vehicles: team accounts read active vehicles" on public.vehicles
  using (active and (select public.may_participate()));
alter policy "vehicles: team accounts read active vehicles" on public.vehicles
  rename to "vehicles: participants read active vehicles";

alter policy "telemetry_latest: team accounts read active vehicles" on public.telemetry_latest
  using (
    (select public.may_participate())
    and exists (
      select 1 from public.vehicles v
      where v.vehicle_id = telemetry_latest.vehicle_id and v.active
    )
    and (
      not public.is_night(now())
      or telemetry_latest.speed_kmh < (select c.stationary_speed_kmh from public.app_config c)
    )
  );
alter policy "telemetry_latest: team accounts read active vehicles" on public.telemetry_latest
  rename to "telemetry_latest: participants read active vehicles";

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
    when 'checkin' then cfg.energy_checkin
    when 'passive' then cfg.energy_passive_amount
    else null end;
  if wanted is null then raise exception 'unknown earning kind' using errcode = '22023'; end if;
  select count(*) into used_today from public.energy_ledger l
    where l.user_id = uid and l.manila_day = today and l.kind = earn_kind;
  if used_today >= (case when earn_kind = 'passive' then cfg.energy_passive_daily_max else 1 end) then
    return 0;
  end if;
  select coalesce(sum(l.amount), 0) into balance from public.energy_ledger l where l.user_id = uid;
  booked := greatest(0, least(wanted, cfg.energy_wallet_cap - balance));
  if booked = 0 then return 0; end if;
  insert into public.energy_ledger (user_id, kind, amount, manila_day, request_key)
  values (uid, earn_kind, booked, today, energy_earn.request_key);
  return booked;
end;
$$;

create or replace function public.start_tracking(request_key text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.app_config;
  balance numeric;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  select * into cfg from public.app_config;
  if cfg.energy_enabled then
    perform pg_advisory_xact_lock(hashtext(uid::text));
    if not exists (select 1 from public.energy_ledger l where l.user_id = uid and l.request_key = start_tracking.request_key) then
      select coalesce(sum(l.amount), 0) into balance from public.energy_ledger l where l.user_id = uid;
      if least(balance, cfg.energy_wallet_cap) < cfg.energy_tracking_cost then
        raise exception 'not enough energy' using errcode = 'P0001';
      end if;
      insert into public.energy_ledger (user_id, kind, amount, manila_day, request_key)
      values (uid, 'tracking', -cfg.energy_tracking_cost, public.manila_day(now()), start_tracking.request_key);
    end if;
  end if;
  return now() + make_interval(mins => cfg.tracking_session_min);
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
  ends := now() + make_interval(mins => (select c.checkin_lifetime_min from public.app_config c));
  update public.checkins set expires_at = now() where user_id = uid and expires_at > now();
  insert into public.checkins (user_id, route_id, station_code, expires_at) values (uid, route, station, ends);
  perform public.energy_earn('checkin', check_in.request_key);
  return ends;
end;
$$;

create or replace function public.checkin_counts(route text)
returns table (station_code text, waiting bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  return query
    select c.station_code, count(*)::bigint
    from public.checkins c
    where c.route_id = route and c.expires_at > now()
    group by c.station_code;
end;
$$;

create or replace function public.post_report(route text, phrase text, seat_tier text, vehicle text, with_gps boolean, request_key text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  name text;
  post bigint;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  select p.username into name from public.profiles p where p.user_id = uid;
  if name is null then raise exception 'set a username first' using errcode = 'P0001'; end if;
  insert into public.feed_posts (user_id, author_username, route_id, vehicle_id, phrase, seat_tier, with_gps, expires_at)
  values (uid, name, route, vehicle, post_report.phrase, post_report.seat_tier, with_gps,
          now() + make_interval(mins => (select c.feed_lifetime_min from public.app_config c)))
  returning id into post;
  perform public.energy_earn(case when with_gps then 'gps_report' else 'no_gps_report' end, post_report.request_key);
  return post;
end;
$$;

create or replace function public.flag_post(post bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  flags int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  insert into public.feed_flags (post_id, user_id) values (post, uid) on conflict do nothing;
  select count(*) into flags from public.feed_flags f where f.post_id = post;
  if flags >= (select c.feed_flag_hide_count from public.app_config c) then
    update public.feed_posts set hidden = true where id = post;
    insert into public.feed_review_queue (post_id) values (post) on conflict do nothing;
    return true;
  end if;
  return false;
end;
$$;
