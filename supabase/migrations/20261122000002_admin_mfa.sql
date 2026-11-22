-- Two-factor sign-in for the admin console (owner, 2026-11-22). is_admin() now also needs the
-- session's second factor: the JWT's aal claim must be aal2, which Supabase Auth sets only after the
-- admin enters a code from an authenticator app (TOTP). Every console function, the photo bucket's
-- read and delete policies and the moderation functions call is_admin(), so a stolen password alone
-- no longer opens any of them. The service role (the SMS worker, scripts) is unaffected.
--
-- Before applying: the console build with the two-factor screen (admin/src/TwoFactor.tsx) must be the
-- one in use, or the admin is locked out until it is. The first sign-in after this sets up the
-- authenticator app. A lost authenticator: delete the admin user's MFA factor in the Supabase
-- dashboard (Authentication, Users, the admin, MFA factors), then sign in and set it up again.
--
-- Same name and arguments as in 20261027000000_driver_registration.sql, replaced in place. No row
-- is changed.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_accounts a where a.user_id = (select auth.uid()))
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
