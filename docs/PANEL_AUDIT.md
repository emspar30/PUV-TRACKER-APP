# Panel comment audit

**Date:** 2026-11-04. **Commit:** `98846cc` (main). **Summary:** of the 26 comments from the proposal defense of April 29, 2026, the app fully answers 5, partly answers 17, answers 2 without a document that explains it, and 2 are manuscript questions. The largest gap is measurement: almost no accuracy, delay or user-acceptance figure exists yet.

This is an audit only. No code, configuration, migration or test was changed. Evidence was read from the code, the migrations, the tests and `docs/`; the other documents were used as leads and checked against the code.

Status codes: DONE (built and covered by a test or device check), PARTIAL (what is missing is stated), DOC ONLY (handled by the app, but no document answers the panel), NOT BUILT, MANUSCRIPT, NOT FOUND.

## 1. Summary table

| ID | Panelist | Short comment | Status | Evidence | Gap or next step |
| --- | --- | --- | --- | --- | --- |
| S1 | Sagusay | Will commuters keep using it? | PARTIAL | Energy earn and spend, cap 5 (`src/shared/config/index.ts:464-483`, migration `20261101000000_relay_energy`); trust badge at 5 points (`config:504`); count badges (`config:645-647`, `badges.test`); Trust Level (`20261102000002_moderation.sql:275-311`); coverage nudge (`src/shared/telemetry/coverage.ts:31`, `src/strings/en.ts:418-421`) | Nothing measures returning users. PRD 3.3 sets "weekly retention 30 % or more, measured by Analytics", but there is no analytics (traceability A4, NOT BUILT). No reminders reach the phone's notification shade (see S6) |
| S2 | Sagusay | Accuracy of vehicle location | PARTIAL | Relay fixes need 30 m accuracy and no mock flag (`config:424`, `src/shared/location/accuracyGate.ts:28`); verification window: every fix within 30 m of the route line (`supabase/functions/_shared/serverConfig.ts:79-85`, `verifyWindow.test`); impossible jumps over 120 km/h refused (`serverConfig.ts:71`, `riskSignals.test`); Live under 90 s, Estimated to 5 min, Stale to 10 min (`config:63-72`, `coverage.ts:14-18`, `coverageFallbacks.test`) | Position error has never been measured. PRD 3.3 target: median 50 m or less against a reference logger. E3 measures only the Check-in card's GPS accuracy at terminals, not the marker's error |
| S3 | Sagusay | Correctness of ETA | PARTIAL | `src/shared/tracking/eta.ts:45-71`: distance along the route at the recent median speed; hidden under 5 km/h, beyond 10 km or with fewer than 2 speed samples (`config:132-136`); `eta.test` ("ETA (D9)", "the live ETA now (L2)") | No log of predicted against actual arrival. The field test log records no ETA event (`docs/FIELD_TESTS.md`, event table), and no experiment E1 to E9 covers ETA. `PROPOSAL_TRACEABILITY.md` O1 says "field test E1" for ETA, but E1 is the Bluetooth test |
| S4 | Sagusay | Relevance of traffic updates | PARTIAL | Report phrases "Heavy traffic" and "Not moving" (`config:499`, `en.ts:139-141`), shown on the multicab card (`src/shared/telemetry/vehicleStatus.ts:22`, `en.ts:484`); "Stopped" state (`serverConfig.ts:9`, `config:60`); detours turned on by an admin (migration `20261102000003_detours`); relays in high-traffic zones end later (`config:551`, `src/shared/relay/limits.ts:5`) | No traffic layer, no delay estimate in the ETA, and no measure of whether these reports are relevant |
| S5 | Sagusay | Timeliness of commuter reports | PARTIAL | Check-ins end at 15 min (`config:440`); posts at 60 min (`config:492`); a relay post lapses 15 min after its last renewal (`20261023000000_relay_gate.sql:17-19`, `61-80`); "x min ago" labels (`en.ts:145`); marker age states (S2) | The relay-to-map delay (N1, target under 5 s) has not been measured |
| S6 | Sagusay | Notification system | PARTIAL | In-app: tracking alerts at 2 min ETA and at 1 km, 500, 250 and 100 m, with vibration (`config:138-140`, `src/app/(tabs)/index.tsx:329-360`); "Did you board?" (`en.ts:733-734`); "Get ready to get off" 300 m before the stop, as a toast (`src/features/report/useRelayBroadcast.ts:107`, `config:535`); the Notifications page (`src/shared/notifications/inbox.ts:1-3`). Phone shade: only the relay's foreground-service notice (`src/services/location.ts:112-116`, `en.ts:267`) and the driver beacon's service (`modules/tunton-beacon/.../BeaconAdvertiserService.kt`). Driver: waiting counts by real SMS (`docs/device-tests.md`, DR7-M2) | No push notifications: `expo-notifications` is not a dependency (`package.json:5-38`). Tracking alerts and "Get ready to get off" are missed when the app is in the background. `SCOPE_AND_LIMITS.md` section 4 states this limit |
| S7 | Sagusay | Source of "449 operational units" | MANUSCRIPT | No file in the repository records this figure or its source | Manuscript team |
| S8 | Sagusay | Cost-effective? | PARTIAL | Render free plan, Singapore (`render.yaml`, `plan: free`); Supabase free or low-cost tier assumed for about 10 vehicles (PRD 18.2, `docs/PRD.md:1080`; risk 13 at `PRD.md:1021`); SMS volume about 1,700 a day for 10 vehicles and the telco fair-use risk (PRD 9.6, `PRD.md:610-612`); gateway daily cap 100 SMS (`config:716`); no hardware per vehicle, drivers use their own phone and need no mobile data after setup (PRD 6.4, `PRD.md:378`; PRD 9.5) | No peso figure exists anywhere: no SIM or promo price, no Supabase plan cost, no gateway phone cost. A cost comparison needs these from the team |
| S9 | Sagusay | Is the map "accurate"? | PARTIAL | Beacon check (`src/shared/beacon/code.ts`, `presence.ts`; `relayGate.test`); Smart Queue (`config:610-614`, `relayQueue.test`); verification window (S2); expiry (S5); moderation (D2) | Accuracy is enforced but not measured. Say "kept accurate by these controls" rather than "remains accurate" until E2, E9 and a position-error test have been run |
| S10 | Sagusay | Make it a problem statement | MANUSCRIPT | — | Manuscript team |
| S11 | Sagusay | How do we evaluate effectiveness and usability? | PARTIAL | `docs/TESTER_SURVEY.md`: feature grid (item 8), SUS (items 11-20, scoring at line 62), ISO/IEC 25010 (items 21-31), recommend 0-10 (32), "use every day" (33). In-app link: Menu, Give feedback (`src/app/menu.tsx:50-58`) | SUS covers usability. Effectiveness and intention to use rest on items 32 and 33 only. No TAM items. `FEEDBACK_FORM_URL` is empty (`config:659`), so the Menu link is hidden. The survey has not been run (traceability O6) |
| D1 | Dalaorao | Evaluate effectiveness (SUS, TAM or UTAUT) | PARTIAL | As S11 | No TAM construct is measured. Section 5 proposes 11 items |
| D2 | Dalaorao | What happens to a false seat report? | PARTIAL | Full path in section 2.1: flag (`20261102000002_moderation.sql:149-203`), point taken back (`20261009000001_trust_points.sql:92-115`), strike, Merit shield, suspension and appeal (`moderation.sql:83-128`, `223-271`), deletion (`supabase/cron/retention.sql:12-16`); `moderation.test`, `moderationRules.test`, `moderationMigration.test` | Hiding a post does not touch the live marker: its seats come from the position stream (`telemetry_latest.seats_taken`, `supabase/functions/_shared/ingestCore.ts:142`), which flags never reach. Energy earned by the post is not taken back. The retention jobs are not a migration and may not be applied (question 1) |
| D3 | Dalaorao | Who updates the PUV location? | DONE | The driver and gateway apps are built with no location permission (`app.config.js:10-14`, `40-44`, `55-56`); only the commuter app has location and Bluetooth scan (`app.config.js:29`); the commuter's phone sends GPS automatically while relaying (`src/shared/telemetry/sendRule.ts:1-4`); `ingest.test`; device checks DR8-M1 and DR7-M2 (`docs/device-tests.md`) | None. The section 2.2 text can be read aloud |
| D4 | Dalaorao | Tech stack | DONE | Section 2.6 lists it from `package.json`, `app.config.js`, `supabase/config.toml`, `render.yaml`, `admin/`, `services/sms-worker` | Traceability N5 already lists it for the manuscript |
| A1 | Araneta | Measurable objectives | PARTIAL | Section 3 lists 29 targets with their source | Few targets have been measured (section 3). The objectives can be rewritten from this table |
| A2 | Araneta | Is it really real-time? | PARTIAL | Section 2.3: send rule (`config:56-57`), store and forward (`config:172-177`, `src/shared/telemetry/outbox.ts`), ingest (`ingestCore.ts:241-325`), Realtime (`20261003000000_v0_core.sql:194`, `src/services/liveVehicles.ts:33-36`) | End-to-end delay not measured. Live markers are shown only to team accounts in this phase (`v0_core.sql:177-190`, PRD 0.7); others see relays in Crowdsource |
| A3 | Araneta | Reliability of crowdsourced data | PARTIAL | Section 2.4 lists one or more controls per threat | Gaps: the ingest function checks only the team allowlist, not a suspension (`supabase/functions/ingest/index.ts:31-35`); no device fingerprint, so a suspended user can make a new account (PRD 0.6, D7); a hidden post leaves the live marker (D2) |
| A4 | Araneta | What if no one reports? | DONE | No vehicle: "No data from commuters right now" (`en.ts:413`); Stale and Estimated markers (`coverage.ts:1-2`, `config:68-75`, `coverageFallbacks.test`); route status "No data" (`coverage.ts:21-27`); coverage nudge (`coverage.ts:31`); Demo data mode (`src/app/demo-settings.tsx`); check-in counts still reach drivers by SMS (DR7-M2) | Cold-start plan (PRD 5.2, team rides at set times) is a plan, not a feature |
| A5 | Araneta | Internet dependency | DONE | Offline: map tiles, routes, planner, fares, Ask Tunie, the last Crowdsource feed with its age (`src/shared/feed/saved.ts:39-45`, `en.ts:102`), offline banner (`en.ts:353`), `offlineMap.test`. Store and forward for relay positions: newest 60 kept in SQLite, sent as a batch, retried 5 to 60 s (`config:172-177`, `outbox.ts:1-3`, `ingest.test` "accepts a batch of buffered positions (T1)") | Starting a relay, checking in and flagging need data and are refused offline with a message (`en.ts:104`, `338`; commit `ba52745`); there is no queue for them |
| A6 | Araneta | TAM + ISO 25010 | PARTIAL | As S11 | As D1 |
| A7 | Araneta | How will you make it effective? | PARTIAL | Adoption: as S1. Measurement: as S11 | No effectiveness measure beyond the survey; no usage analytics |
| A8 | Araneta | New concept vs Google Maps, Waze, Sakay.ph | DOC ONLY | Section 2.5 lists Tunton's own features with evidence | No document compares the apps. The team checks the other apps |
| A9 | Araneta | Privacy of continuous tracking | PARTIAL | Section 2.5: consent (`src/app/consent.tsx`, `src/shared/location/consent.ts`, version 3 at `config:432`), Withdraw (`src/app/settings.tsx:23-39`), Delete account (`v0_core.sql:594-611`, `src/features/account/deleteAccount.ts`), Row Level Security on all 31 tables, `privacy.test` | The retention jobs that delete raw and night positions are in `supabase/cron/retention.sql`, which says it is "NOT a migration and NOT applied" until pg_cron is enabled (line 1-3). If it was never run, nothing is deleted on a schedule (question 1). Consent text awaits the DPO (`SCOPE_AND_LIMITS.md` section 4) |
| A10 | Araneta | Real-time tracking without internet? | DONE | As A5, plus the offline banner within about a second (`SCOPE_AND_LIMITS.md` section 1, `CONNECTION_PROBE_S` at `config:653`), and the driver side on SMS with no data (`config:689-716`, DR7-M2) | Honest answer: live markers cannot update without internet on the commuter's phone; positions taken offline are sent when it reconnects |
| E1 | ERD | Add a role table | DOC ONLY | No `role` column on users: `profiles` holds only `user_id`, `username`, `created_at` plus trust and moderation columns (`v0_core.sql:71-75`, `moderation.sql:26-31`). Roles are allowlist tables keyed to `auth.users`: `team_accounts` (`v0_core.sql:55-59`) and `admin_accounts` (`20261027000000_driver_registration.sql:19-22`). Drivers are not user accounts: `driver_devices` (`20261013000000_driver_side.sql:41-51`), `driver_registrations` (`driver_registration.sql:88-94`). `relay_sessions.role` is the Primary or Secondary rider, not a user role (`20261102000001_relay_baton.sql:20`) | No redundancy found; see section 2.7. Figure 3.3 needs redrawing from the real tables |

