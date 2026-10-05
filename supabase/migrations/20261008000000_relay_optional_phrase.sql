-- B4: in the simplified Relay panel the seat tier is what a rider always gives; "What's happening"
-- (the preset phrase) is optional. A null phrase still passes the preset check. post_report
-- already inserts whatever phrase it is given, so it needs no change.
alter table public.feed_posts alter column phrase drop not null;
