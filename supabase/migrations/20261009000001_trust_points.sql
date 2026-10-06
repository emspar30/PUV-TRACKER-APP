-- B6: trust points and the Trusted badge. A commuter earns a point for each check-in and each
-- relay; a relay loses its point when someone else flags it. At trust_badge_points (5) the
-- commuter is Trusted: 5 check-ins or relays that nobody flagged. Kept by triggers on the server,
-- so no client can set them, and the check-in and relay functions stay as they are.

alter table public.profiles
  add column trust_points integer not null default 0 check (trust_points >= 0);

alter table public.app_config
  add column trust_badge_points smallint not null default 5;

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
    update public.profiles set trust_points = trust_points + 1 where user_id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger checkins_trust
  after insert on public.checkins
  for each row execute function public.trust_on_checkin();

-- Stamps the badge on the new post from the points before it, then adds the relay's point
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
  update public.profiles set trust_points = trust_points + 1 where user_id = new.user_id;
  return new;
end;
$$;

create trigger feed_posts_trust
  before insert on public.feed_posts
  for each row execute function public.trust_on_post();

-- The first flag from someone other than the author takes the relay's point back (never below 0);
-- later flags on the same post change nothing
create function public.trust_on_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
begin
  select f.user_id into author from public.feed_posts f where f.id = new.post_id;
  if author is null or author = new.user_id then return null; end if;
  if (select count(*) from public.feed_flags g where g.post_id = new.post_id and g.user_id <> author) = 1 then
    update public.profiles set trust_points = greatest(trust_points - 1, 0) where user_id = author;
  end if;
  return null;
end;
$$;

create trigger feed_flags_trust
  after insert on public.feed_flags
  for each row execute function public.trust_on_flag();

-- Trigger functions only: no client may call them
revoke execute on function public.trust_on_checkin() from public, anon, authenticated;
revoke execute on function public.trust_on_post() from public, anon, authenticated;
revoke execute on function public.trust_on_flag() from public, anon, authenticated;
