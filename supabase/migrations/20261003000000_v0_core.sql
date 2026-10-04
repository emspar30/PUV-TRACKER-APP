-- Prototype v0 backend, commuter side (PRD 0.7, 7, 12.2, 19; SB1). Never applied yet, so it is
-- edited in place. Design and reasons: docs/BACKEND_SETUP.md.
--
-- The project has "Automatically expose new tables" OFF and "Enable automatic RLS" ON, so:
--   * every table below enables Row Level Security explicitly anyway (never rely on a setting);
--   * a role can use a table only if this file GRANTs it AND a policy allows the rows;
--   * a table with no policy denies everything to client roles.
--
-- Rules for every table: `anon` gets nothing; `authenticated` reads only what it needs; clients
-- never write a table directly: every write goes through a function below (security definer,
-- fixed search_path) or the ingest Edge Function (service_role). In v0 only team accounts write.
-- No table stores a rider's fare category, avatar, gender, destinations or contact details, and
-- no table puts a user next to a position.

-- ---------------------------------------------------------------------------
-- app_config: one row of server rules the app reads. Clients cannot change it.
-- ---------------------------------------------------------------------------
create table public.app_config (
  id                          boolean primary key default true check (id),
  night_start                 time not null default '21:00',
  night_end                   time not null default '04:59',
  night_tz                    text not null default 'Asia/Manila',
  energy_enabled              boolean not null default false,
  energy_wallet_cap           numeric(4, 1) not null default 5,
  energy_gps_report           numeric(4, 1) not null default 1.0,
  energy_no_gps_report        numeric(4, 1) not null default 0.5,
  energy_checkin              numeric(4, 1) not null default 0.3,
  energy_passive_amount       numeric(4, 1) not null default 1,
  energy_passive_interval_h   smallint not null default 12,
  energy_passive_daily_max    smallint not null default 2,
  energy_tracking_cost        numeric(4, 1) not null default 1,
  tracking_session_min        smallint not null default 30,
  feed_lifetime_min           smallint not null default 60,
  feed_flag_hide_count        smallint not null default 3,
  checkin_lifetime_min        smallint not null default 15,
  stationary_speed_kmh        real not null default 2
);

insert into public.app_config (id) values (true);

alter table public.app_config enable row level security;

revoke all on public.app_config from anon, authenticated;
grant select on public.app_config to authenticated;
grant all on public.app_config to service_role;

create policy "app_config: signed-in users read the rules"
  on public.app_config for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- team_accounts: the v0 allowlist (renamed from telemetry_writers). Only these accounts may
-- publish positions, check in, report, flag and use Energy (PRD 0.7 safety rule). Clients cannot see it.
-- ---------------------------------------------------------------------------
create table public.team_accounts (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  note      text,
  added_at  timestamptz not null default now()
);

alter table public.team_accounts enable row level security;

revoke all on public.team_accounts from anon, authenticated;
grant all on public.team_accounts to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- profiles: the user id and a username, nothing else (PRD 19, D3: the avatar, gender, fare type
-- and destinations stay on the phone). Usernames are unique, 3 to 20 letters, digits or _.
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  username    text unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy "profiles: read own row"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- vehicles: the multicabs that can appear on the map. Managed from the dashboard.
-- ---------------------------------------------------------------------------
create table public.vehicles (
  vehicle_id  text primary key check (vehicle_id ~ '^[A-Z0-9][A-Z0-9-]{0,23}$'),
  plate       text not null,
  route_id    text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.vehicles enable row level security;

revoke all on public.vehicles from anon, authenticated;
grant select on public.vehicles to authenticated;
grant all on public.vehicles to service_role;

create policy "vehicles: signed-in users read active vehicles"
  on public.vehicles for select to authenticated
  using (active);

-- ---------------------------------------------------------------------------
-- Helpers used by the policies and functions below
-- ---------------------------------------------------------------------------
create function public.is_team_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.team_accounts t where t.user_id = (select auth.uid()));
$$;