## 2. Detail: answers to read aloud

### 2.1 D2: what happens to a false or inaccurate seat report

"A seat report is a Crowdsource post sent from a relay. Any commuter can flag it with a reason: false location, spamming or not a PUV. To flag, the account must be at least 7 days old, or already trusted, and may flag at most 10 posts a day, once per post. A flag counts toward hiding only if the flagger's account is at least 48 hours old and the flagger is not mostly flagging the same author. When three counting flags arrive within the flag window, the post is hidden from everyone and queued for a moderator. The first flag from someone else also takes back the trust point the author earned for that post.

A strike comes in two ways: a moderator confirms the report, or the post is hidden while the author already has a risk event from the last day, such as a mock GPS fix or an impossible jump. If the author has a Merit shield left (one per 100 trust points, at most 3), the shield absorbs the strike. Two counting strikes within 30 days suspend the account for 7 days. A suspended account cannot post, check in, flag or earn Energy. The author can appeal a strike once, within 30 days. If the appeal is upheld, the strike is lifted, a used shield is given back and the suspension ends. Strikes expire after 60 days.

The post itself ends 60 minutes after posting, or when the relay ends, and the retention job deletes it. Flags are deleted after 30 days."

| Step | Evidence |
| --- | --- |
| Flag reasons | `moderation.sql:168` (`false_location`, `spamming`, `not_a_puv`); `config:526` |
| Who may flag: 7 days or trusted, 10 a day | `moderation.sql:170-176`; `config:515-517` |
| Flag counts: account 48 h old, not targeting one author | `moderation.sql:179-185`; `config:516` |
| 3 counting flags hide the post, review queue | `moderation.sql:189-194`; `config:496` |
| Trust point taken back on the first flag | `20261009000001_trust_points.sql:92-115` |
| Automatic strike on risk evidence | `moderation.sql:194-197`; risk kinds at `20261029000001_risk_signals.sql:24` |
| Moderator strike | `moderation.sql:206-220` |
| Merit shield | `moderation.sql:104-128`; `config:523-524` |
| Suspension, 2 strikes in 30 days, 7 days | `moderation.sql:83-101`, `131-144`; `config:519-521` |
| Appeal and decision | `moderation.sql:223-271`; `src/app/appeal.tsx` |
| Strike expiry 60 days | `moderation.sql:16`, `120`; `config:518` |
| Post deleted after expiry, flags after 30 days | `supabase/cron/retention.sql:12-16` |
| Tests | `moderation.test`, `moderationRules.test` ("MOD1 rules"), `moderationMigration.test`, `trust.test` |

