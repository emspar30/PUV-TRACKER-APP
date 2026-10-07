-- Two decisions (Emjay, 2026-10-07, master plan section 8):
--
-- 1. Night feed delay (PRD 10.4): during Night Mode, stop-level updates are published at least
--    two minutes late. A relay naming its stop (B6) and posted inside the Night Mode window is
--    hidden from everyone but its author for app_config.night_feed_delay_min minutes. A post with
--    no stop, or posted by day, shows at once as before. Nothing is collected differently.
-- 2. Live vehicles for team accounts only in v0 (question 3): the vehicles and telemetry_latest
--    policies check public.team_accounts again instead of public.may_participate(). Check-ins,
--    relays, the feed and Energy stay open to every signed-in account (open sign-up).
--
-- No table, row, grant or function is removed. The Night Mode window and the moving-vehicle rule
-- on telemetry_latest are unchanged (question 4: moving markers hidden at night, as built).

alter table public.app_config
  add column night_feed_delay_min int not null default 2 check (night_feed_delay_min between 0 and 60);

alter policy "feed_posts: signed-in users read live, visible posts" on public.feed_posts
  using (
    not hidden
    and expires_at > now()
    and (
      stop_code is null
      or user_id = (select auth.uid())
      or not public.is_night(created_at)
      or created_at <= now() - make_interval(mins => (select c.night_feed_delay_min from public.app_config c))
    )
  );

alter policy "vehicles: participants read active vehicles" on public.vehicles
  using (active and (select public.is_team_account()));
alter policy "vehicles: participants read active vehicles" on public.vehicles
  rename to "vehicles: team accounts read active vehicles";

alter policy "telemetry_latest: participants read active vehicles" on public.telemetry_latest
  using (
    (select public.is_team_account())
    and exists (
      select 1 from public.vehicles v
      where v.vehicle_id = telemetry_latest.vehicle_id and v.active
    )
    and (
      not public.is_night(now())
      or telemetry_latest.speed_kmh < (select c.stationary_speed_kmh from public.app_config c)
    )
  );
alter policy "telemetry_latest: participants read active vehicles" on public.telemetry_latest
  rename to "telemetry_latest: team accounts read active vehicles";
