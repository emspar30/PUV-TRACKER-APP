-- MOD1a (PRD 11.2, 11.3; 2026-11-02): moderation. Tagged flags with eligibility, weight and a daily
-- limit; strikes from a moderator's confirmation or automatic evidence; a 7-day suspension after 2
-- strikes in 30 days (account only, D7); Merit shields; appeals; the rider's Trust Level. The same rules
-- are in src/shared/moderation/rules.ts (tested there).
--
-- Adapted to the prototype: Merit comes from the existing trust points (B6: one point per check-in or
-- relay, at most 3 a day), one Merit point per merit_points_per trust points, at most merit_max. Flag
-- eligibility needs an account at least flag_min_account_days old or the Trusted badge; Crowdsource posts
-- have no marker to view, so the "viewed the marker" rule does not apply to them.

alter table public.app_config
  add column flag_min_account_days smallint not null default 7,
  add column flag_weight_min_age_h smallint not null default 48,
  add column flag_daily_max smallint not null default 10,
  add column flag_window_h smallint not null default 24,
  add column strike_expiry_days smallint not null default 60,
  add column suspension_strikes smallint not null default 2,
  add column suspension_window_days smallint not null default 30,
  add column suspension_days smallint not null default 7,
  add column appeal_window_days smallint not null default 30,
  add column merit_points_per smallint not null default 100,
  add column merit_max smallint not null default 3,
  add column trust_level_min_reports smallint not null default 10,
  add column trust_level_window_days smallint not null default 30;

alter table public.profiles
  add column suspended_until timestamptz,
  add column merit_used smallint not null default 0 check (merit_used >= 0),
  -- A Merit point absorbed a strike: the rider is told once (ack_shield_notice)
  add column shield_notice boolean not null default false;

alter table public.feed_flags
  add column tag text check (tag in ('false_location', 'spamming', 'not_a_puv')),
  add column note text check (char_length(note) <= 200),
  -- Counts toward hiding: the flagger's account is old enough and does not mostly flag one author
  add column weighted boolean not null default true;