**What the answer must not claim:**

- Hiding a post does not change the live map. The marker's seat number comes from the relaying phone's position packets (`ingestCore.ts:142`), not from the post.
- The Energy the post earned is not taken back. No migration reverses it.
- The flag weight depends on account age and flagging pattern, not on trust points. `PROPOSAL_TRACEABILITY.md` (O4) and `MANUSCRIPT_BRIEF.md` say "weighted by trust", which is imprecise. Trust only lets an account younger than 7 days flag at all.
- Strike, appeal and risk-event rows have no retention job. They stay until the account is deleted (cascade from `auth.users`).

### 2.2 D3: who updates the multicab's location

"The commuter's phone does it, automatically. When a commuter on board starts a relay, their phone reads its own GPS and sends the multicab's position every 100 metres or every 30 seconds, whichever comes first. The driver's phone sends no location at all; the driver app is built without the location permission. The driver's phone only broadcasts a rotating Bluetooth code, which proves to the commuter's phone which multicab it is in. Two things are manual: the commuter taps to start the relay, and chooses the seat level: seats available, filling up or full."

| Point | Evidence |
| --- | --- |
| Driver and gateway apps have no location permission | `app.config.js:10-14` (LOCATION), `40-44` (comment), `55-56` and `75-76` (blocked) |
| Only the commuter app scans Bluetooth | `app.config.js:27-29` |
| Automatic send rule | `src/shared/telemetry/sendRule.ts:1-4`; `config:56-57` |
| Background relay with a notification | `src/services/location.ts:110-116`; `en.ts:267` |
| Rotating beacon code | `src/shared/beacon/code.ts`; `BEACON_SLOT_S` 60 s at `config:678`; DR8-M2 replay refused (`docs/device-tests.md`) |
| Manual: seat level | three levels by seats of 16 (`src/shared/telemetry/occupancy.ts`; `config:179`) |
| Manual: the start (Send) | the Relay form (`src/features/report/ReportSheet.tsx`); post via `post_report` (`20261101000000_relay_energy.sql:72`) |

