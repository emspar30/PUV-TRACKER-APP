-- The preset avatar follows the account (Emjay, 2026-11-13). The avatar was kept only on the phone
-- (PRD 19 D3), so the same account showed a different avatar on each phone. Now its number (0 to
-- 15, one of the preset pictures in the app; no image is stored) is kept on the account's own profile
-- row, which only that account can read. The gender answer and the fare type stay on the phone; the
-- avatar's number tells only which preset set it came from. No table, row, grant or function is
-- removed.

alter table public.profiles
  add column avatar_id smallint check (avatar_id between 0 and 15);

-- Sets the caller's avatar; creates the profile row if needed
create function public.set_avatar(avatar smallint)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if avatar is null or avatar < 0 or avatar > 15 then raise exception 'avatar must be 0 to 15' using errcode = '22023'; end if;
  insert into public.profiles (user_id, avatar_id) values (uid, set_avatar.avatar)
  on conflict (user_id) do update set avatar_id = excluded.avatar_id;
  return set_avatar.avatar;
end;
$$;

revoke execute on function public.set_avatar(smallint) from public, anon;
grant execute on function public.set_avatar(smallint) to authenticated;
