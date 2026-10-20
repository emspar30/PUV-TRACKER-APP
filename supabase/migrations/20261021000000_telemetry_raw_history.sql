-- T1: the ingest function (service_role) could not add positions to telemetry_raw. The column default
-- at_night calls public.is_night, whose execute right was revoked from public and given to
-- authenticated only (20261003000000_v0_core), so every history insert failed with a permission error.
-- The single-packet path only logged it, and telemetry_raw stayed empty; the store-and-forward batch
-- needs it, because a dead-zone backlog is kept only there.
grant execute on function public.is_night(timestamptz) to service_role;