### 2.3 A2: the real-time data path

"Tunton is near real time and crowdsourced. A commuter riding the multicab relays it. Their phone makes a position packet every 100 metres or 30 seconds. Each packet is first stored on the phone, then sent to our server, so a dead zone does not lose it. The server checks who sent it, that it is small, recent and not impossible, and that this rider is the multicab's main relayer. It then updates the multicab's one current row, and the database pushes that row at once to every map that is open. The map redraws every 5 seconds. A marker is Live while its last position is under 90 seconds old. From 90 seconds to 5 minutes it is shown as Estimated, moved along the route at its recent speed. Up to 10 minutes it is Stale, and after that the route shows No data."

| Step | Value | Evidence |
| --- | --- | --- |
| Packet made | every 100 m or 30 s | `config:56-57`; `sendRule.ts` |
| Stored on the phone, sent as a batch | newest 60; retry 5 s doubling to 60 s | `config:172-177`; `outbox.ts` |
| Server checks | token, team allowlist, at most 150 bytes, at most 120 s old and 30 s in the future, no jump over 120 km/h, Primary rider only | `ingestCore.ts:241-303`; `serverConfig.ts:12-22`, `71` |
| Marker row updated | `telemetry_latest` | `ingestCore.ts:306-308` |
| Pushed to open maps | Supabase Realtime | `v0_core.sql:194`; `src/services/liveVehicles.ts:33-36` |
| Fallback reload, UI redraw | 30 s, 5 s | `config:168`, `66` |
| Live, Estimated, Stale, No data | under 90 s, to 5 min, to 10 min | `config:63-65`, `72`; `coverage.ts` |
| Second rider takes over | after 90 s of silence | `config:589-590`; `ingest.test` "BT1: only the Primary rider moves the marker" |

