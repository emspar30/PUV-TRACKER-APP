-- Retention jobs (SB1). NOT a migration and NOT applied: run this in the SQL Editor only after
-- Emjay enables the pg_cron extension in the dashboard (Database, Extensions). Re-running it
-- replaces the jobs (cron.schedule with the same name updates the job).
--
-- Windows: expired check-ins every minute; feed posts once expired, 60 minutes after posting
-- (app_config.feed_lifetime_min; checked every 5 minutes); flags 30 days; the ingest log 30 days; raw
-- telemetry 7 days, positions received at night 24 hours.

select cron.schedule('retention-checkins', '* * * * *',
  $$ delete from public.checkins where expires_at < now() $$);

select cron.schedule('retention-feed-posts', '*/5 * * * *',
  $$ delete from public.feed_posts where expires_at < now() $$);

select cron.schedule('retention-feed-flags', '17 3 * * *',
  $$ delete from public.feed_flags where created_at < now() - interval '30 days' $$);

select cron.schedule('retention-ingest-log', '23 3 * * *',
  $$ delete from public.telemetry_ingest_log where received_at < now() - interval '30 days' $$);

select cron.schedule('retention-telemetry-raw', '7 * * * *',
  $$ delete from public.telemetry_raw
     where received_at < now() - interval '7 days'
        or (at_night and received_at < now() - interval '24 hours') $$);

-- DR3, driver side: the SMS queue 7 days (delivery records for the gateway health checks and E7);
-- the worker's alerts 30 days.
select cron.schedule('retention-sms-outbox', '41 3 * * *',
  $$ delete from public.sms_outbox where created_at < now() - interval '7 days' $$);

select cron.schedule('retention-ops-alerts', '47 3 * * *',
  $$ delete from public.ops_alerts where created_at < now() - interval '30 days' $$);
