# Backend setup: the commuter-side database (SB1)

The design of the database, what you do in the Supabase dashboard, and the live steps. **Nothing here has been run against the live project yet.** The migration was never applied, so it was edited in place in SB1.

## 1. What is in the repository

| File | What it is |
| --- | --- |
| `supabase/config.toml` | Local CLI settings. No secrets. |
| `supabase/migrations/20261003000000_v0_core.sql` | Tables, Row Level Security, grants, functions, Realtime publication |
| `supabase/cron/retention.sql` | Retention jobs for `pg_cron`. **Not a migration; applied by hand after `pg_cron` is enabled.** |
| `supabase/seed.sql` | Three test vehicles with fake plates |
| `supabase/functions/ingest/index.ts` | The ingest Edge Function (Deno): validates a packet, checks `team_accounts`, writes `telemetry_latest` and `telemetry_raw` |
| `supabase/functions/_shared/` | The function's rules and server constants, also used by the app and unit-tested |
| `src/shared/backend/rules.ts` | The same business rules in TypeScript (Energy caps, feed expiry, flags, Night Mode), tested on fixtures |
| `src/shared/__tests__/migration.test.ts` | Static checks on the migration text (security statements, columns, rules) |
| `tests/integration/supabase.test.ts` | Tests against the live project; skipped until `.env` is filled in |

## 2. Rules for every table

- Row Level Security on, explicitly. `anon` gets nothing. `authenticated` reads only what it needs.
- **Clients never write a table.** Every write goes through a function (security definer, empty `search_path`, execute revoked from `public` and `anon`) or the ingest function (`service_role`).
- **v0: team accounts only** (`team_accounts`) may check in, report, flag, use Energy or publish positions.
- No table stores a fare category, avatar, gender, destinations or contact details, and no table puts a user next to a position.

## 3. Tables

| Table | Columns (main) | Signed-in client can | Kept |
| --- | --- | --- | --- |
| `app_config` | one row: Night Mode 21:00 to 04:59 Asia/Manila; `energy_enabled` (off); wallet 5; GPS report 1.0, no-GPS 0.5, check-in 0.3; passive 1 per 12 h, 2 a day; tracking cost 1 per 30 min; feed 60 min; 3 flags; check-in 15 min; stationary 2 km/h | read | — |
| `team_accounts` | user, note (renamed from `telemetry_writers`) | nothing | — |
| `profiles` | user, **username** (unique, 3 to 20 letters, digits, `_`) | read own | until account deletion |
| `vehicles` | id, plate, route, active | read active | — |
| `telemetry_latest` | one row per vehicle: position, speed, heading, seats, packet time, stopped since, `verified`, `verification_reasons` | read active vehicles; **at night only stationary ones** | overwritten |
| `telemetry_raw` | every accepted position, `at_night` | nothing | 7 days; night positions 24 h |
| `telemetry_ingest_log` | team account, vehicle, accepted, reason | nothing | 30 days |
| `checkins` | user, route, station, `created_at`, `expires_at` | read own | deleted when expired (every minute) |
| `energy_ledger` | user, kind, amount, Manila day, `request_key` (unique per user) | read own | until account deletion |
| `feed_posts` | author **username** (not user id), route, vehicle, **preset phrase**, seat tier, with GPS, verified, hidden, `expires_at` | read visible, live posts; **`user_id` column not granted** | deleted at 60 min |
| `feed_flags` | post, user (one per user) | nothing | 30 days |
| `feed_review_queue` | post hidden by flags | nothing | until reviewed |

## 4. Functions (the only client writes)

| Function | Does | Who |
| --- | --- | --- |
| `set_username(name)` | creates or updates the profile; refuses taken or invalid names | signed in |
| `check_in(route, station, key)` | ends any live check-in, adds one for 15 min, books check-in Energy | team |
| `end_check_in()` | "I boarded" or Cancel | signed in |
| `checkin_counts(route)` | live check-ins per station | team |
| `post_report(route, phrase, seat_tier, vehicle, with_gps, key)` | feed post (needs a username), books report Energy | team |
| `flag_post(post)` | one flag per user; at 3 hides and queues | team |
| `energy_balance()` | sum, capped at 5 | signed in |
| `energy_passive_refill()` | +1 when 12 h passed, at most 2 a Manila day | team |
| `start_tracking(key)` | 30 min session; spends 1, free while `energy_enabled` is off | team |
| `delete_my_account()` | removes the user's flags, posts, check-ins, ledger, profile, then the account (PRD 15.1) | signed in |
| `energy_earn(kind, key)` | internal: atomic (advisory lock), idempotent by key, once per kind per Manila day, never above the wallet | not callable by clients |
| `is_team_account()`, `is_night(t)`, `manila_day(t)` | helpers for policies and functions | signed in |

## 5. What you do in the dashboard before "Supabase is ready"