**Not measured:** the delay from a packet leaving the phone to the marker moving (N1, target under 5 s). The 5 s target applies to that delay. A marker can still be up to 30 s behind the multicab, because packets are made every 30 s when it moves less than 100 m. Before the final defense, say which of the two the "under 5 s" claim means (question 6). Also, only team accounts see live markers in this phase (`v0_core.sql:177-190`).

### 2.4 A3: reliability of crowdsourced data

"Every relay must come from a phone that hears the multicab's own Bluetooth code, which changes every minute and is checked by the server. Positions that are faked, old or impossible are refused, and each sender is limited. Reports from the crowd are then moderated by weighted flags, strikes and suspensions."

| Threat | Control in code | Evidence |
| --- | --- | --- |
| Fake report from someone not on the multicab | Beacon code required and checked by the server; route and vehicle must match | `relay_energy.sql:88-93`; `beacon/code.ts`; `relayGate.test`; DR8-M2 |
| Wrong multicab at a terminal | Smart Queue holds the relay until the multicab moves 50 m; falls back after 30 min; two beacons within 8 dB stay ambiguous | `config:610-614`, `665`; `relayQueue.test`; `beacon/presence.ts:4-8` |
| Inaccurate position | 30 m accuracy gate; verification window: 25 km/h for 20 s, within 30 m of the route, 50 m travelled | `config:424`; `serverConfig.ts:79-85`; `verifyWindow.test` |
| Teleport or forged packet | Over 120 km/h from the last position refused and booked as a risk event | `serverConfig.ts:71`; `ingestCore.ts:299-303`; `riskSignals.test` |
| Mock (fake GPS) location | Fix refused on the phone and reported as a risk event | `accuracyGate.ts:28`; `src/services/risk.ts:10-15`; `risk_signals.sql:4` |
| Old or replayed packet | At most 120 s old, 30 s ahead; never older than the current marker | `serverConfig.ts:12-13`; `ingestCore.ts:280-286`; `ingest.test` "keeps only the newest position" |
| Two riders on one multicab | Only the Primary moves the marker | `ingestCore.ts:288-297` |
| Spam | Same multicab once in 3 hours; Energy cap 5; trust points at most 3 a day | `relay_energy.sql:94-102`; `config:464`, `477`, `506` |
| Flag abuse | Account age 7 days, 10 flags a day, weight rule | `moderation.sql:170-185` |
| False content | 3 counting flags hide; strikes; 7-day suspension; appeal | Section 2.1 |
| Inactive users (stale data) | Relay ends at the stop, after 20 min still (30 at a terminal) or at the 3-hour check; post lapses 15 min after the last renewal; marker ages to Stale and No data | `config:531-546`; `relay_gate.sql:8-12`; `coverage.ts` |

**Threats with no full control:**
- **Suspension at the ingest function.** The ingest function checks only the team allowlist (`ingest/index.ts:31-35`), not a suspension. Through the app, a suspended account cannot start a relay, because `post_report` checks `may_participate` (`relay_energy.sql:85`). It has not been checked whether the app's position stream stops when a suspension starts mid-relay.
- **Ban evasion with a new account.** There is no device fingerprint (PRD 0.6, D7). The beacon requirement still means the rider has to be on a real multicab.
- **A hidden report stays on the live marker** (section 2.1).

### 2.5 A9: privacy of continuous location tracking

"Location is used only when the commuter checks in or relays, and only after they agree to a privacy notice. They can withdraw consent at any time in Settings, and delete their account, which removes their profile, posts, check-ins, flags and Energy. While relaying in the background, Android shows a permanent notification. What reaches the map is the multicab, never the rider: the position tables have no user column. Every table has row-level security, and clients cannot write any table directly. The avatar, gender, fare type and saved places never leave the phone, and an automated test enforces it. At night the map shows no multicab at all, and positions received at night are kept only 24 hours."

