# Master implementation plan (remaining work)

- **Date:** 2026-10-04.
- **Based on:** `docs/AUDIT_3.md` (`main` at `c148972`).
- **Status:** proposal. No code until Emjay approves it.
- **Replaces, for remaining work:** `IMPLEMENTATION_PLAN_v2.md`, `IMPLEMENTATION_PLAN_GPS.md` and `IMPLEMENTATION_PLAN_FLOW.md`. They stay as history (section 2).
- **Rules (unchanged):**
  - Pure logic in `src/shared` with Node tests on fixed fixtures.
  - Every threshold in `src/shared/config`, server values in `serverConfig.ts`.
  - Route facts only in seed files; strings only in `src/strings/en.ts`.
  - One local commit per approved step, never pushed.
  - No new dependency without asking, no native build without asking, no Supabase command without approval of the exact command.
  - Android only.
- **Test labels:**

| Label | Means |
| --- | --- |
| **E** | Emulator (`Pixel_7`, API 34) |
| **P** | The partner's phone (Poco X6 Pro, Android 16) |
| **X** | Needs something else: a 3 GB phone, a multicab, several vendor phones, SIMs, or a live project |

## 1. Status snapshot

| Done | Half-done | Not started |
| --- | --- | --- |
| S0, S1 (beacon codes deferred) | S4: Part 1 code only, never live; no `app_config` | S4 Part 2 (live) |
| S2 offline map, route line, stops | G0: explainer, permission, blue dot, follow, reduced mode, manual pin (merged). Missing: consent, gates, mock and stale, fake source, "Use my location" | S5 live map, simulator |
| S3 routing and fare (SQLite, direction, discount) | Check-in: local 15-minute flow, never run | G1 to G4 |
| UX2: three tabs, themes, sheet, My Ride with the fare | F3: landmarks file and destinations store only | F2, F4, F5 |
| F1: onboarding v2, greeting, avatars, destinations (approved) | R1a: prepared, **not built** | F6 to F9 |
| Partner merge (approved) | — | BLE, driver app, SMS, moderation |

## 2. Supersession

