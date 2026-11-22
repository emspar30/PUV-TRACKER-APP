-- Automatic moderation and the console's Moderation page (owner decisions, 2026-11-23; PRD 11.2,
-- 11.3, 9.5). Builds on 20261102000002_moderation.sql and the device ban (20261122000001).
--
-- The rules:
-- 1. A flag tells the post's author at once: an in-app notice with the flag's tag, never who flagged.
-- 2. A post hidden by feed_flag_hide_count weighted flags gives its author a strike automatically
--    when it was not a verified ride (reason flagged_unverified). A risk event still gives
--    auto_evidence, as before. A hidden verified ride gives no strike: the evidence conflicts, so it
--    waits on the console's Moderation page for an admin to confirm or dismiss it.
-- 3. suspension_strikes strikes within suspension_window_days suspend for suspension_days (as before).
-- 4. After a suspension, ban_strikes new strikes (made after that suspension started) within
--    suspension_window_days ban the account. A ban is stored as suspended_until 100 years ahead, so
--    every existing check (may_participate, the ingest function, the device ban) applies it unchanged;
--    more than 10 years ahead reads as a ban.
-- 5. An upheld appeal (or a dismissed report) lifts its strike, and a suspension or ban the rules set
--    is lifted when it no longer has enough strikes behind it. One set by hand on the console, or
--    copied from another account on the same device, is lifted only by hand.
-- 6. Every automatic and console moderation action goes into moderation_log, which the console's Admin
--    activity list shows with the driver-side log. The rider's notices go into moderation_notices.
--
-- The console shows usernames only: no location, no destination, no contact details. Flag notes (at
-- most 200 characters, written by the flagger) are shown to the admin as they are.
--
-- One rule is replaced: the strikes.reason check gains 'flagged_unverified' (the old check is found by
-- its text, removed and added again with the new value; no row changes). No other row is changed.

-- ---------------------------------------------------------------------------
-- Settings, columns and tables
-- ---------------------------------------------------------------------------
alter table public.app_config
  add column ban_strikes smallint not null default 2,
  add column moderation_list_days smallint not null default 7;

alter table public.profiles
  -- How many times the account was suspended or banned; the first one makes the ban rule apply
  add column suspensions smallint not null default 0 check (suspensions >= 0),
  add column last_suspended_at timestamptz,
  -- The strike rules set the current suspension, so they may also lift it
  add column suspension_by_rules boolean not null default false;

alter table public.feed_posts
  add column reviewed_at timestamptz,
  add column review_outcome text check (review_outcome in ('confirmed', 'dismissed'));

do $$
declare
  old_check text;
begin
  select c.conname into old_check
  from pg_constraint c
  where c.conrelid = 'public.strikes'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%confirmed_report%';
  if old_check is not null then
    execute format('alter table public.strikes drop constraint %I', old_check);
  end if;
end;
$$;

alter table public.strikes
  add constraint strikes_reason_check check (reason in ('confirmed_report', 'auto_evidence', 'flagged_unverified'));

create table public.moderation_notices (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('flagged', 'strike', 'shielded', 'suspended', 'banned', 'lifted', 'appeal_upheld', 'appeal_denied')),
  tag         text check (tag in ('false_location', 'spamming', 'not_a_puv')),
  post_id     bigint references public.feed_posts (id) on delete set null,
  until       timestamptz,
  created_at  timestamptz not null default now(),
  seen        boolean not null default false
);
create index moderation_notices_unseen on public.moderation_notices (user_id, created_at desc) where not seen;
alter table public.moderation_notices enable row level security;
revoke all on public.moderation_notices from anon, authenticated;
grant all on public.moderation_notices to service_role;
-- No policy on purpose: the rider reads their own through my_moderation()

create table public.moderation_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  -- The admin who acted; null for the automatic rules
  actor   uuid references auth.users (id) on delete set null,
  action  text not null check (action in ('confirm', 'dismiss', 'strike', 'suspend', 'ban', 'lift', 'appeal_upheld', 'appeal_denied')),
  target  text check (char_length(target) <= 80),
  detail  text check (char_length(detail) <= 200)
);
create index moderation_log_at on public.moderation_log (at desc);
alter table public.moderation_log enable row level security;
revoke all on public.moderation_log from anon, authenticated;
grant all on public.moderation_log to service_role;
-- No policy on purpose: the console reads it through console_admin_log()