-- True inside the Night Mode window (PRD 10.4: 21:00 to 04:59 Asia/Manila), which wraps midnight
create function public.is_night(at_time timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.night_start <= c.night_end then (at_time at time zone c.night_tz)::time between c.night_start and c.night_end
    else (at_time at time zone c.night_tz)::time >= c.night_start or (at_time at time zone c.night_tz)::time <= c.night_end
  end
  from public.app_config c;
$$;

-- The Manila calendar day of a time, for the daily Energy caps
create function public.manila_day(at_time timestamptz)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (at_time at time zone c.night_tz)::date from public.app_config c;
$$;

-- ---------------------------------------------------------------------------
-- telemetry_latest: one row per vehicle, its newest position. Read by the live map. Clients can
-- only SELECT; every write goes through the ingest Edge Function. During Night Mode moving
-- vehicles are hidden (only stationary ones are shown), by the policy, on the server.
-- ---------------------------------------------------------------------------
create table public.telemetry_latest (
  vehicle_id            text primary key references public.vehicles (vehicle_id) on delete cascade,
  lat                   double precision not null check (lat between -90 and 90),
  lon                   double precision not null check (lon between -180 and 180),
  speed_kmh             real not null check (speed_kmh >= 0),
  heading_deg           real not null check (heading_deg >= 0 and heading_deg < 360),
  seats_taken           smallint not null check (seats_taken >= 0),
  packet_ts             timestamptz not null,
  updated_at            timestamptz not null default now(),
  stopped_since         timestamptz,
  verified              boolean not null default false,
  verification_reasons  jsonb not null default '[]'::jsonb
);

alter table public.telemetry_latest enable row level security;

revoke all on public.telemetry_latest from anon, authenticated;
grant select on public.telemetry_latest to authenticated;
grant all on public.telemetry_latest to service_role;

create policy "telemetry_latest: signed-in users read active vehicles"
  on public.telemetry_latest for select to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.vehicle_id = telemetry_latest.vehicle_id and v.active
    )
    and (
      not public.is_night(now())
      or telemetry_latest.speed_kmh < (select c.stationary_speed_kmh from public.app_config c)
    )
  );
-- No INSERT, UPDATE or DELETE grant or policy for client roles, on purpose.

-- Send row changes to subscribed clients (Realtime). Row Level Security still applies to them.
alter publication supabase_realtime add table public.telemetry_latest;

-- ---------------------------------------------------------------------------
-- telemetry_raw: every accepted position, server-only, for speed samples (ETA, L2) and
-- tracing. Kept 7 days, positions received at night 24 hours (supabase/cron/retention.sql).
-- ---------------------------------------------------------------------------
create table public.telemetry_raw (
  id           bigint generated always as identity primary key,
  vehicle_id   text not null references public.vehicles (vehicle_id) on delete cascade,
  lat          double precision not null,
  lon          double precision not null,
  speed_kmh    real not null,
  packet_ts    timestamptz not null,
  received_at  timestamptz not null default now(),
  -- Received inside the Night Mode window: kept 24 hours instead of 7 days
  at_night     boolean not null default public.is_night(now())
);

create index telemetry_raw_vehicle_ts_idx on public.telemetry_raw (vehicle_id, packet_ts);
create index telemetry_raw_received_at_idx on public.telemetry_raw (received_at);

alter table public.telemetry_raw enable row level security;

revoke all on public.telemetry_raw from anon, authenticated;
grant all on public.telemetry_raw to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- telemetry_ingest_log: which team account sent which packet. Server-only audit trail for
-- tracing a wrong marker. Kept 30 days. Clients cannot see it.
-- ---------------------------------------------------------------------------
create table public.telemetry_ingest_log (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  vehicle_id   text,
  accepted     boolean not null,
  reason       text not null,
  received_at  timestamptz not null default now()
);

create index telemetry_ingest_log_received_at_idx on public.telemetry_ingest_log (received_at);

alter table public.telemetry_ingest_log enable row level security;

revoke all on public.telemetry_ingest_log from anon, authenticated;
grant all on public.telemetry_ingest_log to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- checkins: "I am waiting here" (PRD 7.5). One live check-in per user; it lasts
-- checkin_lifetime_min. Counts per station come from checkin_counts().
-- ---------------------------------------------------------------------------
create table public.checkins (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  route_id      text not null check (route_id ~ '^[A-Z0-9-]{1,16}$'),
  station_code  text not null check (station_code ~ '^[A-Z0-9]{2,8}$'),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index checkins_live_idx on public.checkins (route_id, station_code, expires_at);
create index checkins_user_idx on public.checkins (user_id, expires_at);

alter table public.checkins enable row level security;

revoke all on public.checkins from anon, authenticated;
grant select on public.checkins to authenticated;
grant all on public.checkins to service_role;

create policy "checkins: read own rows"
  on public.checkins for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- energy_ledger: every earn and spend (PRD 19, D1 and D14). The balance is the sum, capped by the
-- wallet. Each earning kind counts once per Manila day; passive refills at most twice a day.
-- `request_key` makes every call idempotent: the same key never books twice.
-- ---------------------------------------------------------------------------
create table public.energy_ledger (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('gps_report', 'no_gps_report', 'checkin', 'passive', 'tracking')),
  amount       numeric(4, 1) not null,
  manila_day   date not null,
  request_key  text not null check (char_length(request_key) between 8 and 64),
  created_at   timestamptz not null default now(),
  unique (user_id, request_key)
);

