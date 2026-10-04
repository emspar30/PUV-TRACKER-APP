# Master implementation plan: the commuter side

- **Date:** 2026-10-05 (revised in place; the 2026-10-04 version is in git history).
- **Scope:** finish the **commuter side** (PRD 7 and 19). The database is designed first (SB1, written, not applied). Out of scope for now: BLE, the driver app, SMS, background tracking and moderation beyond flags.
- **Status source:** `docs/STATUS.md` (not re-verified here). **Do not use the app outdoors or share it before G0.**
- **Rules (unchanged):** pure logic in `src/shared` with fixture tests; every threshold in `src/shared/config` (server values also in `app_config`); route facts only in seed files; strings only in `src/strings/en.ts`; one local commit per approved step, never pushed; no new dependency, native build or Supabase command without approval of the exact command; Android only.
- **Test labels:** **E** emulator; **P** the partner's phone; **X** needs a live project, a multicab or other hardware.

## 1. Commuter features

| Feature (PRD) | Now | Left | Needs | Step | Pri |
| --- | --- | --- | --- | --- | --- |
| Offline map, R3 R4 R5 lines (7.2) | Works (traced lines; R4/R5 one leg) | Per-direction legs, "write routes" | Data from Emjay | RR3 | P0 |
| My Ride trip and fare (7.2) | Works (placeholder stops and fare) | Real stops, official fare | Data | RR3, data | P0 |
| Map labels (LB1) | Built, not measured | Measure; POIs; own names | E | LB1b, LB1c, LB1d | P1 |
| Onboarding, greeting, avatars (19 D3, D11) | Works | — | — | — | — |
| Demo vehicles on Live (AF3) | Works (demo) | Real source behind the same interface | Database | L1 | P0 |
| **Live vehicles from the database** (7.3) | Not built | Realtime subscription, coverage, occupancy, Night Mode | Database, simulator | L1 | P0 |
| Tracking one PUV, ETA (19 D9) | Not built | Card, Track, fade others, ETA | Database, L1 | L2 (AF4, AF5) | P0 |
| **Accounts and username** (19 D6, D7) | Sign-in screen only | Sign-in at first cloud feature; username | Database | SB2, F2 | P0 |
| **Energy** (19 D1, D14) | Not built | Wallet, earn, spend, history | Database | SB2 | P1 |
| **Cloud check-in with counts** (7.5) | Local countdown only | Server check-in, counts per station | Database; GPS for geofence | C1 | P0 |
| Report button (19 D5, D12) | Not built | Picker, seat tier, GPS on or off | Database, L1 | RP1 | P0 |
| Feed (19 D2) | Not built | Fixed phrases, 60 min, flags | Database | N1 | P1 |
| Consent and location (7.1, 15.1) | Dot and explainer, no consent | Consent screen, gates, "Use my location" | GPS, P | G0 | P0 |
| Profile (19 D7, D8, D10) | Settings sheet | Username, badges, delete account | Database | F2 | P1 |
| Suggestions (19 D4) | Placeholder landmarks | Search, map tap | Data | F3 | P2 |
| Badges (19 D8) | Not built | Counts only, no ranking | Database | F5 | P2 |
| Licences, About (15.3) | Works | Fare order citation | Data | — | P2 |

**About half of the commuter side exists; everything not yet built except G0, F3 and the labels needs the database.**

## 2. Order (critical path)

| # | Step | Waits for | Agent meanwhile |
| --- | --- | --- | --- |
| 1 | **SB1** database: migration, functions, retention, tests (written 2026-10-05, not applied) | "Supabase is ready", then each live command approved | SB2 to N1 pure logic and screens against the Demo repositories |
| 2 | **SB2** accounts, username, Energy (client side of `set_username`, `energy_*`) | SB1 applied | F2 Profile screen |
| 3 | **C1** cloud check-in with counts (`check_in`, `checkin_counts`) | SB1 | geofence rule (pure), F4 dots already done |
| 4 | **L1** live vehicles from `telemetry_latest`, fed by the simulator through ingest | SB1, ingest deployed | simulator as an ingest client (dev only) |
| 5 | **L2** tracking with ETA (AF4, AF5) | L1 | ETA rule is pure, tested now |
| 6 | **RP1** report and **N1** feed (`post_report`, `flag_post`) | SB2 | screens on the Demo feed |
| 7 | **G0** consent and location | Emjay's "start G0"; R1a build | consent text draft |
| 8 | **F2** Profile, **F3** suggestions, **F5** badges | SB2 (F2, F5); data (F3) | — |
| Later | LB1c and LB1d, RR3 write, real stops and fare | Data from Emjay | — |
| Deferred | BLE, driver app, SMS, background tracking (B1), moderation beyond flags, V1 real-ride verification | — | — |

