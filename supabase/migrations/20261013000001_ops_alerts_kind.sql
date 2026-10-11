-- DR3 fix (2026-10-12): an alert's kind may contain digits (latency_p90, and the live test's
-- dr3_test). 20261013000000_driver_side.sql allowed only letters and underscores; it is applied,
-- so the rule is replaced here rather than edited there. ops_alerts holds no row yet.

alter table public.ops_alerts drop constraint ops_alerts_kind_check;
alter table public.ops_alerts add constraint ops_alerts_kind_check check (kind ~ '^[a-z0-9_]{1,40}$');
