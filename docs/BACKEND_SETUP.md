# Backend setup (S4)

What exists in the repository, what you do in the Supabase dashboard, and the commands for S4 part 2. **Nothing here has been run against the live project yet.**

## 1. What is in the repository

| File | What it is |
| --- | --- |
| `supabase/config.toml` | Local CLI settings, created by `supabase init`. No secrets. |
| `supabase/migrations/20261003000000_v0_core.sql` | Tables, Row Level Security, grants, Realtime publication |
| `supabase/seed.sql` | Three test vehicles with fake plates |
| `supabase/functions/ingest/index.ts` | The ingest Edge Function (runs in Deno on Supabase) |
| `supabase/functions/_shared/` | The function's rules, the packet validator, the verification hook and the server constants. Pure TypeScript, also used by the app and unit-tested here. |
| `tests/integration/supabase.test.ts` | Tests against the live project; skipped until `.env` is filled in |

## 2. Tables and who can do what

| Table | Signed-out (`anon`) | Signed-in (`authenticated`) | Ingest function (`service_role`) |
| --- | --- | --- | --- |
| `profiles` | nothing | read and create own row | all |
| `vehicles` | nothing | read rows where `active` is true | all |
| `telemetry_latest` | nothing | read rows of active vehicles; **no write** | all (the only writer) |
| `telemetry_writers` (team allowlist) | nothing | nothing | all |
| `telemetry_ingest_log` (audit trail, 30 days) | nothing | nothing | all |

No table stores a rider's fare category, avatar, name, email or phone. `telemetry_latest` has no user column, so nothing about a rider can reach the map. The audit log links a team account to a vehicle and a time, not to a position.

Two things differ from a literal reading of the S4 request, both from earlier decisions:

- `telemetry_ingest_log` is included because you approved a writer audit trail (team accounts only, kept 30 days).
- There is no `app_config` table. The server constants live in `supabase/functions/_shared/serverConfig.ts`, which the app's config module re-exports, so each value has one definition.

## 3. What you do in the dashboard before "Supabase is ready"

1. **Create two accounts** under Authentication, Users, "Add user", with "Auto Confirm User" on: one for the allowlisted writer, one for the outsider. Use addresses and passwords made for testing.
2. **Fill in `.env`** in the project root (copy `.env.example`). It is git-ignored.
   - `EXPO_PUBLIC_SUPABASE_URL`: Project Settings, API, Project URL.
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Project Settings, API keys, the publishable key.
   - The four `TEST_...` values for the two accounts.
3. **Do not paste the secret or service-role key anywhere** in this project. The Edge Function receives it from Supabase automatically.
4. Have your **database password** and the **project reference** (the part of the URL before `.supabase.co`) ready for the link step. You type them yourself; the agent never sees or prints them.

## 4. Commands for S4 part 2 (for review; not run)

Run from the project root. The agent will show each command again and ask before running any that changes the live project.

| # | Command | Changes the live project? |
| --- | --- | --- |
| 1 | `npx supabase login` | No. Opens a browser so you can authorise the CLI. |
| 2 | `npx supabase link --project-ref <your-project-ref>` | No. Records the project in `supabase/.temp` (git-ignored). Asks for the database password. |
| 3 | `npx supabase db push --dry-run` | No. Lists the migrations that would be applied. |
| 4 | `npx supabase db push` | **Yes.** Creates the five tables, policies and grants. |
| 5 | Seed the test vehicles: paste `supabase/seed.sql` into the dashboard's SQL Editor and run it | **Yes.** Adds three rows to `vehicles`. |
| 6 | Add the writer to the allowlist: run the SQL below in the SQL Editor, with the writer's email | **Yes.** Adds one row to `telemetry_writers`. |
| 7 | `npx supabase functions deploy ingest --no-verify-jwt` | **Yes.** Uploads the function. |
| 8 | `npm test` | Reads and writes only the test vehicle's telemetry row, through the function. |

Allowlist SQL for step 6:

```sql
insert into public.telemetry_writers (user_id, note)
select id, 'team test writer' from auth.users where email = 'WRITER_EMAIL_HERE'
on conflict (user_id) do nothing;
```

Notes:

- **`--no-verify-jwt` does not make the function public.** It turns off the gateway's own token check so the function does the check itself: it asks Supabase Auth whether the access token is a valid session, then checks the allowlist. A call with no token, a bad token or only the publishable key gets 401. Whether the gateway check can stay on with this project's key type is to be confirmed from the Supabase documentation at the start of part 2.
- **No destructive command is used.** `supabase db reset` is never run against the live project.
- Function deploys may need Docker on some CLI versions. Docker is not installed on this PC. If the deploy asks for it, the agent stops and reports the options.

## 5. After part 2

Restart Metro after `.env` is filled in, because the two `EXPO_PUBLIC_` values are read when the app is bundled. The Profile tab then shows "Not signed in" with a Sign in button, instead of "The backend is not set up on this build".
