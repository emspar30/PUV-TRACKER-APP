-- Tracking is free again (PRD 19 D1, Emjay 2026-10-08): "Tracking is free for the whole prototype
-- and pilot; a config switch turns Energy on for demonstrations". Turns off the switch that
-- 20261006000000_checkin_end.sql turned on. start_tracking() then opens a session without a charge;
-- check-ins and relays still earn into the ledger, and the app hides the Energy balance.
-- `update public.app_config set energy_enabled = true` turns it on again for a demonstration.

update public.app_config set energy_enabled = false;