create table public.strikes (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  post_id       bigint references public.feed_posts (id) on delete set null,
  reason        text not null check (reason in ('confirmed_report', 'auto_evidence')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  -- A Merit point took it instead
  absorbed      boolean not null default false,
  -- An upheld appeal lifted it
  lifted        boolean not null default false,
  appeal_state  text not null default 'none' check (appeal_state in ('none', 'pending', 'upheld', 'rejected'))
);
create index strikes_user_idx on public.strikes (user_id, created_at desc);
alter table public.strikes enable row level security;
revoke all on public.strikes from anon, authenticated;
grant all on public.strikes to service_role;

create table public.appeals (
  id          bigint generated always as identity primary key,
  strike_id   bigint not null unique references public.strikes (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  upheld      boolean
);
alter table public.appeals enable row level security;
revoke all on public.appeals from anon, authenticated;
grant all on public.appeals to service_role;

-- A strike counts: not absorbed, not lifted, not expired
create function public.active_strikes(uid uuid, since timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.strikes s
   where s.user_id = uid and not s.absorbed and not s.lifted and s.expires_at > now() and s.created_at >= since;
$$;

-- Suspends for suspension_days when suspension_strikes count within suspension_window_days; lifts an
-- unexpired suspension when they no longer do (an upheld appeal)
create function public.moderation_settle(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.app_config;
begin
  select * into cfg from public.app_config;
  if public.active_strikes(uid, now() - make_interval(days => cfg.suspension_window_days)) >= cfg.suspension_strikes then
    update public.profiles p
       set suspended_until = greatest(coalesce(p.suspended_until, now()), now() + make_interval(days => cfg.suspension_days))
     where p.user_id = uid and (p.suspended_until is null or p.suspended_until < now());
  else
    update public.profiles p set suspended_until = null where p.user_id = uid and p.suspended_until > now();
  end if;
end;
$$;

-- A strike for the author: absorbed by a Merit point when they have one left, else counted
create function public.strike_author(uid uuid, post bigint, strike_reason text)
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
  perform public.moderation_settle(uid);
  return new_id;
end;
$$;

-- Not suspended, on top of the open-signup rule
create or replace function public.may_participate()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and ((select c.open_signup from public.app_config c) or public.is_team_account())
    and not exists (
      select 1 from public.profiles p
       where p.user_id = (select auth.uid()) and p.suspended_until is not null and p.suspended_until > now()
    );
$$;

-- A tagged flag. The flagger must be eligible (account old enough, or Trusted) and under the daily
-- limit; one flag per post. Only weighted flags within flag_window_h hide the post. When a hidden
-- post's author has a risk event (RK1) in the last day, that is automatic evidence: a strike.
create function public.flag_report(post bigint, tag text, note text)
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
  same_author int;
  recent int;
  is_weighted boolean;
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
  select f.user_id into author from public.feed_posts f where f.id = flag_report.post;
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
  select count(*) into weight from public.feed_flags f
   where f.post_id = flag_report.post and f.weighted and f.created_at > now() - make_interval(hours => cfg.flag_window_h);
  if weight >= cfg.feed_flag_hide_count then
    update public.feed_posts set hidden = true where id = flag_report.post and not hidden;
    if found then
      insert into public.feed_review_queue (post_id) values (flag_report.post) on conflict do nothing;
      if exists (select 1 from public.risk_events e where e.user_id = author and e.at > now() - interval '1 day') then
        perform public.strike_author(author, flag_report.post, 'auto_evidence');
      end if;
    end if;
    return true;
  end if;
  return false;
end;
$$;

-- A moderator confirms a flagged report: a strike for its author (run from the dashboard or the console)
create function public.admin_confirm_report(post bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
begin
  if not (public.is_admin() or (select auth.role()) = 'service_role') then raise exception 'admins only' using errcode = '42501'; end if;
  select f.user_id into author from public.feed_posts f where f.id = admin_confirm_report.post;
  if author is null then raise exception 'no such post' using errcode = 'P0002'; end if;
  return public.strike_author(author, admin_confirm_report.post, 'confirmed_report');
end;
$$;

-- The rider appeals their own strike, once, within appeal_window_days
create function public.appeal_strike(strike bigint, body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s public.strikes;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into s from public.strikes x where x.id = appeal_strike.strike and x.user_id = uid;
  if s.id is null then raise exception 'no such strike' using errcode = 'P0002'; end if;
  if s.appeal_state <> 'none' then raise exception 'appeal_exists' using errcode = 'P0002'; end if;
  if s.created_at < now() - make_interval(days => (select c.appeal_window_days from public.app_config c)) then
    raise exception 'appeal_too_late' using errcode = 'P0002';
  end if;
  insert into public.appeals (strike_id, user_id, body) values (s.id, uid, left(trim(appeal_strike.body), 500));
  update public.strikes x set appeal_state = 'pending' where x.id = s.id;
end;
$$;

-- A moderator decides: upheld lifts the strike, gives back a Merit point it used, and lifts a
-- suspension it caused
create function public.admin_decide_appeal(appeal bigint, upheld boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appeals;
  s public.strikes;
begin
  if not (public.is_admin() or (select auth.role()) = 'service_role') then raise exception 'admins only' using errcode = '42501'; end if;
  select * into a from public.appeals x where x.id = admin_decide_appeal.appeal for update;
  if a.id is null then raise exception 'no such appeal' using errcode = 'P0002'; end if;
  update public.appeals x set decided_at = now(), upheld = admin_decide_appeal.upheld where x.id = a.id;
  select * into s from public.strikes x where x.id = a.strike_id;
  update public.strikes x
     set appeal_state = case when admin_decide_appeal.upheld then 'upheld' else 'rejected' end,
         lifted = admin_decide_appeal.upheld
   where x.id = s.id;
  if admin_decide_appeal.upheld and s.absorbed then
    update public.profiles p set merit_used = greatest(p.merit_used - 1, 0) where p.user_id = s.user_id;
  end if;
  perform public.moderation_settle(s.user_id);
end;
$$;

-- The rider's own moderation state: Trust Level (after trust_level_min_reports posts in the window,
-- the share neither hidden by flags nor struck), Merit left, suspension, strikes, and the shield notice
create function public.my_moderation()
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
    'shield_notice', coalesce(prof.shield_notice, false),
    'strikes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'reason', s.reason, 'created_at', s.created_at, 'expires_at', s.expires_at,
        'absorbed', s.absorbed, 'lifted', s.lifted, 'appeal_state', s.appeal_state
      ) order by s.created_at desc)
      from public.strikes s where s.user_id = uid and s.expires_at > now()
    ), '[]'::jsonb)
  );
end;
$$;

create function public.ack_shield_notice()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p set shield_notice = false where p.user_id = (select auth.uid());
$$;

-- The old untagged flag is replaced by flag_report
revoke execute on function public.flag_post(bigint) from authenticated;

revoke execute on function public.active_strikes(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.moderation_settle(uuid) from public, anon, authenticated;
revoke execute on function public.strike_author(uuid, bigint, text) from public, anon, authenticated;
revoke execute on function public.flag_report(bigint, text, text) from public, anon;
grant execute on function public.flag_report(bigint, text, text) to authenticated;
revoke execute on function public.admin_confirm_report(bigint) from public, anon;
grant execute on function public.admin_confirm_report(bigint) to authenticated, service_role;
revoke execute on function public.appeal_strike(bigint, text) from public, anon;
grant execute on function public.appeal_strike(bigint, text) to authenticated;
revoke execute on function public.admin_decide_appeal(bigint, boolean) from public, anon;
grant execute on function public.admin_decide_appeal(bigint, boolean) to authenticated, service_role;
revoke execute on function public.my_moderation() from public, anon;
grant execute on function public.my_moderation() to authenticated;
revoke execute on function public.ack_shield_notice() from public, anon;
grant execute on function public.ack_shield_notice() to authenticated;