**Challenge to the proposed order:** G0 moves after RP1. The live features run on the simulator and team accounts, so no rider location is needed until the report "with GPS" and C1's geofence. **C1's geofence and RP1's GPS report should wait for G0** and ship first as "without GPS" (+0.5 Energy, unverified), so G0 is not on the critical path for the demo.

## 3. Demo mode: what replaces each repository

| Repository (`docs/APP_FEEL_PLAN.md`) | Demo now | Real source | Replaced in |
| --- | --- | --- | --- |
| `VehiclesRepository` | AF3 simulator | `telemetry_latest` + Realtime, fed by ingest | L1 |
| `CheckinsRepository` | No counts ("No data") | `check_in`, `checkin_counts` | C1 |
| `ReportsRepository` (feed) | Not built | `post_report`, `feed_posts`, `flag_post` | RP1, N1 |
| `EnergyRepository` | Not built | `energy_balance`, `energy_earn` (inside the functions), `start_tracking` | SB2 |

Demo stays: the **fallback** when there is no `.env` or no network, and the **panel mode** (Settings, Demo data), always labelled "Demo".

## 4. Removed or merged

| Old step | Now |
| --- | --- |
| ST1, ST2 (smoke test and fixes) | Kept, outside the critical path; run when Emjay and the partner build R1a |
| F4 route-first Check-in | Done in UX3 and AF1 |
| AF6 my position, AF7 counts, AF8 report, AF9 Energy, AF10 hints | Merged into G0, C1, RP1/N1, SB2; AF10 done in AF1 |
| T1 relay broadcast, V1 verification, B1 background | Deferred (driver side and background) |
| S5 vehicles | Merged into L1 |

## 5. Native rebuilds

| Build | Contains | Before |
| --- | --- | --- |
| R1a | `expo-system-ui`, `expo-splash-screen`, icons | G0 on a phone |
| R1b | Only if G0 or C1 need a new module (none planned) | — |

## 6. Data Emjay must gather

| Data | Blocks |
| --- | --- |
| R4 and R5 per-direction legs (or a cycle with its turnaround); the R4 trim decision (backlog 82) | RR3 "write routes"; real fares |
| Stations and terminals with real names, codes and coordinates | C1 counts per real station; F3; N1 stop names |
| Landmarks | F3, onboarding destinations |
| Official fare order | Removing "placeholder" from fares |
| Vehicle list (plates, capacity) | `vehicles` seed beyond test plates |
| Supabase values and two test accounts | SB1 live steps and everything after |
| Cebuano strings; username blocklists; DPO review of the consent text | Public release; G0 for a pilot |

## 7. Decision log

