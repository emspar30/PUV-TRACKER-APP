-- B6: trust points and the Trusted badge. A commuter earns a point for each check-in and each
-- relay, at most trust_daily_max (3) a Manila day, so the badge cannot be farmed in one sitting; a
-- relay loses its point when someone else flags it. At trust_badge_points (5) the commuter is
-- Trusted: 5 check-ins or relays that nobody flagged. Kept by triggers on the server, so no client
-- can set them, and the check-in and relay functions stay as they are.

alter table public.profiles
  add column trust_points integer not null default 0 check (trust_points >= 0),
  add column trust_day date,
  add column trust_today smallint not null default 0;

alter table public.app_config
  add column trust_badge_points smallint not null default 5,
  add column trust_daily_max smallint not null default 3;

-- Whether the relay earned a point (not after the daily cap), so a flag only takes back a point
-- that was given. Server-only: no client grant.
alter table public.feed_posts
  add column trust_earned boolean not null default false;

-- One point, unless the commuter already earned trust_daily_max today (Manila day). True when given.
create function public.trust_award(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.manila_day(now());
begin
  update public.profiles p
    set trust_points = p.trust_points + 1,
        trust_today = case when p.trust_day = today then p.trust_today + 1 else 1 end,
        trust_day = today
    where p.user_id = uid
      and (p.trust_day is distinct from today or p.trust_today < (select c.trust_daily_max from public.app_config c));
  return found;
end;
$$;

-- Each post says whether its author was Trusted when it was sent, so the feed can show the badge
-- without letting anyone read other people's profiles
alter table public.feed_posts
  add column author_trusted boolean not null default false;

grant select (author_trusted) on public.feed_posts to authenticated;

-- A check-in for several routes at a shared stop inserts one row per route in one call; those rows
-- share created_at (now() is fixed for the transaction), so the call earns one point, not one per route
create function public.trust_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.checkins c
    where c.user_id = new.user_id and c.created_at = new.created_at and c.id <> new.id
  ) then
    perform public.trust_award(new.user_id);
  end if;
  return null;
end;
$$;

create trigger checkins_trust
  after insert on public.checkins
  for each row execute function public.trust_on_checkin();

-- Stamps the badge on the new post from the points before it, then adds the relay's point (if
-- the daily cap allows)
create function public.trust_on_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_trusted := coalesce(
    (select p.trust_points from public.profiles p where p.user_id = new.user_id), 0
  ) >= (select c.trust_badge_points from public.app_config c);
  new.trust_earned := public.trust_award(new.user_id);
  return new;
end;
$$;

create trigger feed_posts_trust
  before insert on public.feed_posts
  for each row execute function public.trust_on_post();

-- The first flag from someone other than the author takes the relay's point back, if it earned
-- one (never below 0); later flags on the same post change nothing
create function public.trust_on_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
  earned boolean;
begin
  select f.user_id, f.trust_earned into author, earned from public.feed_posts f where f.id = new.post_id;
  if author is null or author = new.user_id or not earned then return null; end if;
  if (select count(*) from public.feed_flags g where g.post_id = new.post_id and g.user_id <> author) = 1 then
    update public.profiles set trust_points = greatest(trust_points - 1, 0) where user_id = author;
  end if;
  return null;
end;
$$;

create trigger feed_flags_trust
  after insert on public.feed_flags
  for each row execute function public.trust_on_flag();

-- Internal and trigger functions only: no client may call them
revoke execute on function public.trust_award(uuid) from public, anon, authenticated;
revoke execute on function public.trust_on_checkin() from public, anon, authenticated;
revoke execute on function public.trust_on_post() from public, anon, authenticated;
revoke execute on function public.trust_on_flag() from public, anon, authenticated;
