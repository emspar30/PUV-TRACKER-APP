-- NOT A MIGRATION YET (Emjay, 2026-10-12, DR3 option B): set aside so `supabase db push` cannot apply it;
-- tracking stays free on the live project. To turn Energy on, copy this file into supabase/migrations/
-- under a NEW timestamp later than the last migration (the CLI refuses one older than the last applied),
-- then dry-run and push as usual. Originally 20261012000000_energy_on.sql (ST2-D2).
--
-- Tracking costs Energy again (Emjay, 2026-10-09, ST2-D2): 1 Energy per 30-minute session of tracking
-- one multicab (PRD 11.1). Turns on the switch that 20261011000000_energy_off.sql turned off.
-- start_tracking() charges again; check-ins and relays earn as before; nothing else is gated.
-- `update public.app_config set energy_enabled = false` makes tracking free again.

update public.app_config set energy_enabled = true;
