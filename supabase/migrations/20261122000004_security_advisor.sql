-- Supabase Security Advisor, 2026-11-22: 0 errors. One warning to close here:
-- anon_security_definer_function_executable on public.rls_auto_enable(). That function is not
-- Tunton's: Supabase made it when the project's automatic row-level security setting was turned on.
-- It runs as an event trigger, which does not need EXECUTE, so no client role needs to call it.
-- Guarded: on a database without the setting (a local one) the function does not exist.
--
-- The other warnings are by design and stay: signed-in accounts may call the app's own security
-- definer functions (check_in, post_report, console_*, ...), each of which checks the caller itself;
-- clients never write a table directly. Leaked password protection is an Auth setting in the dashboard.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