| Point | Evidence |
| --- | --- |
| Consent before any location use, version 3 | `src/app/consent.tsx`; `src/shared/location/consent.ts:1-30`; `config:432` |
| Withdraw | `src/app/settings.tsx:23-39` |
| Delete account | `v0_core.sql:594-611` (posts, check-ins, flags, Energy, profile, user); other tables cascade from `auth.users` |
| Background only with a notification, only while relaying | `src/services/location.ts:110-116`; `app.config.js:40-44` |
| No identity on the map | `telemetry_latest` and `telemetry_raw` have no user column (`v0_core.sql:156-168`, `200-210`) |
| Who sent which packet | `telemetry_ingest_log`, server-only, team writers, 30 days (`v0_core.sql:225`; `serverConfig.ts:25`) |
| Row Level Security | 31 tables, 31 `enable row level security` statements in `supabase/migrations/` |
| Profile data stays on the phone | `privacy.test` ("code that talks to the backend never mentions the classification, gender, avatar or destinations") |
| Night Mode: no multicab shown | migrations `20261029000002_night_stop_view`, `20261103000000_night_no_markers`; `nodePassage.test` |
| Retention | `supabase/cron/retention.sql:9-36`: raw positions 7 days, night positions 24 h, check-ins on expiry, posts on expiry, flags 30 days, ingest log 30 days |

**Gaps:**
- The retention file is not a migration. Its header says it is "NOT applied" until pg_cron is enabled (`retention.sql:1-3`). Confirm it was run on the live project (question 1). Without it, nothing is deleted on a schedule, except the ingest log, which the ingest function also purges (`ingest/index.ts:137`).
- The consent text awaits the Data Protection Officer.
- DR8-M1 found that the consent text does not say that Bluetooth scanning relies on location (`docs/device-tests.md`, 2026-10-17).

### 2.6 D4: tech stack (from the files)

| Part | Technology and version | Source |
| --- | --- | --- |
| Commuter, driver and gateway apps | Expo SDK 57 (`expo ~57.0.27`), React Native 0.86.3, React 19.2.3, TypeScript ~6.0.3, Expo Router ~57.0.25, Android only; one codebase, three variants | `package.json:10-31`, `54`; `app.config.js:8` |
| Map | MapLibre React Native ^11.4.1 with bundled offline OpenStreetMap tiles | `package.json:6`; `docs/tiles.md` |
| On-phone data | expo-sqlite ~57.0.4, zustand ^5.0.15 | `package.json:24`, `38` |
| Location, background, sensors | expo-location ~57.0.20, expo-task-manager ~57.0.21, expo-battery ~57.0.3 | `package.json:12`, `20`, `27` |
| Native modules (Kotlin) | `tunton-beacon` (BLE advertise and scan), `tunton-motion` (activity recognition), `tunton-sms` | `modules/` |
| Geometry and crypto | @turf/turf ^7.4.0, @noble/hashes ^2.4.0 (HMAC beacon code) | `package.json:7`, `9` |
| Backend | Supabase: PostgreSQL 17, Row Level Security, Realtime, Edge Functions on Deno 2 (`ingest`, `driver-registration`); supabase-js ^2.117.2; CLI ^2.119.0 | `supabase/config.toml:41`, `384`; `package.json:8`, `52` |
| SMS worker | Node.js 22 on Render (free plan, Singapore), bundled with esbuild | `render.yaml`; `package.json:68-69` |
| Admin console | React with Vite ^8.3.5, static site on Render | `admin/`; `package.json:45`, `55`, `70-71`; `render.yaml` |
| Testing | Jest ~29.7.0 with jest-expo, ESLint 9 with eslint-config-expo, `tsc --noEmit` | `package.json:46-49`, `72-74` |
| Builds | EAS (`eas.json`) | `eas.json` |

### 2.7 E1: roles and the ERD

There is no `role` column, so the redundancy the panel saw in the proposal's User table does not exist in the build. A role is the presence of a row in an allowlist table keyed to `auth.users`: `team_accounts` (may write positions in this phase) and `admin_accounts` (may use the console). A user with no row is an ordinary commuter. Drivers have no user account; each driver phone is a `driver_devices` row tied to a vehicle. **Recommendation:** no `roles` table is needed for three roles. A `roles` table plus a `user_roles` join table would only pay off with many roles or roles that change per user. Redraw Figure 3.3 with the allowlist tables shown as one-to-one extensions of the user.

Real tables (31): `profiles`, `team_accounts`, `admin_accounts`, `account_review_queue`, `app_config`, `vehicles`, `vehicle_beacons`, `beacon_verify_calls`, `telemetry_latest`, `telemetry_raw`, `telemetry_ingest_log`, `relay_sessions`, `checkins`, `feed_posts`, `feed_flags`, `feed_review_queue`, `strikes`, `appeals`, `risk_events`, `energy_ledger`, `node_events`, `off_route_days`, `route_alternatives`, `driver_registrations`, `registration_checks`, `driver_devices`, `driver_settings`, `gateways`, `sms_outbox`, `sms_dispatch_state`, `ops_alerts`.

### 2.8 A8: what Tunton has (for the team's comparison)

