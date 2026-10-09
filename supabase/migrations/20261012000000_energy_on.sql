-- Tracking costs Energy again (Emjay, 2026-10-09, ST2-D2): 1 Energy per 30-minute session of tracking
-- one multicab (PRD 11.1). Turns on the switch that 20261011000000_energy_off.sql turned off.
-- start_tracking() charges again; check-ins and relays earn as before; nothing else is gated.
-- `update public.app_config set energy_enabled = false` makes tracking free again.

update public.app_config set energy_enabled = true;