1. **Create two accounts** under Authentication, Users, "Add user", with "Auto Confirm User" on: a team account and an outsider. Use addresses and passwords made for testing.
2. **Fill in `.env`** (copy `.env.example`; git-ignored): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the four `TEST_...` values. **Once these are filled in, `npx jest` runs the live tests.**
3. **The service-role key** never goes in the app, in a committed file or in a chat. Since DR3 (2026-10-12) it may sit in the team PC's git-ignored `.env` as `SUPABASE_SERVICE_ROLE_KEY`, for the driver-side admin scripts, their live tests and the SMS worker only (section 8).
4. Have the **database password** and the **project reference** ready for `supabase link`. You type them; the agent never sees or prints them.
5. **Do not enable `pg_cron` yet.** The agent asks you at step 3 below.

## 6. Live steps (after "Supabase is ready"; each changing command shown and approved first)

| # | Command | Changes the live project? |
| --- | --- | --- |
| 1 | `npx supabase db push --dry-run` | No. Lists the migration. |
| 2 | `npx supabase db push` | **Yes.** Creates the tables, policies, grants and functions. |
| 3 | Paste `supabase/seed.sql` into the SQL Editor | **Yes.** Three test vehicles. |
| 4 | Add the team account (SQL below) | **Yes.** One row in `team_accounts`. |
| 5 | You enable `pg_cron` (Database, Extensions); then paste `supabase/cron/retention.sql` | **Yes.** Five jobs. |
| 6 | `npx supabase functions deploy ingest --no-verify-jwt` | **Yes.** If it asks for Docker (not installed), the agent stops and reports the options. |
| 7 | `npx jest tests/integration` | Writes only test rows (a check-in, a report, a username, the test vehicle's telemetry). |

```sql
insert into public.team_accounts (user_id, note)
select id, 'team test account' from auth.users where email = 'TEAM_EMAIL_HERE'
on conflict (user_id) do nothing;
```

- **`--no-verify-jwt` does not make the function public.** The function itself asks Supabase Auth whether the token is a valid session, then checks `team_accounts`; anything else gets 401.
- **No destructive command** is used: `supabase db reset` is never run against the live project.
- **To check live:** that `delete_my_account` may delete from `auth.users` on this project (plan §8, question 2).

## 7. After the live steps

Restart Metro, because the `EXPO_PUBLIC_` values are read when the app is bundled. Settings then shows "Not signed in" with a Sign in button instead of "Team account · not set up".

## 8. Driver side (DR3, 2026-10-12)

Migration `20261013000000_driver_side.sql`; design in `docs/IMPLEMENTATION_PLAN_DRIVER.md` sections 6, 8 and DR3.

**Tables, all server-only** (Row Level Security on, no client grant, no policy):

| Table | Holds | Kept |
| --- | --- | --- |
| `vehicle_beacons` | A vehicle's beacon short id (1 to 65535) and its secret's Vault id | Life of the vehicle |
| `driver_devices` | A driver phone: vehicle, SIM number (E.164), SMS key's Vault id, last sequence number, active | Until retired; delete the rows (and numbers) at pilot end |
| `gateways` | The gateway phone: SHA-256 of its token, SIM number, last heartbeat | — |
| `sms_outbox` | Texts to send and how they went | 7 days (cron) |
| `sms_dispatch_state` | What each route was last sent | — |
| `ops_alerts` | Problems the worker found (Q9: read here, in the dashboard) | 30 days (cron) |

**Secrets live in Vault only.** Tables hold the Vault id. Driver numbers are personal data, readable only with the service role.

**Functions:** `worker_*` for the SMS worker (DR6) and `admin_*` for the scripts. Every one is security definer and callable only by the service role. `vault_put` is internal.

**Scripts** (Emjay's PC, `npx tsx`; they read `SUPABASE_SERVICE_ROLE_KEY` from `.env`, never print it, and show secrets only inside the setup QR):

| Order | Command | Does |
| --- | --- | --- |
| 1 | `npx tsx scripts/provision-gateway.ts --gateway GW-01 --phone 09… --worker-url https://…` | Saves the gateway, prints its setup QR (a new token each run) |
| 2 | `npx tsx scripts/provision-driver.ts --vehicle R4-001 --plate "ABC 123" --route R4 --phone 09…` | Creates or updates the vehicle, new beacon secret, new device and SMS key; prints the driver setup QR. `--replace` for a new or reset phone |
| — | `npx tsx scripts/retire-device.ts DRV-0001` | Stops texts to a phone and replaces its vehicle's beacon secret |

**Energy (2026-10-12):** the live project already has `20261012000000_energy_on` (tracking costs Energy); it stays in `supabase/migrations`, Emjay's choice. A migration applied live must stay in this folder under its name: otherwise `db push` refuses to run ("Remote migration versions not found in local migrations directory").

**Live steps for DR3** (each approved first):

| # | Command | Changes the live project? |
| --- | --- | --- |
| 0 | `npx supabase login`, then `npx supabase link --project-ref <ref>` (you type the database password) | No. Links this PC's CLI to the project. |
| 1 | `npx supabase db push --dry-run` | No. Must list **only** `20261013000000_driver_side.sql`. |
| 2 | `npx supabase db push` | **Yes.** The tables and functions above. |
| 3 | Paste the two new jobs at the end of `supabase/cron/retention.sql` into the SQL Editor | **Yes.** Two jobs. |
| 4 | `npx jest tests/integration/driverSide.test.ts` | Writes and removes its own test rows (vehicle `R99-DR3-TEST`, gateway `GW-99`). |