| # | Decision | Source |
| --- | --- | --- |
| 1 | Android only; single Expo app | PRD 0.1 |
| 2 | Email and password team accounts in v0; only team accounts write | PRD 7.1; GPS decisions 8, 13 |
| 3 | Routes stored as directed lines; board and alight anywhere; 500 m walk | PRD changes 1, 3 |
| 4 | Writer audit trail, team accounts only, 30 days | Plan v2 Q14 |
| 5 | Tiles bundled; labels from local glyphs (LB1a, LB1b) | LB1 approval |
| 6 | Light-first Material 3; tabs Live, Check-in, My Ride | Rev. 2 |
| 7 | Check-in is a cloud table; local countdown first | GPS decision 3 |
| 8 | `app_config` holds the server rules, Night Mode window included | GPS decision 4; SB1 |
| 9 | `pg_cron` yes, enabled by Emjay; jobs applied after approval | GPS decision 5; SB1 |
| 10 | Night: hide moving markers 21:00 to 04:59 Manila, on the server | GPS decision 7 |
| 11 | `telemetry_raw` kept, service role only; 7 days, 24 h at night | GPS decision 10; SB1 |
| 12 | `telemetry_writers` renamed `team_accounts` (done in SB1) | Audit 3 decision 2 |
| 13 | D1: tracking 1 Energy per 30 min, free while `energy_enabled` is off | PRD 19.2 |
| 14 | D2: feed with username, fixed phrases, no coordinates or free text, 60 min, 3 unique flags hide and queue | PRD 19.2 |
| 15 | D3: gender, avatar, fare type, destinations stay on the phone; `profiles` has the username only | PRD 19.2; SB1 |
| 16 | D7: username 3 to 20 letters, digits, underscore | PRD 19.2 |
| 17 | D9: simple ETA, limits 5 km/h, 90 s, 2 samples, 10 km | PRD 19.2 |
| 18 | D10 and PRD 15.1: `delete_my_account` removes all of the user's rows and the account | SB1 |
| 19 | D14: server-side Energy ledger; atomic, idempotent, caps by the Manila day; wallet 5 | PRD 19.2; SB1 |
| 20 | Clients only read tables; every write goes through a function | SB1 |
| 21 | Demo mode on by default for the prototype, always labelled | AF2 |
| 22 | First-pass snapping; terminal trim 150 m / 300 m; Draft until both legs come from files | RR2 |
| 23 | No pushes unless Emjay writes "push" and names what; keep `integrate-partner` | Standing |
| 24 | The agent asks before any native build and any live Supabase command | Standing |
| 25 | `DEO` is a placeholder station (moved onto the R4 line, not verified) | PRD changes 2; RR1 |
| 26 | SMS wrap window 1 to 5,000 ahead mod 10,000; packets older than 120 s or 30 s ahead rejected | PRD changes 4 |
| 27 | Draggable sheet, three snap points | UX2 |
| 28 | `expo-system-ui` in the first rebuild; `expo-splash-screen` added; `eas.json` kept | GPS decision 2; 2026-10-04 |
| 29 | Activity recognition skipped; `getActivity()` returns `unknown` | GPS decision 6 |
| 30 | Consent text: English draft for later DPO review | GPS decision 9 |
| 31 | Mock counter in the session keepalive, not the packet | GPS decision 11 |
| 32 | Route import writes only on Emjay's word ("write routes") | GPS decision 12; RR3 |
| 33 | Advisories deferred; never `npm audit fix` | GPS decision 15 |
| 34 | D4: landmarks seed or map tap; at most 3 destinations | PRD 19.2 |
| 35 | D5: manual vehicle picker behind a dev flag; BLE later | PRD 19.2 |
| 36 | D6: sign-in asked at the first cloud feature | PRD 19.2 |
| 37 | D8: count badges, no leaderboard or ranking | PRD 19.2 |
| 38 | D11: persona Tunton; greeting lines kept | PRD 19.4 |
| 39 | D12: floating Report button; feed in the expanded Live sheet | PRD 19.2 |
| 40 | D13: route-first Check-in with coloured dots and fading | PRD 19.2 |
| 41 | Avatar button opens Profile, which holds the settings rows | Flow decision 6 |
| 42 | Merge: his GPS on Live behind a first-tap explainer; his R4 trace a candidate only | Merge approval |
| 43 | Tile file tracked in git; old docs not deleted | Merge answers 4, 5 |
| 44 | Blue dot 2 s or 5 m, display only | Merge answer 7 |
| 45 | Rebuilds R1a now, R1b later; Emjay and the partner build | Merge answer 8 |
| 46 | "Use my location": the GPS fix, else the manual pin (G0) | 2026-10-04 |
| 47 | Crashes: reproduce and count; never patch a library on one crash | Audit 3 decision 3 |

## 8. Open questions

| # | Question | Blocks |
| --- | --- | --- |
| 1 | Move G0 after RP1 and ship reports and check-in "without GPS" first (§2)? | Order |
| 2 | Is deleting the auth account inside `delete_my_account` acceptable, or should an Edge Function do it? | SB1 live test |
| 3 | Do non-team accounts see the live map in v0 (today: any signed-in user reads vehicles)? | L1 |
| 4 | Night Mode: hide moving markers only (as built), or every marker? | L1 |

## 9. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | Supabase never becomes ready | Demo repositories and pure rules keep every screen working |
| 2 | Docker needed for function deploys | Stop and report the options |
| 3 | `postgres` cannot delete from `auth.users` on this project | Question 2; Edge Function fallback |
| 4 | Placeholder stops and fares in the thesis | Labelled "Sample data"; data gathering in parallel |
| 5 | Consent gap if the build leaves the team | Private build until G0 |
| 6 | Emulator numbers are not a phone | Partner's phone for frame rate and battery |