As far as the code shows, these are Tunton's own features. The team checks whether Google Maps, Waze and Sakay.ph have them.

| Feature | Evidence |
| --- | --- |
| Live multicab positions from commuters on board, proven by the driver phone's rotating Bluetooth code | `beacon/code.ts`; `relay_energy.sql:88-93` |
| Smart Queue for multicabs side by side at a terminal | `config:610-614` |
| Seat level per multicab (three levels of 16 seats) | `occupancy.ts`; `config:179` |
| Butuan multicab routes R1 to R5 and R14 with their stops, offline | `PROPOSAL_TRACEABILITY.md` N7; `offlineMap.test` |
| Offline fare with the 20 % student, senior and PWD discount | `fare.test`; `fareType.test` |
| Check-in demand counts sent to drivers by SMS, with no mobile data on the driver's phone | `config:689-716`; DR7-M2 |
| Night Mode that hides every multicab (anti-stalking) | `20261103000000_night_no_markers` |
| Energy, trust and moderation for crowd reports | Sections 2.1, 2.4 |
| Ask Tunie, an offline assistant with Bisaya phrases | `src/features/assistant` |

## 3. Measurable targets (A1)

| Target | Value | Where set | Measured? |
| --- | --- | --- | --- |
| Position sync (N1) | under 5 s | Proposal 3.3.2.2; `PROPOSAL_TRACEABILITY.md` N1 | No |
| Marker freshness while relaying | p90 age 30 s or less | PRD 3.3, 13 | No |
| Position accuracy | median 50 m or less | PRD 3.3 | No |
| Boarding detection recall | 90 % or more | PRD 3.3 | No |
| Wrong-vehicle lock at terminals | 2 % or less | PRD 3.3; E2 | No |
| Primary rider battery | 5 % per hour or less | PRD 3.3, 13; E4 | No |
| Secondary rider battery | 2 % per hour or less | PRD 3.3 | No |
| Data while relaying | 150 KB per hour or less | PRD 3.3, 13; E6 | No |
| Route coverage | a live marker 60 % of operating hours | PRD 3.3 | No |
| Offline route and fare | 250 ms or less at p95 | PRD 3.3, 13; E8 | No |
| Weekly retention | 30 % of week-1 users active in week 4 | PRD 3.3 | No (no analytics) |
| Driver heatmap usefulness | majority of drivers changed a decision | PRD 3.3 | No |
| Map frame rate | 55 FPS with 50 markers | PRD 13 | No |
| Cold start to offline map | 4 s or less | PRD 13 | No |
| Delivery after a 10-minute signal loss | 95 % in order | PRD 13 | Batch logic unit-tested (`ingest.test` T1); not field-tested |
| SMS delivery | p90 60 s or less; 98 % over 7 days | PRD 13; `config:752` | Partly: 7 trials of 15 to 41 s, all delivered (DR7-M2, 2026-10-17 and 10-18); no 7-day trial |
| Beacon code replay | codes older than 2 slots refused | PRD 13; `config:678-679` | Yes: DR8-M2 (`beacon_expired`) |
| Night window set by the server | phone clock has no effect | PRD 13; `is_night` (`v0_core.sql:120`) | Rule in the database; no clock test found |
| Night positions deleted | within 24 h | PRD 13; `retention.sql:21-24` | No (job may not be applied) |
| Android range | 8.0 or newer, six vendor skins | PRD 13; E5 | Partly: Samsung, Xiaomi/POCO, HONOR used in device tests |
| ETA shown only when useful | hidden under 5 km/h, beyond 10 km, under 2 samples | `config:132-136` | Rule, `eta.test` |
| Arrival alerts | 2 min ETA; 1 km, 500, 250, 100 m | `config:138-140` | Rule, `eta.test` |
| Marker states | Live under 90 s, Estimated to 5 min, Stale to 10 min | `config:63-72` | Rule, `coverageFallbacks.test` |
| Lifetimes | check-in 15 min; post 60 min | `config:440`, `492` | Rule, tests |
| Bluetooth presence | -65 dBm, lead of 8 dB | `config:663-665` | Bench only: -65.5 to -67 dBm at 1 m, -46 to -48 side by side (DR8-M1) |
| Verification window | 25 km/h for 20 s, within 30 m, 50 m, in 30 to 90 s | `serverConfig.ts:79-85` | Rule, `verifyWindow.test`; E9 not run |
| Get-off warning | 300 m before the stop | `config:535` | Rule; device check |
| SUS score | 68 is average | `TESTER_SURVEY.md:62` | No (survey not run) |
| ISO/IEC 25010 rating | Table 3.2 interpretation; no pass mark set | Manuscript | No |

## 4. Survey gap (S11, D1, A6)

**What the survey measures today** (`docs/TESTER_SURVEY.md`):

