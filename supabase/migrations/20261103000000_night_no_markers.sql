-- Night Mode (PRD 10.4; Emjay, 2026-11-03): the live map shows no multicab at all at night, moving or
-- standing, so no live coordinates are published. Standing multicabs were shown before. The night stop
-- view (night_stop_updates, NM1) takes their place. Collection goes on: live-map relays still send
-- positions, which record the stop passages.

alter policy "telemetry_latest: team accounts read active vehicles" on public.telemetry_latest
  using (
    (select public.is_team_account())
    and exists (
      select 1 from public.vehicles v
      where v.vehicle_id = telemetry_latest.vehicle_id and v.active
    )
    and not public.is_night(now())
  );