-- ---------------------------------------------------------------------------
-- Internal helpers (no client may call them)
-- ---------------------------------------------------------------------------

-- How the console and the log name an account: its username
create function public.moderation_name(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select '@' || p.username from public.profiles p where p.user_id = uid and p.username is not null), 'account ' || left(uid::text, 8));
$$;

create function public.moderation_record(by_admin boolean, act text, uid uuid, note text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.moderation_log (actor, action, target, detail)
  values (case when by_admin then (select auth.uid()) else null end, act, public.moderation_name(uid), left(note, 200));
$$;

create function public.moderation_notify(uid uuid, what text, flag_tag text, post bigint, ends timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.moderation_notices (user_id, kind, tag, post_id, until) values (uid, what, flag_tag, post, ends);
$$;

-- ---------------------------------------------------------------------------
-- The rules, replaced in place (same names and arguments as in 20261102000002_moderation.sql)
-- ---------------------------------------------------------------------------

-- Suspends, bans, or lifts what the rules set (see rules 3 to 5 above)
create or replace function public.moderation_settle(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.app_config;
  prof public.profiles;
  since timestamptz;
  total int;
  fresh int;
  banned boolean;
  ends timestamptz;
begin
  select * into cfg from public.app_config;
  select * into prof from public.profiles p where p.user_id = uid for update;
  if prof.user_id is null then return; end if;
  since := now() - make_interval(days => cfg.suspension_window_days);
  total := public.active_strikes(uid, since);
  fresh := case when prof.last_suspended_at is null then 0 else public.active_strikes(uid, greatest(since, prof.last_suspended_at)) end;
  banned := coalesce(prof.suspended_until > now() + interval '10 years', false);

  if coalesce(prof.suspended_until > now(), false) then
    -- An upheld appeal or a dismissed report may have taken its cause away
    if prof.suspension_by_rules
       and ((banned and fresh < cfg.ban_strikes) or (not banned and total < cfg.suspension_strikes)) then
      update public.profiles p
         set suspended_until = null, suspensions = greatest(p.suspensions - 1, 0), suspension_by_rules = false
       where p.user_id = uid;
      perform public.moderation_notify(uid, 'lifted', null, null, null);
      perform public.moderation_record(false, 'lift', uid, case when banned then 'Ban' else 'Suspension' end || ' no longer has enough strikes');
    end if;
  elsif prof.suspensions = 0 then
    if total >= cfg.suspension_strikes then
      ends := now() + make_interval(days => cfg.suspension_days);
      update public.profiles p
         set suspended_until = ends, suspensions = 1, last_suspended_at = now(), suspension_by_rules = true
       where p.user_id = uid;
      perform public.moderation_notify(uid, 'suspended', null, null, ends);
      perform public.moderation_record(false, 'suspend', uid, format('%s strikes within %s days: %s days', total, cfg.suspension_window_days, cfg.suspension_days));
    end if;
  elsif fresh >= cfg.ban_strikes then
    ends := now() + interval '100 years';
    update public.profiles p
       set suspended_until = ends, suspensions = p.suspensions + 1, last_suspended_at = now(), suspension_by_rules = true
     where p.user_id = uid;
    perform public.moderation_notify(uid, 'banned', null, null, ends);
    perform public.moderation_record(false, 'ban', uid, format('%s strikes after a suspension', fresh));
  end if;
end;
$$;

-- A strike for the author: absorbed by a Merit point when they have one left, else counted. The
-- author is told either way.
create or replace function public.strike_author(uid uuid, post bigint, strike_reason text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.app_config;
  prof public.profiles;
  merit int;
  new_id bigint;
begin
  select * into cfg from public.app_config;
  select * into prof from public.profiles p where p.user_id = uid for update;
  merit := least(cfg.merit_max, coalesce(prof.trust_points, 0) / greatest(cfg.merit_points_per, 1)) - coalesce(prof.merit_used, 0);
  insert into public.strikes (user_id, post_id, reason, expires_at, absorbed)
  values (uid, post, strike_reason, now() + make_interval(days => cfg.strike_expiry_days), merit > 0)
  returning id into new_id;
  if merit > 0 then
    update public.profiles p set merit_used = p.merit_used + 1, shield_notice = true where p.user_id = uid;
  end if;
  perform public.moderation_notify(uid, case when merit > 0 then 'shielded' else 'strike' end, null, post, null);
  perform public.moderation_record(false, 'strike', uid, strike_reason || case when merit > 0 then ', taken by a Merit shield' else '' end);
  perform public.moderation_settle(uid);
  return new_id;
end;
$$;

-- A tagged flag, as in 20261102000002_moderation.sql, plus rules 1 and 2: the author is told, and a
-- hidden post that was not a verified ride gives a strike
create or replace function public.flag_report(post bigint, tag text, note text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.app_config;
  joined timestamptz;
  trusted boolean;
  author uuid;
  ride_verified boolean;
  same_author int;
  recent int;
  is_weighted boolean;
  added int;
  weight int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.may_participate() then raise exception 'sign in to take part' using errcode = '42501'; end if;
  if flag_report.tag not in ('false_location', 'spamming', 'not_a_puv') then raise exception 'bad tag' using errcode = '22023'; end if;
  select * into cfg from public.app_config;
  select p.created_at, p.trust_points >= cfg.trust_badge_points into joined, trusted from public.profiles p where p.user_id = uid;
  if coalesce(joined, now()) > now() - make_interval(days => cfg.flag_min_account_days) and not coalesce(trusted, false) then
    raise exception 'flag_too_new' using errcode = 'P0002';
  end if;
  if (select count(*) from public.feed_flags f where f.user_id = uid and f.created_at > now() - interval '1 day') >= cfg.flag_daily_max then
    raise exception 'flag_limit' using errcode = 'P0002';
  end if;
  select f.user_id, f.verified into author, ride_verified from public.feed_posts f where f.id = flag_report.post;
  if author is null then return false; end if;
  -- Weight: not a new account, and not mostly flagging this one author (3 or more of the last 5)
  select count(*) into recent from (select 1 from public.feed_flags f where f.user_id = uid order by f.created_at desc limit 5) x;
  select count(*) into same_author from (
    select fp.user_id from public.feed_flags f join public.feed_posts fp on fp.id = f.post_id
     where f.user_id = uid order by f.created_at desc limit 5
  ) x where x.user_id = author;
  is_weighted := coalesce(joined, now()) <= now() - make_interval(hours => cfg.flag_weight_min_age_h) and not (recent >= 3 and same_author >= 3);
  insert into public.feed_flags (post_id, user_id, tag, note, weighted)
  values (flag_report.post, uid, flag_report.tag, nullif(left(flag_report.note, 200), ''), is_weighted)
  on conflict do nothing;
  get diagnostics added = row_count;
  -- Rule 1: the author is told (never who flagged)
  if added = 1 and author <> uid then
    perform public.moderation_notify(author, 'flagged', flag_report.tag, flag_report.post, null);
  end if;
  select count(*) into weight from public.feed_flags f
   where f.post_id = flag_report.post and f.weighted and f.created_at > now() - make_interval(hours => cfg.flag_window_h);
  if weight >= cfg.feed_flag_hide_count then
    update public.feed_posts set hidden = true where id = flag_report.post and not hidden;
    if found then
      insert into public.feed_review_queue (post_id) values (flag_report.post) on conflict do nothing;
      if exists (select 1 from public.risk_events e where e.user_id = author and e.at > now() - interval '1 day') then
        perform public.strike_author(author, flag_report.post, 'auto_evidence');
      elsif not coalesce(ride_verified, false) then
        -- Rule 2: hidden and not a verified ride. A verified ride waits for an admin instead.
        perform public.strike_author(author, flag_report.post, 'flagged_unverified');
      end if;
    end if;
    return true;
  end if;
  return false;
end;
$$;

-- The device ban's trigger, as in 20261122000001_device_ban.sql, except that a copied suspension is
-- marked as not set by the strike rules, so only an admin (or lifting the original) lifts it
create or replace function public.share_device_suspension()
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
    update public.profiles p set suspended_until = new.suspended_until, suspension_by_rules = false
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

-- The rider's own moderation state, as before, plus whether the account is banned and its unseen
-- notices (newest first)
create or replace function public.my_moderation()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.app_config;
  prof public.profiles;
  total int;
  clean int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into cfg from public.app_config;
  select * into prof from public.profiles p where p.user_id = uid;
  select count(*), count(*) filter (where not f.hidden and not exists (select 1 from public.strikes s where s.post_id = f.id and not s.lifted))
    into total, clean
    from public.feed_posts f
   where f.user_id = uid and f.created_at > now() - make_interval(days => cfg.trust_level_window_days);
  return jsonb_build_object(
    'trust_level', case when total >= cfg.trust_level_min_reports then round(100.0 * clean / total) else null end,
    'reports', total,
    'merit', greatest(least(cfg.merit_max, coalesce(prof.trust_points, 0) / greatest(cfg.merit_points_per, 1)) - coalesce(prof.merit_used, 0), 0),
    'suspended_until', case when prof.suspended_until > now() then prof.suspended_until else null end,
    'banned', coalesce(prof.suspended_until > now() + interval '10 years', false),
    'shield_notice', coalesce(prof.shield_notice, false),
    'strikes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'reason', s.reason, 'created_at', s.created_at, 'expires_at', s.expires_at,
        'absorbed', s.absorbed, 'lifted', s.lifted, 'appeal_state', s.appeal_state
      ) order by s.created_at desc)
      from public.strikes s where s.user_id = uid and s.expires_at > now()
    ), '[]'::jsonb),
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'tag', n.tag, 'until', n.until, 'created_at', n.created_at) order by n.created_at desc)
      from (
        select x.id, x.kind, x.tag, x.until, x.created_at from public.moderation_notices x
         where x.user_id = uid and not x.seen order by x.created_at desc limit 20
      ) n
    ), '[]'::jsonb)
  );
