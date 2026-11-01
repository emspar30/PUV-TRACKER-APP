-- V1a (PRD 10.2, 8.1 step 6; 2026-11-02): a relay's Crowdsource post shows as verified once the
-- rider's phone has passed the verification window (25 km/h held for 20 s, within 30 m of the route
-- line, 50 m along it, after the beacon check of RL2a). The phone decides, as it does for the
-- beacon and the route (D12); the live map's marker is judged by the ingest function on the server.
-- Only the author's own post, while its relay is running and the post is not hidden.
create function public.verify_report(post bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  changed int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update public.feed_posts f
     set verified = true
   where f.id = verify_report.post
     and f.user_id = uid
     and f.ended_at is null
     and not f.hidden
     and f.expires_at > now();
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke execute on function public.verify_report(bigint) from public, anon;
grant execute on function public.verify_report(bigint) to authenticated;