create index energy_ledger_user_day_idx on public.energy_ledger (user_id, manila_day, kind);

alter table public.energy_ledger enable row level security;

revoke all on public.energy_ledger from anon, authenticated;
grant select on public.energy_ledger to authenticated;
grant all on public.energy_ledger to service_role;

create policy "energy_ledger: read own rows"
  on public.energy_ledger for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- feed_posts: short reports from riders (PRD 19, D2): fixed fields and preset phrases only, no
-- coordinates and no free text. The author is shown by username. Hidden after
-- feed_flag_hide_count unique flags; gone after feed_lifetime_min. Clients never see user_id.
-- ---------------------------------------------------------------------------
create table public.feed_posts (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  author_username  text not null,
  route_id         text not null check (route_id ~ '^[A-Z0-9-]{1,16}$'),
  vehicle_id       text references public.vehicles (vehicle_id) on delete set null,
  phrase           text not null check (phrase in ('full', 'few_seats', 'not_moving', 'heavy_traffic', 'loading')),
  seat_tier        text check (seat_tier in ('green', 'amber', 'red')),
  with_gps         boolean not null,
  verified         boolean not null default false,
  hidden           boolean not null default false,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null
);

create index feed_posts_live_idx on public.feed_posts (route_id, expires_at);

alter table public.feed_posts enable row level security;

revoke all on public.feed_posts from anon, authenticated;
grant select (id, author_username, route_id, vehicle_id, phrase, seat_tier, with_gps, verified, created_at, expires_at)
  on public.feed_posts to authenticated;
grant all on public.feed_posts to service_role;

create policy "feed_posts: signed-in users read live, visible posts"
  on public.feed_posts for select to authenticated
  using (not hidden and expires_at > now());