end;
$$;

-- The rider has seen their notices
create function public.ack_moderation_notices()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.moderation_notices n set seen = true where n.user_id = (select auth.uid()) and not n.seen;
$$;

-- ---------------------------------------------------------------------------
-- The console's Moderation page (admins with the second factor only: is_admin())
-- ---------------------------------------------------------------------------

-- What waits for the admin: hidden verified rides not yet decided, and appeals
create function public.console_moderation_waiting()
returns table (reviews integer, appeals integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg public.app_config;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select * into cfg from public.app_config;
  return query
  select
    (select count(*)::integer from public.feed_posts f
      where f.hidden and f.verified and f.reviewed_at is null
        and f.created_at > now() - make_interval(days => cfg.moderation_list_days)
        and not exists (select 1 from public.strikes s where s.post_id = f.id and not s.lifted)),
    (select count(*)::integer from public.appeals a where a.decided_at is null);
end;
$$;

-- Flagged posts of the last moderation_list_days not yet reviewed, with the evidence: the ride check,
-- the beacon check, the flags (weighted or not, tags, notes), the author's risk events around the post
-- and their strikes. Posts that need the admin come first.
create function public.console_flagged_posts()
returns table (
  post_id bigint,
  author_id uuid,
  author text,
  route_id text,
  phrase text,
  stop_code text,
  posted_at timestamptz,
  live_map boolean,
  hidden boolean,
  verified boolean,
  beacon_ok boolean,
  with_gps boolean,
  flags integer,
  weighted_flags integer,
  tags text[],
  notes text[],
  risk_events integer,
  struck boolean,
  author_strikes integer,
  author_suspended_until timestamptz,
  needs_review boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  cfg public.app_config;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select * into cfg from public.app_config;
  return query
  select f.id, f.user_id, '@' || f.author_username, f.route_id, f.phrase, f.stop_code, f.created_at, f.live_map,
         f.hidden, f.verified, f.beacon_ok, f.with_gps, fl.n, fl.w, fl.tags, fl.notes,
         (select count(*)::integer from public.risk_events e
           where e.user_id = f.user_id and e.at between f.created_at - interval '1 day' and f.created_at + interval '1 day'),
         st.struck,
         public.active_strikes(f.user_id, now() - make_interval(days => cfg.suspension_window_days)),
         case when p.suspended_until > now() then p.suspended_until else null end,
         f.hidden and f.verified and not st.struck
  from public.feed_posts f
  left join public.profiles p on p.user_id = f.user_id
  cross join lateral (
    select count(*)::integer as n,
           (count(*) filter (where g.weighted))::integer as w,
           coalesce(array_agg(distinct g.tag) filter (where g.tag is not null), '{}'::text[]) as tags,
           coalesce(array_agg(g.note order by g.created_at) filter (where g.note is not null), '{}'::text[]) as notes
    from public.feed_flags g where g.post_id = f.id
  ) fl
  cross join lateral (
    select exists (select 1 from public.strikes s where s.post_id = f.id and not s.lifted) as struck
  ) st
  where fl.n > 0 and f.reviewed_at is null
    and f.created_at > now() - make_interval(days => cfg.moderation_list_days)
  order by 21 desc, 9 desc, 7 desc
  limit 200;
end;
$$;

-- The admin confirms a flagged post was false: a strike for its author (unless one is already on it)
create function public.console_confirm_report(post bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
  new_id bigint;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select f.user_id into author from public.feed_posts f where f.id = console_confirm_report.post for update;
  if author is null then raise exception 'no_such_post' using errcode = 'P0002'; end if;
  if exists (select 1 from public.strikes s where s.post_id = console_confirm_report.post and not s.lifted) then
    raise exception 'already_struck' using errcode = 'P0002';
  end if;
  new_id := public.strike_author(author, console_confirm_report.post, 'confirmed_report');
  update public.feed_posts f set hidden = true, reviewed_at = now(), review_outcome = 'confirmed' where f.id = console_confirm_report.post;
  perform public.moderation_record(true, 'confirm', author, 'Post ' || console_confirm_report.post);
  return new_id;
end;
$$;

-- The admin finds the flags wrong: the post shows again, and a strike it gave is lifted (with the Merit
-- point it used, and any suspension it caused)
create function public.console_dismiss_report(post bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
  s public.strikes;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select f.user_id into author from public.feed_posts f where f.id = console_dismiss_report.post for update;
  if author is null then raise exception 'no_such_post' using errcode = 'P0002'; end if;
  update public.feed_posts f set hidden = false, reviewed_at = now(), review_outcome = 'dismissed' where f.id = console_dismiss_report.post;
  for s in select * from public.strikes x where x.post_id = console_dismiss_report.post and not x.lifted loop
    update public.strikes x
       set lifted = true, appeal_state = case when x.appeal_state = 'pending' then 'upheld' else x.appeal_state end
     where x.id = s.id;
    update public.appeals a set decided_at = now(), upheld = true where a.strike_id = s.id and a.decided_at is null;
    if s.absorbed then
      update public.profiles p set merit_used = greatest(p.merit_used - 1, 0) where p.user_id = s.user_id;
    end if;
  end loop;
  perform public.moderation_settle(author);
  perform public.moderation_record(true, 'dismiss', author, 'Post ' || console_dismiss_report.post);
end;
$$;

-- Appeals waiting for a decision, oldest first, with the strike and its post
create function public.console_appeals()
returns table (
  appeal_id bigint,
  account_id uuid,
  account text,
  body text,
  appealed_at timestamptz,
  strike_reason text,
  struck_at timestamptz,
  post_id bigint,
  route_id text,
  phrase text,
  verified boolean,
  beacon_ok boolean,
  flags integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
  select a.id, a.user_id, public.moderation_name(a.user_id), a.body, a.created_at, s.reason, s.created_at,
         f.id, f.route_id, f.phrase, f.verified, f.beacon_ok,
         (select count(*)::integer from public.feed_flags g where g.post_id = f.id)
  from public.appeals a
  join public.strikes s on s.id = a.strike_id
  left join public.feed_posts f on f.id = s.post_id
  where a.decided_at is null
  order by a.created_at
  limit 200;
end;
$$;

-- Decide an appeal (admin_decide_appeal does the rest) and tell the rider
create function public.console_decide_appeal(appeal bigint, upheld boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select a.user_id into who from public.appeals a where a.id = console_decide_appeal.appeal and a.decided_at is null;
  if who is null then raise exception 'no_such_appeal' using errcode = 'P0002'; end if;
  perform public.admin_decide_appeal(console_decide_appeal.appeal, console_decide_appeal.upheld);
  perform public.moderation_notify(who, case when console_decide_appeal.upheld then 'appeal_upheld' else 'appeal_denied' end, null, null, null);
  perform public.moderation_record(true, case when console_decide_appeal.upheld then 'appeal_upheld' else 'appeal_denied' end, who, 'Appeal ' || console_decide_appeal.appeal);
end;
$$;

-- Accounts suspended or banned now
create function public.console_suspensions()
returns table (account_id uuid, account text, suspended_until timestamptz, banned boolean, by_rules boolean, suspensions integer, strikes_now integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  cfg public.app_config;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select * into cfg from public.app_config;
  return query
  select p.user_id, public.moderation_name(p.user_id), p.suspended_until, p.suspended_until > now() + interval '10 years',
         p.suspension_by_rules, p.suspensions::integer,
         public.active_strikes(p.user_id, now() - make_interval(days => cfg.suspension_window_days))
  from public.profiles p
  where p.suspended_until > now()
  order by p.suspended_until desc
  limit 200;
end;
$$;

-- Accounts whose username starts with the text typed (at least 2 characters), for a manual suspension
create function public.console_find_accounts(name_start text)
returns table (account_id uuid, account text, suspended_until timestamptz, strikes_now integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  cfg public.app_config;
  q text := lower(trim(leading '@' from trim(name_start)));
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if char_length(q) < 2 then return; end if;
  select * into cfg from public.app_config;
  return query
  select p.user_id, '@' || p.username, case when p.suspended_until > now() then p.suspended_until else null end,
         public.active_strikes(p.user_id, now() - make_interval(days => cfg.suspension_window_days))
  from public.profiles p
  where p.username is not null and lower(left(p.username, char_length(q))) = q
  order by p.username
  limit 10;
end;
$$;

-- A suspension (1 to 30 days) or a ban set by hand, with one of five reasons. It counts as a
-- suspension for the ban rule, and the device ban copies it to the accounts on the same device.
create function public.console_suspend(account uuid, days integer, permanent boolean, reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ends timestamptz;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if console_suspend.reason not in ('false_location', 'spamming', 'not_a_puv', 'abusive', 'other') then
    raise exception 'bad_reason' using errcode = '22023';
  end if;
  if not console_suspend.permanent and (console_suspend.days is null or console_suspend.days < 1 or console_suspend.days > 30) then
    raise exception 'bad_days' using errcode = '22023';
  end if;
  if exists (select 1 from public.admin_accounts a where a.user_id = console_suspend.account) then
    raise exception 'is_admin_account' using errcode = '22023';
  end if;
  ends := case when console_suspend.permanent then now() + interval '100 years' else now() + make_interval(days => console_suspend.days) end;
  update public.profiles p
     set suspended_until = greatest(case when p.suspended_until > now() then p.suspended_until else null end, ends),
         suspensions = p.suspensions + 1, last_suspended_at = now(), suspension_by_rules = false
   where p.user_id = console_suspend.account
  returning p.suspended_until into ends;
  if ends is null then raise exception 'no_such_account' using errcode = 'P0002'; end if;
  perform public.moderation_notify(console_suspend.account, case when console_suspend.permanent then 'banned' else 'suspended' end, null, null, ends);
  perform public.moderation_record(true, case when console_suspend.permanent then 'ban' else 'suspend' end, console_suspend.account,
    console_suspend.reason || case when console_suspend.permanent then '' else format(', %s days', console_suspend.days) end);
  return ends;
end;
$$;

-- Lift a suspension or ban early (the device ban lifts its copies too)
create function public.console_lift(account uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was timestamptz;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select p.suspended_until into was from public.profiles p where p.user_id = console_lift.account for update;
  if was is null or was <= now() then raise exception 'not_suspended' using errcode = 'P0002'; end if;
  update public.profiles p
     set suspended_until = null, suspension_by_rules = false, suspensions = greatest(p.suspensions - 1, 0)
   where p.user_id = console_lift.account;
  perform public.moderation_notify(console_lift.account, 'lifted', null, null, null);
  perform public.moderation_record(true, 'lift', console_lift.account, case when was > now() + interval '10 years' then 'Ban' else 'Suspension' end);
end;
$$;

-- The console's Admin activity list, as in 20261122000003_admin_log.sql, now with the moderation log
create or replace function public.console_admin_log(max_rows integer)
returns table (at timestamptz, actor uuid, action text, target text, detail text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
  select x.at, x.actor, x.action, x.target, x.detail
  from (
    select l.at, l.actor, l.action, l.target, l.detail from public.admin_log l
    union all
    select m.at, m.actor, m.action, m.target, m.detail from public.moderation_log m
  ) x
  order by x.at desc
  limit least(greatest(max_rows, 1), 500);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Functions are executable by PUBLIC by default; create or replace keeps the old grants,
-- repeated here so this file stands on its own.
-- ---------------------------------------------------------------------------
revoke execute on function public.moderation_name(uuid) from public, anon, authenticated;
revoke execute on function public.moderation_record(boolean, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.moderation_notify(uuid, text, text, bigint, timestamptz) from public, anon, authenticated;
revoke execute on function public.moderation_settle(uuid) from public, anon, authenticated;
revoke execute on function public.strike_author(uuid, bigint, text) from public, anon, authenticated;
revoke execute on function public.share_device_suspension() from public, anon, authenticated;
revoke execute on function public.flag_report(bigint, text, text) from public, anon;
revoke execute on function public.my_moderation() from public, anon;
revoke execute on function public.ack_moderation_notices() from public, anon;
revoke execute on function public.console_moderation_waiting() from public, anon;
revoke execute on function public.console_flagged_posts() from public, anon;
revoke execute on function public.console_confirm_report(bigint) from public, anon;
revoke execute on function public.console_dismiss_report(bigint) from public, anon;
revoke execute on function public.console_appeals() from public, anon;
revoke execute on function public.console_decide_appeal(bigint, boolean) from public, anon;
revoke execute on function public.console_suspensions() from public, anon;
revoke execute on function public.console_find_accounts(text) from public, anon;
revoke execute on function public.console_suspend(uuid, integer, boolean, text) from public, anon;
revoke execute on function public.console_lift(uuid) from public, anon;
revoke execute on function public.console_admin_log(integer) from public, anon;
grant execute on function public.flag_report(bigint, text, text) to authenticated;
grant execute on function public.my_moderation() to authenticated;
grant execute on function public.ack_moderation_notices() to authenticated;
grant execute on function public.console_moderation_waiting() to authenticated;
grant execute on function public.console_flagged_posts() to authenticated;
grant execute on function public.console_confirm_report(bigint) to authenticated;
grant execute on function public.console_dismiss_report(bigint) to authenticated;
grant execute on function public.console_appeals() to authenticated;
grant execute on function public.console_decide_appeal(bigint, boolean) to authenticated;
grant execute on function public.console_suspensions() to authenticated;
grant execute on function public.console_find_accounts(text) to authenticated;
grant execute on function public.console_suspend(uuid, integer, boolean, text) to authenticated;
grant execute on function public.console_lift(uuid) to authenticated;
grant execute on function public.console_admin_log(integer) to authenticated;
