-- The Energy switch (2026-10-06), for C1 and RP1.
-- Energy on (PRD 19 D1: "a config switch turns Energy on for demonstrations"), so a tracking
-- session costs 1 Energy and check-ins and reports earn it. end_check_in() ("I boarded" and
-- "Cancel") already exists from v0_core. `update public.app_config set energy_enabled = false`
-- makes tracking free again.

update public.app_config set energy_enabled = true;