-- feed_flags: one flag per user per post. Server-only; flag_post() writes it.
create table public.feed_flags (
  post_id     bigint not null references public.feed_posts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.feed_flags enable row level security;

revoke all on public.feed_flags from anon, authenticated;
grant all on public.feed_flags to service_role;
-- No policy on purpose: client roles are denied everything.

-- feed_review_queue: posts hidden by flags, for a team member to review in the dashboard
create table public.feed_review_queue (
  post_id    bigint primary key references public.feed_posts (id) on delete cascade,
  queued_at  timestamptz not null default now()
);

alter table public.feed_review_queue enable row level security;

revoke all on public.feed_review_queue from anon, authenticated;
grant all on public.feed_review_queue to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- Functions: the only way clients write. Each checks the caller and is safe to call twice.
-- ---------------------------------------------------------------------------

-- Sets the caller's username (unique, 3 to 20 letters, digits or _); creates the profile if needed
create function public.set_username(new_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if new_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'username must be 3 to 20 letters, digits or _' using errcode = '22023'; end if;
  insert into public.profiles (user_id, username) values (uid, new_username)
  on conflict (user_id) do update set username = excluded.username;
  return new_username;
exception
  when unique_violation then raise exception 'username taken' using errcode = '23505';
end;
$$;

-- Energy balance of the caller, capped by the wallet
create function public.energy_balance()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select least(coalesce(sum(l.amount), 0), (select c.energy_wallet_cap from public.app_config c))
  from public.energy_ledger l
  where l.user_id = (select auth.uid());
$$;

-- Books one earning for the caller (used by check_in and post_report, and passive refill).
-- Atomic per user (advisory lock), idempotent by request_key, once per kind per Manila day
-- (passive: up to energy_passive_daily_max), and never above the wallet cap. Returns the amount booked.
create function public.energy_earn(earn_kind text, request_key text)
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
  if not public.is_team_account() then raise exception 'team accounts only in v0' using errcode = '42501'; end if;
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

-- Passive refill: +energy_passive_amount when energy_passive_interval_h have passed since the last
-- passive credit (at most energy_passive_daily_max a Manila day). Called by the app on open.
create function public.energy_passive_refill()
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
  select max(l.created_at) into last_passive from public.energy_ledger l where l.user_id = uid and l.kind = 'passive';
  if last_passive is not null and last_passive > now() - make_interval(hours => cfg.energy_passive_interval_h) then
    return 0;
  end if;
  return public.energy_earn('passive', 'passive-' || to_char(now() at time zone cfg.night_tz, 'YYYYMMDD"T"HH24'));
end;
$$;

-- Starts a 30-minute tracking session: spends energy_tracking_cost, or nothing while
-- energy_enabled is off. Idempotent by request_key. Returns the session end time.
create function public.start_tracking(request_key text)
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
  if not public.is_team_account() then raise exception 'team accounts only in v0' using errcode = '42501'; end if;
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

-- Checks the caller in at a station (ends any live check-in first) and books the daily check-in energy
create function public.check_in(route text, station text, request_key text)
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
  if not public.is_team_account() then raise exception 'team accounts only in v0' using errcode = '42501'; end if;
  ends := now() + make_interval(mins => (select c.checkin_lifetime_min from public.app_config c));
  update public.checkins set expires_at = now() where user_id = uid and expires_at > now();
  insert into public.checkins (user_id, route_id, station_code, expires_at) values (uid, route, station, ends);
  perform public.energy_earn('checkin', check_in.request_key);
  return ends;
end;
$$;

-- Ends the caller's live check-in ("I boarded" or "Cancel")
create function public.end_check_in()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.checkins set expires_at = now() where user_id = (select auth.uid()) and expires_at > now();
$$;

-- People waiting per station on a route: live check-ins only. Team accounts only in v0.
create function public.checkin_counts(route text)
returns table (station_code text, waiting bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_team_account() then raise exception 'team accounts only in v0' using errcode = '42501'; end if;
  return query
    select c.station_code, count(*)::bigint
    from public.checkins c
    where c.route_id = route and c.expires_at > now()
    group by c.station_code;
end;
$$;

-- Posts a report to the feed (preset phrase, optional seat tier and vehicle, no coordinates) and
-- books the daily report energy (+1.0 with GPS, +0.5 without). Needs a username.
create function public.post_report(route text, phrase text, seat_tier text, vehicle text, with_gps boolean, request_key text)
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
  if not public.is_team_account() then raise exception 'team accounts only in v0' using errcode = '42501'; end if;
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

-- Flags a post; at feed_flag_hide_count unique flags it is hidden and queued for review
create function public.flag_post(post bigint)
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
  if not public.is_team_account() then raise exception 'team accounts only in v0' using errcode = '42501'; end if;
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

-- PRD 15.1: removes everything of the caller: profile, ledger, check-ins, posts and flags, then
-- the account itself (rows referencing it cascade)
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from public.feed_flags where user_id = uid;
  delete from public.feed_posts where user_id = uid;
  delete from public.checkins where user_id = uid;
  delete from public.energy_ledger where user_id = uid;
  delete from public.profiles where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

-- Functions are executable by PUBLIC by default; only signed-in users may call these
revoke execute on function public.is_team_account() from public, anon;
revoke execute on function public.is_night(timestamptz) from public, anon;
revoke execute on function public.manila_day(timestamptz) from public, anon;
revoke execute on function public.set_username(text) from public, anon;
revoke execute on function public.energy_balance() from public, anon;
revoke execute on function public.energy_earn(text, text) from public, anon, authenticated;
revoke execute on function public.energy_passive_refill() from public, anon;
revoke execute on function public.start_tracking(text) from public, anon;
revoke execute on function public.check_in(text, text, text) from public, anon;
revoke execute on function public.end_check_in() from public, anon;
revoke execute on function public.checkin_counts(text) from public, anon;
revoke execute on function public.post_report(text, text, text, text, boolean, text) from public, anon;
revoke execute on function public.flag_post(bigint) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;

grant execute on function public.is_team_account() to authenticated;
grant execute on function public.is_night(timestamptz) to authenticated;
grant execute on function public.manila_day(timestamptz) to authenticated;
grant execute on function public.set_username(text) to authenticated;
grant execute on function public.energy_balance() to authenticated;
grant execute on function public.energy_passive_refill() to authenticated;
grant execute on function public.start_tracking(text) to authenticated;
grant execute on function public.check_in(text, text, text) to authenticated;
grant execute on function public.end_check_in() to authenticated;
grant execute on function public.checkin_counts(text) to authenticated;
grant execute on function public.post_report(text, text, text, text, boolean, text) to authenticated;
grant execute on function public.flag_post(bigint) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
-- energy_earn is internal: called only from check_in, post_report and energy_passive_refill