- Self-reported feature success, from "worked well" to "did not try" (item 8).
- Usability with the SUS (items 11-20).
- ISO/IEC 25010 quality (items 21-31). There are 11 items over 6 characteristics; Objective 6 names only 3 of them.
- Loyalty (item 32, recommend 0 to 10) and a single intention item (33, "use every day").

Effectiveness (did the commuter get a correct answer faster or with less waiting) is not measured. TAM constructs are not measured as such.

**Proposed TAM items** (proposal only, adapted from Davis, 1989; same 1 to 5 scale). If they are added, the SUS stays for usability, so ease of use is kept short.

| # | Item | TAM construct |
| --- | --- | --- |
| T1 | Using Tunton helps me know when a multicab will arrive. | Perceived usefulness |
| T2 | Using Tunton reduces my waiting time at the stop. | Perceived usefulness |
| T3 | Tunton helps me choose the right route and fare. | Perceived usefulness |
| T4 | Overall, Tunton is useful for my daily commute. | Perceived usefulness |
| T5 | Learning to use Tunton was easy for me. | Perceived ease of use |
| T6 | It is easy to make Tunton do what I want, such as check in or relay. | Perceived ease of use |
| T7 | Using Tunton is a good idea. | Attitude toward using |
| T8 | I like the idea of sharing my ride to help other commuters. | Attitude toward using |
| T9 | I intend to use Tunton when it covers my route. | Behavioral intention |
| T10 | I will relay my multicab when I ride, if I can. | Behavioral intention |
| T11 | I would recommend Tunton to other commuters. | Behavioral intention |

T9 overlaps item 33 and T11 overlaps item 32. If the TAM items are added, drop or keep those two consistently. For drivers, T1 to T3 need driver wording, for example "The waiting counts help me decide where to go".

## 5. Features that are not built

| Item | Size | Realistic before November 26, 2026? |
| --- | --- | --- |
| ETA log: predicted ETA against actual arrival, in the field test log | Small | Yes; then needs rides |
| Relay-to-map delay log (packet time against the time the map received it) | Small | Yes; then needs rides |
| Weekly active users and retention as an SQL view, or a console page (A4 analytics) | Small (view) to medium (page) | View yes; page possible |
| Hidden report also marks or clears the live marker's seat value | Medium (migration and ingest change) | Possible, if the team wants it (question 4) |
| Energy taken back when a post is hidden | Small (migration) | Yes |
| Suspension check in the ingest function | Small | Yes |
| Retention jobs applied as a migration, or confirmed as run | Small | Yes |
| Phone-shade notifications for tracking alerts and "Get ready to get off" | Medium; needs a new dependency and a native build | Risky: needs dependency approval and an EAS build |
| TAM items in the survey | Small (document) | Yes |
| Traffic layer or delay estimate in the ETA | Large | No |
| Device fingerprint, Play Integrity | Large; outside this phase (PRD 0.6) | No |

## 6. Questions for the team

1. Was `supabase/cron/retention.sql` run on the live project, with pg_cron enabled? The file says it is not applied, and A9 and D2 depend on it.
2. Where does the figure of 449 operational units (2022 to 2025) come from? Nothing in the repository records it (S7).
3. For S8, what are the real costs: the gateway SIM and its promo, the current Supabase plan, the gateway phone, any paid Render or EAS plan?
4. Should a hidden seat report also clear or mark the live marker, or is it enough that only the post is hidden (D2)?
5. Will TAM be added beside the SUS, or replace part of it? Will drivers and IT experts answer the TAM items too?
6. Does "under 5 s" (N1) mean the delay after a packet is sent, or the age of the marker? The send rule makes a packet only every 30 s or 100 m (A2).
7. Will the live map still be limited to team accounts at the final defense (PRD 0.7)? This changes the A2 and A4 answers.
8. In A3, "inactive (?) users" was read as riders who stop sending, leaving stale data. If the panelist meant accounts that never report, the answer is the coverage nudge and Energy (S1).
9. Several documents say flags are "weighted by trust". The code weighs them by account age and flagging pattern (section 2.1). Should `PROPOSAL_TRACEABILITY.md` and the manuscript be corrected?
10. S11 regrouped the objectives as Design, Develop and Evaluate. Which list will the final manuscript use, so the targets in section 3 can be attached to it?

**Documents found out of date** (not edited, by the audit rules):

- `SCOPE_AND_LIMITS.md` section 1 says 131 suites and 1,796 tests; the current count is 132 and 1,801.
- `PROPOSAL_TRACEABILITY.md` O1 and risk 3 say ETA is checked by field test E1; no experiment covers ETA.
- `PROPOSAL_TRACEABILITY.md` N2 and `SCOPE_AND_LIMITS.md` section 1 describe the retention jobs as running; the file says it is not applied.
