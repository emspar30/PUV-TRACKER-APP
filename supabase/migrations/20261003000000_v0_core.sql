-- Prototype v0 backend (PRD 0.7, 12.2): the tables the live map needs, locked down.
--
-- The project has "Automatically expose new tables" OFF and "Enable automatic RLS" ON, so:
--   * every table below enables Row Level Security explicitly anyway (never rely on a setting);
--   * a role can use a table only if this file GRANTs it AND a policy allows the rows;
--   * a table with no policy denies everything to client roles.
--
-- Client roles: `anon` (not signed in) gets nothing. `authenticated` (signed in) can read
-- active vehicles and their latest position, and its own profile. Nothing else.
-- Only the ingest Edge Function, using `service_role` on the server, writes telemetry.
--
-- No table stores a rider's fare category, avatar or identity next to a position.

-- ---------------------------------------------------------------------------
-- profiles: one row per signed-in account. Deliberately almost empty.
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy "profiles: read own row"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "profiles: create own row"
  on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

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
-- telemetry_writers: the team allowlist. With verification off, only these
-- accounts may publish positions (PRD 0.7 safety rule). Clients cannot see it.
-- ---------------------------------------------------------------------------
create table public.telemetry_writers (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  note      text,
  added_at  timestamptz not null default now()
);

alter table public.telemetry_writers enable row level security;

revoke all on public.telemetry_writers from anon, authenticated;
grant all on public.telemetry_writers to service_role;
-- No policy on purpose: client roles are denied everything.

-- ---------------------------------------------------------------------------
-- telemetry_latest: one row per vehicle, its newest position. Read by the live map.
-- Clients can only SELECT. Every write goes through the ingest Edge Function.
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
  );
-- No INSERT, UPDATE or DELETE grant or policy for client roles, on purpose.

-- Send row changes to subscribed clients (Realtime). Row Level Security still applies to them.
alter publication supabase_realtime add table public.telemetry_latest;

-- ---------------------------------------------------------------------------
-- telemetry_ingest_log: which team account sent which packet. Server-only audit
-- trail for tracing a wrong marker. Team accounts only; rows are purged after
-- 30 days by the ingest function. Clients cannot see it.
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
