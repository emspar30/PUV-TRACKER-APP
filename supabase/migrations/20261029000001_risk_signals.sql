-- RK1 Risk signals (PRD 10.3, without integrity or device fingerprint; docs/IMPLEMENTATION_PLAN_PRD_GAPS.md).
--
-- Two signals are booked against an account:
--   mock_location     the phone saw a mock (fake GPS) fix while checking in or relaying; the phone
--                     already refuses such fixes (acceptFix) and reports it once per app session
--                     through report_risk, as best effort
--   impossible_speed  the ingest function rejected a position that implied more than
--                     IMPOSSIBLE_SPEED_KMH from the vehicle's last one (a forged or teleporting
--                     sender); the function books it with the service role
-- An account's risk score is its events of the last 30 days, weighted per kind in app_config. At
-- app_config.risk_review_score it is put on account_review_queue, read in the dashboard (MOD1 later).
-- Nothing is decided automatically: no ban, no strike.
--
-- Nothing is removed or changed.

alter table public.app_config
  add column risk_weight_mock_location int not null default 1 check (risk_weight_mock_location between 0 and 10),
  add column risk_weight_impossible_speed int not null default 1 check (risk_weight_impossible_speed between 0 and 10),
  add column risk_review_score int not null default 3 check (risk_review_score between 1 and 100);

create table public.risk_events (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users (id) on delete cascade,
  kind     text not null check (kind in ('mock_location', 'impossible_speed')),
  detail   jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 512),
  at       timestamptz not null default now()
);

create index risk_events_user_idx on public.risk_events (user_id, at desc);

alter table public.risk_events enable row level security;
revoke all on public.risk_events from anon, authenticated;
grant all on public.risk_events to service_role;

create table public.account_review_queue (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  score      int not null,
  queued_at  timestamptz not null default now()
);

alter table public.account_review_queue enable row level security;
revoke all on public.account_review_queue from anon, authenticated;
grant all on public.account_review_queue to service_role;

-- The weighted count of an account's events in the last 30 days
create function public.risk_score(uid uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case e.kind
    when 'mock_location' then c.risk_weight_mock_location
    when 'impossible_speed' then c.risk_weight_impossible_speed
    else 0 end), 0)::int
  from public.risk_events e, public.app_config c
  where e.user_id = uid and e.at > now() - interval '30 days';
$$;

-- Books one event and queues the account for review at the threshold. Used by report_risk and by the
-- ingest function (service role).
create function public.book_risk(uid uuid, risk_kind text, risk_detail jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  score int;
begin
  insert into public.risk_events (user_id, kind, detail) values (uid, risk_kind, coalesce(risk_detail, '{}'::jsonb));
  score := public.risk_score(uid);
  if score >= (select c.risk_review_score from public.app_config c) then
    insert into public.account_review_queue (user_id, score) values (uid, score)
    on conflict (user_id) do update set score = excluded.score;
  end if;
  return true;
end;
$$;

-- The phone's report: mock_location only, at most once a minute per account
create function public.report_risk(kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or kind <> 'mock_location' then
    return false;
  end if;
  if exists (
    select 1 from public.risk_events e
    where e.user_id = uid and e.kind = 'mock_location' and e.at > now() - interval '1 minute'
  ) then
    return false;
  end if;
  return public.book_risk(uid, 'mock_location', '{}'::jsonb);
end;
$$;

revoke execute on function public.risk_score(uuid) from public, anon, authenticated;
revoke execute on function public.book_risk(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.book_risk(uuid, text, jsonb) to service_role;
revoke execute on function public.report_risk(text) from public, anon;
grant execute on function public.report_risk(text) to authenticated;