| Older plan section | Status |
| --- | --- |
| Plan v2 S0 to S3 | Done |
| Plan v2 S4 | Part 1 done. Part 2 superseded by **SB1** (§4). |
| Plan v2 S5 | Superseded by **L1** (criteria unchanged) |
| Plan v2 Revisions 1 and 2 | Done. Their rules still apply (manual origin until G0, text budget, theme). |
| GPS plan UX2 | Done |
| GPS plan G0 | Superseded by **G0** (keeps its criteria, minus what the merge built) |
| GPS plan G1 | Superseded by **C1** (merged with F4) |
| GPS plan G2, G3, G4 | Superseded by **T1**, **V1** and **B1** |
| GPS plan R1 | Superseded by §6 (R1a, R1b) |
| GPS plan decisions 1 to 16, sections 5 to 7 (test tools, privacy, backend) | Still apply; folded into §4 and §9 |
| Flow plan F1 | Done |
| Flow plan F2 to F5 | Superseded by **F2** to **F5** (unchanged scope, F4 merged into C1's UI part) |
| Flow plan F6 to F9 | Superseded by **SB2**, **L2**, **RP1** and **N1** |
| Flow plan "Decisions after flow analysis" | Still applies (§9) |
| `FLOW_GAP_ANALYSIS.md` privacy table | Still applies |

## 3. Phases in order

| Phase | Steps | Needs | Why here |
| --- | --- | --- | --- |
| 0. Stabilise | **ST1** R1a build and smoke test; **ST2** records and small fixes | Emjay's emulator build; partner's EAS build | Nothing has run on the current native set; the merged app has never run on a phone; a crash is unexplained |
| 1. Location foundation | **G0** consent, gates, mock and stale, fake source, "Use my location" | ST1 | **Changed order:** moved before F2 to F5. The app now asks for location without consent (PRD 7.1, 15.1; Audit 3 §3), and the partner's phone will be used outdoors. G0 is small and needs no backend. F3's "from here" suggestion and C1 reuse it. |
| 2. Local features | **F2** Profile, **F3** suggestions, **F4** route-first Check-in UI, **F5** badges | G0 (F3 only for "from here") | No GPS limits, no Supabase; can also run while waiting for "Supabase is ready" |
| 3. Supabase live | **SB1** S4 Part 2 with `app_config`, `pg_cron`; **SB2** accounts, username, Energy ledger | "Supabase is ready" | Can start any time Emjay says so, in parallel with phase 2 |
| 4. Cloud check-in | **C1** geofence, gate, cloud table, counts, reminder | G0, SB1, R1b (notification) | The demand signal (PRD 5.1) |
| 5. Live map | **L1** markers from the simulator, coverage, Night suppression; **L2** tracking with ETA and Energy | SB1, SB2 | The core claim (PRD 3.1 goal 1) |
| 6. Reports and feed | **T1** phone broadcast, send rule, buffer, baton; **RP1** report flow with the manual picker; **N1** newsfeed; **V1** verification and Night Mode stage 1 | L1, G0, R1b | Turns riders into markers |
| 7. Background | **B1** foreground service, idle stop, cap, vendor guide | T1, R1b | Needs the partner's phone and others |
| 8. Later | BLE (S6, S7, needs R3), driver app, SMS gateway, moderation, admin console, Cebuano, Play release | Field data, phones, SIMs | PRD 0.7 |

**Critical path:** ST1 → G0 → SB1 → L1 → T1 → V1 → B1. Phase 2 and SB2 run beside it.

## 4. Steps

Each step has:
- a header table: goal, files, dependencies, effort;
- an acceptance table: criterion, PRD number, test, type, where it runs (E, P or X);
- a manual script, privacy notes, risks and a definition of done (DoD).

**Every DoD also includes:**
- `tsc`, `expo lint` and `jest` clean;
- `docs/device-tests.md` and `docs/AUDIT_BACKLOG.md` updated;
- one local commit after `git status`, with no `.env`, nothing from `android/`, and no unplanned `package.json` or `app.json` change.

### Phase 0: Stabilise

#### ST1. R1a build and smoke test

| | |
| --- | --- |
| Goal | The current `main` runs on a fresh native build, on the emulator and on the partner's phone |
| Files | None by the agent (Emjay and the partner build). Results go to `docs/device-tests.md`. |
| Depends | Nothing |
| Effort | Small (agent), medium (builds) |

| Criterion | PRD | Test | Type | Where |
| --- | --- | --- | --- | --- |
| App installs and opens; no crash on 10 cold starts | 0.2 S0; 13 (no crash) | `ST1-M1` | manual | E, P |
| Light system bars; new icon; splash on a cold start | Rev. 2; R1a | `ST1-M2` | manual | E, P (splash fully only in a release build) |
| F1, UX2 and merge features still work | — | `ST1-M3`: the F1 checklist, `UX2-S1` to `S8`, `MERGE_RESULT.md` §6 tests 3 to 6 | manual | E |
| Bottom sheet and My Ride on a real phone | — | `ST1-M4` | manual | P |
| Dev-client crash ("react context shouldn't be created before") | — | `ST1-M5`: Developer options, "Don't keep activities" on; switch away and back 5 times; then off | manual | E, P |
| Blue dot follows a walk; battery over 30 minutes with Live open | 7.3, 3.3 (indicative) | `ST1-P1` | manual | P |

**Script.** As in `docs/MERGE_RESULT.md` §5 and §6, plus `ST1-M5` and `ST1-P1`. The partner reports with the template in §5.

**Privacy.** None new.

**Risks.**
- A native crash appears only on the new build.
- The partner's build fails on our modules.

**DoD.**
- `ST1-M1` to `M5` pass on E.
- `ST1-M1`, `M4` and `P1` reported from P.
- The crash is reproduced and recorded, or not reproduced in 5 tries.

#### ST2. Records and small fixes

| | |
| --- | --- |
| Goal | Close the audit's record gaps and the cheap fixes |
| Files | `docs/device-tests.md` (Emjay's merge test, pending-phone row), `docs/BACKEND_SETUP.md` (`app_config`), `docs/AUDIT_BACKLOG.md` (crash item); `src/theme/theme.ts` (disabled and scrim opacity tokens) and the three screens; remove unused `BentoCard` and `BentoGrid` |
| Depends | ST1 (to fold in its results) |
| Effort | Small |

- **Test:** tsc, lint, jest; the `contrast` suite extended for the new opacity tokens. Type: unit; no device needed.
- **DoD:** the stale rows from Audit 3 §15 are fixed; no behaviour change.

### Phase 1: Location foundation

#### G0. Consent, gates, mock and stale, fake source, "Use my location"

| | |
| --- | --- |
| Goal | No location prompt before explicit consent. Precise features get only good fixes. My Ride can start from the user's position or the manual pin. |
| Files | `src/shared/location/consent.ts` and `accuracyGate.ts` (new, pure); `src/state/locationStore.ts` (consent state, persisted on the device: consented-at date only); `src/app/consent.tsx` (new); `src/services/location.ts` (adds a `__DEV__` fake source); `src/features/map/useLiveLocation.ts` (consent before the explainer); My Ride: a "Use my location" chip using `selectOrigin`; Profile/Settings row "Location: on, off, withdraw"; config `LOCATION_FIX_MAX_AGE_S`; strings (shortened explainer and notice); tests `location.test.ts` |
| Depends | ST1 |
| Effort | Medium |

| Criterion | PRD | Test | Type | Where |
| --- | --- | --- | --- | --- |
| No permission request before consent; none after withdrawal | 7.1, 15.1 | `consent: no request before consent; none after withdrawal` | unit | — |
| Consent, then the explainer, then the system prompt, on the first "Locate me" | 4.2, 7.1 | `G0-M1` | manual | E |
| Relay gate 30 m: 30.0 accepted, 30.1 rejected | 8.4 | `accuracy gate relay` | unit | — |
| Check-in gate 25 m: 25.0 accepted, 25.1 rejected | 7.5 | `accuracy gate check-in` | unit | — |
| Mocked fix rejected with reason `mocked` | 10.3 | `accuracy gate mocked`; fake source | unit, manual | E |
| Stale fix (older than `LOCATION_FIX_MAX_AGE_S`) rejected | 8.4 | `accuracy gate stale` | unit | — |
| Denied: notice, pins still work; "Use my location" disabled with the reason | 4.2 | `G0-M2` | manual | E |
| Dot follows GPX on the outbound line; works offline | 7.2, 6.2 | `G0-M3`, `G0-M4` | manual | E |
| "Use my location": fix at TSO gives "Near TSO" and a trip; without a fix, the manual pin is used | 7.2 step 1 | `G0-M5`; `selectOrigin` test | manual, unit | E |
| Real accuracy in the open and under a roof; a mock-location app is flagged | 17 E3, 10.3 | `G0-P1`, `G0-P2` | manual | P |

**Script.** `G0-M1` to `M5` as in the old GPS plan, with "On Fare" read as "On My Ride". `G0-P1`: record the accuracy shown at three spots. `G0-P2`: enable a mock-location app in developer options and expect a "mocked" count in the dev overlay.

**Privacy.**
- The consent date is stored on the device; nothing is sent.
- The fix stays in memory only.
- Consent text is an English draft for DPO review (decision 9).

**Risks.**
- Consent and minors: the text needs DPO review before the pilot (PRD 15.1).
- The emulator cannot set accuracy or the mock flag, which is why the fake source exists.

**DoD.**
- `G0-M1` to `M5` pass on E.
- `G0-P1` and `P2` reported from P.
- Commit `G0: consent, accuracy gates and use my location`.

### Phase 2: Local features (no Supabase)

| Step | Goal and files | Acceptance (PRD, test, where) | Effort |
| --- | --- | --- | --- |
| **F2** Profile | The avatar button opens **Profile**: avatar with Shuffle and the own-set grid; username (generate, regenerate, edit); badges (empty until F5); fare type, theme, About, Replay intro; Delete account (local wipe after confirmation); Team account card. Files: `settings.tsx` → `profile.tsx`; `src/shared/profile/username.ts`; `src/data/seed/usernameBlocklist.ts`; `src/services/localData.ts` | 19 D7: "ab" `too_short`, "abc" ok, 20 ok, 21 `too_long`, letters, numbers and underscore only, a blocked word in any case; 19 D10: after delete every store is at its defaults and onboarding opens (unit; `F2-M1` on E) | Medium |
| **F3** Suggestions | `suggestRoutes()` and `suggestForDestination()`; destination chips in My Ride; map tap to add a destination; "Take Route 4, board near X" with the fare at the end of onboarding. Files: `src/shared/routing/suggest.ts`, My Ride, onboarding | Fixture: 100 m from the line suggests the route, 600 m none; fare 6.3 km regular ₱21.00, student ₱16.80, then ₱16.75 (unit); `F3-M1` on E | Medium |
| **F4** Route-first Check-in UI | Route chips first; the chosen route's stations as dots in its colour; other routes faded (`mapRoute.fadedOpacity` token). Files: `StopDots.tsx`, `RouteLines.tsx`, `checkin.tsx`, `routeSource.ts` (`stationsForRoute`) | 19 D13: two-route fixture returns R4's six stations, an unknown route none; contrast of the faded line recorded (unit); `F4-M1` on E; also closes backlog 49 | Small |
| **F5** Badges | Seven badges from local counts; no leaderboard. Files: `src/shared/profile/badges.ts`, `src/state/countsStore.ts`, Profile | 19 D8: each threshold at n − 1 not earned and at n earned; fixed order; no comparison with other users (unit); `F5-M1` on E | Small |

**Privacy (phase 2).**
- The username stays on the device until SB2.
- Destinations, gender, avatar and counts never leave the phone. The privacy test is extended to the new stores.

**Risks.**
- The blocklist is a placeholder until Emjay supplies the English and Cebuano lists.
- With one route, the suggestion is always R4 or nothing.

**DoD for each step:** unit tests pass; its `F*-M1` script passes on E; one commit (`F2: profile screen`, and so on).

### Phase 3: Supabase live

| Step | Goal and files | Acceptance (PRD, test, where) | Effort |
| --- | --- | --- | --- |
| **SB1** Live backend | 1. New migration: `app_config` (Night Mode window 21:00 to 04:59 Asia/Manila, `energy_enabled` false, `feed_post_ttl_min` 60); `pg_cron` purge of `telemetry_ingest_log` daily. 2. Then `BACKEND_SETUP.md` §4 one command at a time: link, dry run, push, seed, allowlist, deploy ingest. | 0.2 S4: allowlisted writer accepted; direct insert denied; non-allowlisted 403; anonymous 401; inactive vehicle unreadable; malformed packets rejected; Realtime delivers (the 8 integration tests, X: live project). `app_config` readable by `authenticated`, not writable (migration text test and integration). Sign-in and the Team account card work (`S4-M1` on E) | Small to medium |
| **SB2** Accounts, username, Energy (old F6) | `profiles.username` (unique, 3 to 20, checked on the server); append-only `energy_ledger`; `energy` Edge Function (earn, spend, caps by Manila day, passive refill, wallet cap 5); sign-in asked at the first cloud action | 19 D14 / 11.1: cap 1 per source per day; reset at 00:00 Manila from UTC times; passive +1 at 12 h and 24 h, not a third time; wallet ≤5; spend refused below 1; `energy_enabled` false means tracking costs 0; a client cannot insert into the ledger (unit with fakes, integration on X) | Large |

**Privacy.**
- `profiles` holds the username only: no avatar, gender or classification (migration text test).
- The ledger holds amounts and reasons, no location (15.1: kept for the life of the account).

**Risks.**
- Docker may be needed for function deploys.
- The `verify_jwt` setting is open.
- Free-tier limits.

**DoD.** All 8 integration tests pass live; the new integration tests pass; commits `SB1: live backend and app_config`, `SB2: accounts and energy ledger`.

### Phase 4 to 7

| Step | Goal and main files | Acceptance with PRD numbers | Tests and where | Effort |
| --- | --- | --- | --- | --- |
| **C1** Cloud check-in (old G1, with F4's screen) | `src/shared/checkin/rules.ts`; migration `stations`, `checkins` (no coordinates), `checkin_counts`, `pg_cron` every minute; `checkin` Edge Function; `expo-notifications` reminder (R1b) | 7.5: refused outside 60 m (JCA for RCA at 61 m), per-station radius, accuracy >25 m refused, one active, `in_vehicle` refused (`getActivity()` returns `unknown` until a module exists), reminder at +300 s, expiry at +900 s, counts exclude expired rows before cleanup, server re-checks the geofence; +0.3 Energy once a day (SB2) | Unit; integration (X); `G1-M1` to `M4` on E; `G1-P2` real terminal accuracy on P; in-vehicle refusal X (activity module) | Medium to large |
| **L1** Live map (old S5) | `src/shared/telemetry/` (`sendRule`, `coverage`, `occupancy`, `stopped`); `vehiclesStore`; marker layer on Live; `scripts/simulate-vehicle.ts`; `live_vehicles` view with Night suppression by server time | 7.3: marker; Stale after 90 s (89 s Live, 100 s Stale, 10 min No data); bubble under 2 km/h across 45 s; occupancy 0–6, 7–12, 13+ of 16; viewport culling; "No data from riders right now", never "no vehicles"; "Prototype data, unverified" badge; 10.4: no live rows at 21:00 server time, the phone clock has no effect | Unit; integration (X); `S5-M1` to `M5` on E with the PC simulator | Large |
| **L2** Tracking with ETA (old F7) | `src/shared/telemetry/eta.ts`; `trackingStore`; guide line; others faded | 19 D9: 2.0 km at 20 km/h gives 6 min; null when past the point, under 5 km/h, packet older than 90 s, fewer than 2 samples, over 10 km; 19 D1: one 30-minute session, Energy once, nothing spent while `energy_enabled` is off | Unit; `F7-M1` on E with the simulator at 20 km/h | Medium |
| **T1** Phone broadcast and baton (old G2) | `sendRule`, `buffer`, `liveness`, `baton`; `relay_sessions`, `telemetry_raw` with retention jobs; `session` function; dev broadcast screen; `expo-battery`, `expo-network` (R1b) | 8.4: 100 m or 30 s; fixes >30 m dropped; 60-point buffer, oldest dropped, flushed in order; 13: 95 % in order after 10 min loss; 8.3: Primary silent 90 s promotes the next eligible Secondary; battery <30 % Secondary only; 3.3: battery ≤5 %/h Primary, ≤2 %/h Secondary, data ≤150 KB/h, freshness p90 ≤30 s | Unit; integration (X); `G2-M1` to `M5` on E; **`G2-P1`, `P2` on P** (2-hour battery and data); freshness on E then P | Large |
| **RP1** Report flow (old F9) | Floating Report button; manual vehicle picker behind a dev flag; seats; GPS switch; GPS path uses T1, no-GPS path posts to N1 | 19 D5: picker hidden without the flag; GPS path calls ingest and never the feed; no-GPS path posts and never sends a position; Energy reason matches the path (+1.0 GPS, +0.5 no GPS); all marked unverified | Unit; `F9-M1` on E; real ride on P | Medium |
| **N1** Newsfeed (old F8) | `feed_posts`, `feed_flags`, insert function, expiry job; list in the expanded Live sheet with a neutral badge | 19 D2: expired posts not returned (60 min); a post naming a stop created at 21:30 Manila is visible from 21:32; third unique flag hides and queues it; a second flag by the same user refused; no coordinates and no free text (validator); team accounts only | Unit; integration (X); `F8-M1` on E | Medium |
| **V1** Verification and Night Mode stage 1 (old G3) | Real `verifyReport` (still the only reader of `ENABLE_VERIFICATION`); `route_lines`; `node_events` | 10.2: snap 30 m (30 passes, 31 fails); 50 m displacement; speed 25 km/h for 20 s; window up to 90 s; 10.3: mocked fixes never sent; 10.4: static node updates delayed ≥2 min; night raw rows deleted within 24 h | Unit; integration (X); `G3-M1`, `M2` on E; **`G3-P1` on P** (real ride, needs the real polyline) | Large |
| **B1** Background reliability (old G4) | `session.ts` idle rule and cap; `backgroundLocation.ts` with the location foreground service; battery guide; service health (R1b) | 8.4: idle stop 19:59 runs, 20:00 stops (30:00 in a terminal); 3 h cap with a prompt; 8.5: service with notification keeps sending with the screen off; kill detected and guide shown once; 13 / 17 E5: six vendor skins | Unit; `G4-M1`, `M2` on E; **`G4-P1` on P** (60 min screen off, with and without exemption); other skins X | Medium |

**Privacy across phases 4 to 7.** The GPS plan §6 table still applies:
- check-in rows have no coordinates and expire;
- `telemetry_latest` has no user;
- `telemetry_raw` is kept 7 days by day and 24 hours at night;
- `relay_sessions` are kept 30 days;
- markers never show riders.

The privacy tests are extended to every new table and function.

## 5. Where each kind of criterion can be proven

| Kind of criterion | E | P (Poco X6 Pro, Android 16) | X |
| --- | --- | --- | --- |
| Pure rules (fare, gates, ETA, Energy caps, send rule, coverage, baton ranking) | unit tests | — | — |
| UI flows, themes, sheet, permission and consent order | yes | yes | — |
| Simulated GPS (`adb emu geo fix`, GPX playback) | yes | — | — |
| **Real GPS accuracy** in the open, under roofs, at terminals (17 E3) | — | **yes** | five terminals, more phones |
| **Battery** of the blue dot and of broadcasting (3.3: ≤5 %/h, ≤2 %/h) | — | **yes** (one phone, indicative) | the 3 GB reference phone |
| **Mobile data** per hour (≤150 KB) | — | **yes** (SIM data stats) | — |
| **Background survival** with the screen off (8.5, 17 E5) | stock Android only | **yes** (MIUI / HyperOS skin) | five more vendor skins |
| Mock-location app detection | partly (fake source) | **yes** | — |
| Activity recognition (`IN_VEHICLE`) | — | only if a module is added (needs approval and a rebuild) | — |
| Real ride: route snap, verification | — | **yes**, with the real polyline | a multicab |
| Routing 250 ms p95 on a 3 GB phone | indicative | indicative (not 3 GB) | **3 GB phone** |
| BLE, SMS, driver heatmap | — | — | two or more phones, SIMs, a driver device |
| Live backend, RLS, Realtime | integration tests | — | **live project** |

**What the partner sends back.** One message per script, copied by Emjay into `docs/device-tests.md`:

```text
Script: ST1-P1 (copy the id)
Date and time:
Phone: Poco X6 Pro, Android 16, build ID (EAS):
Commit on main: (git log -1 --format=%h)
Steps done: 1 2 3 ... (say which were skipped)
Result: pass / fail / partly
Numbers: (accuracy in m, battery % start and end, minutes, data KB, update interval)
What I saw: (one or two lines; screenshot or screen recording if it failed)
Errors: (red screen text, or "none")
```

## 6. Native rebuilds

| Rebuild | Contents | When | Who | Blocks |
| --- | --- | --- | --- | --- |
| **R1a** (prepared) | `expo-system-ui` (system bars follow the light style), `expo-splash-screen` with `assets/splash-icon.png` on white, new icons, `app.json` (light style, white background, adaptive icon `#e8f0fe`, `expo-asset` plugin, EAS `extra`) | Now (ST1) | Emjay: `npx expo prebuild --platform android --clean`, then `npx expo run:android`. Partner: `git pull --ff-only` after a push, then `npm ci` and `npx eas-cli@latest build --profile development --platform android`. **Before rebuilding**, Emjay pushes `main` (only when he writes "push"), and the partner logs in to his own Expo account. | ST1, and everything after it on P |
| **R1b** | `expo-notifications` (C1 reminder), `expo-battery` and `expo-network` (T1), `expo-task-manager`, `expo-intent-launcher`, `expo-location` plugin with `isAndroidForegroundServiceEnabled: true` and the notification icon (B1) | Before C1 (one batch, to avoid three rebuilds) | Same split | C1 reminder (until then an in-app banner), T1 eligibility and reconnect, B1 |
| **R2** (only if needed) | `ACCESS_BACKGROUND_LOCATION`, if B1 shows the foreground service needs it; or an activity-recognition module | After the B1 check | Same | B1 on some vendors; the in-vehicle refusal |
| **R3** | Native BLE scanner and `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` | Later phase | Same | BLE boarding (S6, S7) |

Every package above needs Emjay's approval through `npx expo install`. Background location stays blocked unless R2 is approved.

## 7. Data Emjay must gather

| Data | Blocks |
| --- | --- |
| Real Route 4 outbound and return polylines (or approval to validate the candidate trace) | V1 real-ride verification; useful fares and walks; F3 suggestions on real streets |
| Stations and terminals with real names, codes and coordinates (Jeepney Terminal, Ampayon) | C1 geofences; the landmark list; N1 stop names |
| Landmarks with real names and coordinates | F3, the onboarding destinations |
| The official fare order (base, km, rate, rounding) | Removing "placeholder" from the fare; PRD 15.3 citation on About |
| Vehicle list (plates, capacity) | `vehicles` seed for SB1 beyond test plates; L1 occupancy if capacity is not 16 |
| Supabase project values and two test accounts (`docs/BACKEND_SETUP.md` §3) | SB1 and everything after it |
| Cebuano strings (from a team member) | NFR 13 language row; the consent notice (15.1) |
| Username blocklists, English and Cebuano | F2 before any public release |
| DPO review of the consent text | G0 before any pilot (15.1) |

## 8. Critical path and parallel work

| Order | Waits for | Agent can do meanwhile |
| --- | --- | --- |
| ST1 | Emjay's and the partner's builds | ST2 docs part; once G0 is approved, its pure logic and tests (`consent.ts`, `accuracyGate.ts`) |
| G0 | ST1 results | Draft the consent text |
| F2 to F5 | Nothing external | Any time after G0, in any order (F4 before C1) |
| SB1 | "Supabase is ready" and the `.env` values | Write the SB1 migration and its text tests in advance (no command run) |
| SB2, C1, L1 | SB1 | L1 pure rules (`coverage`, `occupancy`, `stopped`, `sendRule`) and the simulator before SB1 |
| T1, RP1, N1 | L1, R1b | T1 pure rules (`buffer`, `liveness`, `baton`) early |
| V1 | T1, the real polyline | V1 pure rules on fixtures |
| B1 | T1, R1b, the partner's phone | `session.ts` idle rule and cap |

Strictly in order: the rebuilds before the steps they block; SB1 before any integration test; the real polyline before a real-ride V1 test.

## 9. Decision log

| # | Decision | Source |
| --- | --- | --- |
| 1 | Android only; Route 4 only; single Expo app, no monorepo | PRD 0.1; plan v2 §1 |
| 2 | Sign-in: email and password team accounts in v0 | PRD 7.1, changes item 5 |
| 3 | Route 4 stored as two directed lines (`route_code`, `direction`) | PRD changes item 1 |
| 4 | Board and alight anywhere along the line, 500 m walk per leg | PRD changes item 3 |
| 5 | `DEO` is a placeholder station | PRD changes item 2 |
| 6 | SMS wrap window 1 to 5,000 ahead mod 10,000; packets older than 120 s or 30 s ahead rejected | PRD changes item 4 |
| 7 | Writer audit trail: team accounts only, 30 days | Plan v2 Q14 |
| 8 | Tiles: bundled PMTiles, no labels, no text on the map | Plan v2 Q7; S2 |
| 9 | GPS-free order first (Revision 1) | Plan v2 Rev. 1 |
| 10 | Light-first Material 3, three tabs Live, Check-in, My Ride; fare in My Ride; no Fare tab | Rev. 2; GPS decisions 1, 16 |
| 11 | Draggable sheet required, three snap points | UX2 |
| 12 | `expo-system-ui` in the first rebuild | GPS decision 2 |
| 13 | Check-in is a cloud table; local countdown first | GPS decision 3 |
| 14 | `app_config` in S4 Part 2, with the Night Mode window | GPS decision 4 |
| 15 | `pg_cron` yes, with the command approved first | GPS decision 5 |
| 16 | Activity recognition skipped; `getActivity()` returns `unknown` | GPS decision 6 |
| 17 | Night: hide moving markers 21:00 to 04:59 by server time | GPS decision 7 |
| 18 | Check-in and live view for allowlisted team accounts only | GPS decisions 8, 13 |
| 19 | Consent text: English draft for later DPO review | GPS decision 9 |
| 20 | `telemetry_raw` kept, service role only, PRD retention | GPS decision 10 |
| 21 | Mock counter in the session keepalive, not the packet | GPS decision 11 |
| 22 | Real-polyline import script waits for "go" | GPS decision 12 |
| 23 | The agent asks before any native build | GPS decision 14 |
| 24 | `braces` and other advisories deferred; never `npm audit fix` | GPS decision 15; AUDIT §11 |
| 25 | D1: browsing free; tracking 1 Energy per 30 min; free for the prototype and pilot with an `energy_enabled` switch | PRD 19.2 |
| 26 | D2: feed shows username with a neutral badge; fixed fields; 60 min; 3 unique flags hide and queue; team accounts only | PRD 19.2; flow decisions 1 to 3, 10 |
| 27 | D3: optional gender; avatar picked once from its set; Shuffle only; all private | PRD 19.2 |
| 28 | D4: landmarks seed or map tap; at most 3 destinations | PRD 19.2; flow decision 5 |
| 29 | D5: manual vehicle picker behind a dev flag; BLE later | PRD 19.2 |
| 30 | D6: sign-in asked at the first cloud feature | PRD 19.2 |
| 31 | D7: username 3 to 20, letters, numbers, underscore; small blocklist now | PRD 19.2; flow decision 9 |
| 32 | D8: count badges, no leaderboard or ranking | PRD 19.2; flow decision 7 |
| 33 | D9: simple ETA; limits 5 km/h, 90 s, 2 samples, 10 km as hypotheses | PRD 19.2, 19.4 |
| 34 | D10: delete account wipes local data now | PRD 19.2 |
| 35 | D11: persona Tunton; 8 greeting lines kept | PRD 19.4; F1 review |
| 36 | D12: floating Report button; feed in the expanded Live sheet | PRD 19.2 |
| 37 | D13: route-first Check-in with coloured dots and fading | PRD 19.2 |
| 38 | D14: server-side Energy ledger after Supabase is ready | PRD 19.2 |
| 39 | Avatar button opens Profile, which holds the settings rows | Flow decision 6 |
| 40 | Greeting card above the sheet; Profile picker shows only the own set | F1 review |
| 41 | Merge rules: ours except location; his GPS on Live behind a first-tap explainer; no consent screen in the merge | Merge approval |
| 42 | His Route 4 trace kept as a candidate only | Merge answer 2 |
| 43 | Tile file tracked in git; old docs not deleted | Merge answers 4, 5 |
| 44 | Blue dot 2 s or 5 m, display only | Merge answer 7 |
| 45 | Rebuilds split into R1a (now) and R1b (later); Emjay and the partner build | Merge answer 8 |
| 46 | `expo-splash-screen` added; `eas.json` and the project ID kept (partner's account) | 2026-10-04 |
| 47 | "Use my location" uses the GPS fix, else the manual pin, in G0 | 2026-10-04 |
| 48 | No pushes unless Emjay writes "push" and names what | Standing |

## 10. Open questions

| # | Question | Blocks |
| --- | --- | --- |
| 1 | Approve the changed order: G0 before F2 to F5 (because the app now asks for location without consent)? | Phase order |
| 2 | Was a `team_accounts` rename decided? None exists; the allowlist is `telemetry_writers`. | SB1 migration names |
| 3 | The dev-client crash: what were you doing, and may it be reproduced in ST1-M5? | ST1 |
| 4 | Push `main` so the partner can build R1a? (Only on your written "push".) | Partner's part of ST1 |
| 5 | Delete the `integrate-partner` branch now that `main` contains it? | Nothing |
| 6 | Shorten the Live explainer and the location-off notice in G0, or now in ST2? | Text budget |
| 7 | Validate the candidate trace with the import script ("go"), or wait for a GPS ride? | V1, real fares |
| 8 | Add `@testing-library/react-native` for screen tests (a new dev dependency)? | UI test coverage |
| 9 | One R1b batch before C1, or split by step? | C1, T1, B1 timing |
| 10 | Who reviews the consent text (DPO), and when? | G0 for a pilot |
| 11 | Faded-route opacity for F4 (PRD 7.2 says 8 %)? | F4 |

## 11. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | R1a shows native crashes (dev launcher, gesture, splash) | ST1 first; the crash repro; keep the old APK until the new one passes |
| 2 | The partner's build drifts from `main` | He builds only from a pushed `main` commit and reports its hash (template) |
| 3 | Consent gap if the build leaves the team | Keep the build private until G0 is done |
| 4 | Supabase never becomes ready | Phases 1 and 2 and all pure rules continue; the thesis demo can show the simulator against a project later |
| 5 | Placeholder geometry fails real rides | Data gathering in parallel; the candidate trace through the import script |
| 6 | One phone is not a device matrix | Record P results as indicative; name the missing skins in the thesis |
| 7 | Battery of the 2 s High-accuracy dot | Measure in ST1-P1; tune the blue-dot constants |
| 8 | Scope growth (Energy, feed, ETA added by 19) | Phases keep them after the core live map; each step is gated |
| 9 | No UI tests | Pure modules; question 8 |
| 10 | Docker or `verify_jwt` problems at deploy | Found in SB1; stop and report |
