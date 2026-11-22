-- Suspensions and bans come only from the moderation rules (owner, 2026-11-23, after trying the
-- console): the console's manual Suspend form is removed, so its two functions from
-- 20261123000000_auto_moderation.sql are closed to every client. The admin still lifts a suspension or
-- ban (console_lift) to fix a mistake, and decides conflicts and appeals. The functions stay (migrations
-- never drop a function); only the service role may run them. No row is changed.

revoke execute on function public.console_suspend(uuid, integer, boolean, text) from public, anon, authenticated;
revoke execute on function public.console_find_accounts(text) from public, anon, authenticated;
