# Audit 3: what is actually implemented

> **Status:** complete. The master plan built on it is `docs/IMPLEMENTATION_PLAN_MASTER.md`.

- **Date:** 2026-10-04.
- **Base:** `main` at `c148972`.
- **Scope:** read-only for code. Commands run: `git` read commands, `tsc`, `expo lint`, `jest`, `expo-doctor`, `expo install --check`, `npm audit --omit=dev`. No install, no build, no Metro, no emulator, no Supabase.
- **Status codes:**

| Code | Meaning |
| --- | --- |
| `DONE-TESTED` | Built and tested |
| `DONE-UNTESTED` | Built, not tested |
| `PARTIAL` | Only part of it is built |
| `NOT-STARTED` | Not built |
| `DEFERRED` | Postponed by Emjay's decision |
| `CONTRADICTED` | The code does the opposite |

Evidence is a file path, a commit hash, or a section of the PRD or a plan.

## 0. Summary

1. **Solid:**
   - the offline core (map, SQLite route data, direction-aware routing, fare with discount);
   - UX2 (three tabs, Light and Dark, draggable sheet, My Ride);
   - F1 (onboarding, greeting, avatars, destinations);
   - the merged blue dot.
   - Checks: `tsc`, lint, 483 tests (32 suites), `expo-doctor` 21/21.
2. **The biggest gap is unchanged since Audit 2:** no live feature exists, and the backend has never run.
3. **New CONTRADICTED requirement:** since the merge, the app asks for location permission without the consent screen of PRD 7.1 and 15.1. You accepted this until G0, but it is now real, not hypothetical.
4. **The merged app has never run on a fresh native build or on any phone.**
   - `android/` predates `expo-system-ui`, `expo-splash-screen` and the `app.json` changes.
   - The partner's phone results all ran his own code. Only the foreground blue-dot behaviour carries over to the merged app.
5. **F2, F4 and F5: nothing exists. F3:** only the landmarks file and the destinations store (from F1).
6. **Privacy holds:** classification, gender, avatar, destinations and positions never reach a network or storage path off the device. The git history has no secrets.
7. **Done without approval since Audit 2:** nothing new found. The two older items (`app_config` dropped, S4 Part 1 committed early) still stand.
8. **Records missing:**
   - your emulator test of the merge is not in `device-tests.md`;
   - the dev-client crash text ("App react context shouldn't be created before") was not in the backlog (now item 64). The `SIGSEGV` crash (item 41) was observed by the agent on the emulator; cause unknown. Corrected after Audit 3.
9. **No `team_accounts` rename exists** (question 1 in §17).

## 1. Repository state

| Item | State |
| --- | --- |
| Current branch | `main`, at `c148972` |
| Ahead of / behind `origin/main` | 28 / 0 (`git rev-list --left-right --count main...origin/main`) |
| Pushes | None. `origin/main` is still the partner's `b21b0c1`. |
| Uncommitted files | None before this audit |
| `integrate-partner` | `29cc0b0` (the merge). It is contained in `main`, so it can be deleted safely; it was left in place. |
| `backup-before-partner-merge` | `149023e` (F1, before the merge) |
| Tag `pre-partner-merge` | `149023e` |
| Tag `s0-s1-code` | `dd82438`, the first upstream merge commit. **Unverified** who made it and why: it is not mentioned in any document. |
| `origin/main` | `b21b0c1`, the partner's commit. After a push of `main`, it would fast-forward. |
| Generated `android/` | **Stale.** It was generated on 2026-10-02 at 23:46, and the APK was built at 23:48 (`android/app/build/outputs/apk/debug/app-debug.apk`); the emulator's install is from 23:49. Everything after that is missing from it: `expo-system-ui` (merge `29cc0b0`), `expo-splash-screen` (`45f9798`), the `app.json` changes (`userInterfaceStyle` light, root background `#ffffff`, adaptive-icon background, the `expo-asset` and `expo-splash-screen` plugins, the EAS `extra`), and the new icon images. Its React Native autolinking list does include `react-native-gesture-handler`, `reanimated`, `worklets`, `screens`, `svg` and MapLibre, which is why UX2 runs on the old build. R1a has not been built. |

## 2. Plan conformance

| Step | Planned | Built | Commit | Deviations | Approved? |
| --- | --- | --- | --- | --- | --- |
| S0 | Dev client, tabs, lint, tests, config module, Supabase client | Yes | `9a436eb`, `8e3b754`, `a5fea43` | Emulator, not a phone; JDK 17; gesture-handler pin; `react-native-screens` patch | Yes (Audit 2 §3). The partner later installed **his** build of **his** code on a phone (`docs/device-tests.md`, partner section). |
| S1 | Shared core and the PRD 0.2 unit tests | Yes; beacon codes deferred | `9a436eb` | None new | Yes |
| S2 | Rev. 1 offline map and route line | Yes | `f852592`, `3937e95` | PMTiles in the APK; no labels; overzoom 4; stop dots | Yes (Audit 2) |
| S3 | SQLite, routing, fare, classification | Yes | `bbb2679` | Flat-map projection; no spatial grid | Yes (Audit 2) |
| S4 Part 1 | Migrations, ingest function, tests; nothing live | Yes | `90b1080` | Extra `telemetry_ingest_log`; **no `app_config`**; committed before review | Content yes. Dropping `app_config` and the early commit were **not approved** (Audit 2 §9). |
| S4 Part 2 | Live project | **Nothing** | — | — | Waits for "Supabase is ready" |
| UX1 | Guidance, breakdown, onboarding, avatars, About, strings file, contrast | Yes, then mostly replaced by UX2 | `57b9b61` to `0796803` | Icon and splash left as defaults | Yes |
| UX2 | Three tabs, theme, Settings sheet, draggable sheet, My Ride with the fare, local Check-in, intro, About | Yes | `d76f93d`, `3647293`, `9c8eb06`, `ebfc0a5`, `a6f89c5`, `403bedd`, `c31b21f` | (1) The first UX2 commits were grouped from one working tree and are not individually verified (`AUDIT_BACKLOG.md` note). (2) Check-in, intro and About never ran on the emulator for the agent (backlog 49 to 51). | Accepted by Emjay (2026-10-03) |
| Draggable sheet | Snap points 72 dp, 40 %, 90 %; flick; TalkBack actions | Yes | `9c8eb06`, `c31b21f` | Flick unreliable with injected events; TalkBack untested | Accepted |
| F1 | Onboarding v2, greeting, gender, auto avatar, commuter type, destinations | Yes | `149023e`, `b80aede` | Landmarks file and destinations store moved in from F3 (reported in the plan, "Scope moved"); greeting card above the sheet (proposal) | Yes: F1 approved 2026-10-04 with both; the picker change was Emjay's request |
| F2 | Profile screen: username, Shuffle, badges, delete, settings rows | **Nothing.** The sheet is still titled "Settings". Shuffle exists (from F1). | — | — | Not started |
| F3 | Landmarks, route suggestions, map-tap destinations | **Partial:** the placeholder landmarks and the destinations store exist (F1). There is no `suggestRoutes()`, no map tap, no chips in My Ride and no suggestion at the end of onboarding. | `149023e` | — | Not started as a step |
| F4 | Route-first Check-in: route-coloured dots, other routes faded | **Nothing new.** UX2's Check-in already has route chips, a map and stop dots; the dots are not route-coloured and nothing fades. | `a6f89c5` | — | Not started |
| F5 | Seven count badges | **Nothing** | — | — | Not started |
| Partner merge | Ours except location; his GPS on Live, behind the first-tap explainer | Yes | `29cc0b0` (merges `b21b0c1`) | Added `useLiveLocation.ts`, `RoundButton` `active`, `boundsContainPoint`, blue-dot tokens; root background `#ffffff` (not his `#F4F6F9`); icons drawn by the agent | Yes: approved after Emjay's emulator test (2026-10-04) |
| R1a | `expo-system-ui`, icon and splash; prepared, not built | Prepared | `29cc0b0`, `45f9798`, `cdc0bbb` | `eas.json` and the project ID were first left out, then restored on Emjay's answer | Yes. **Not built:** `android/` is stale (§1). |
| S5, G0 to G4, F6 to F9 | — | Nothing, except the part of G0 that came with the merge (§5) | — | — | On hold |

## 3. PRD traceability (sections 3 to 15, and 19)

Section 19 overrides earlier sections where they differ (PRD 19.3), and the override is cited. Requirements that were `DEFERRED` in Audit 2 for the same reason are grouped.

### 3.1 Goals and scope (PRD 3, 5)

| PRD | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 3.1 goal 1 | Verified live position and seats | NOT-STARTED | No S5 code. `sendTelemetry` is never called. |
| 3.1 goal 2 | Offline routing and fare | DONE-TESTED | `routing.test.ts` (18), `fare.test.ts` (12), `planGuidance.test.ts` (19); `S3-M1` in airplane mode |
| 3.1 goal 3 | Driver SMS heatmap | DEFERRED | PRD 0.7. Parser and signer only (`sms.test.ts`, 16). |
| 3.1 goal 4 | Low battery and data use | NOT-STARTED | The blue dot asks for `Accuracy.High` every 2 s or 5 m (`services/location.ts`). Not measured. |
| 3.1 goal 5 | Privacy | PARTIAL | §9: holds on the device; Night Mode and consent gaps |
| 3.1 (19.3) | Personalised onboarding, route suggestions, crowdsourced feed | PARTIAL | Onboarding done (F1); suggestions and feed not started |
| 3.2 | Non-goals: no iOS, no payments, no driver tracking | DONE-TESTED | `app.json` `platforms: ["android"]`; no `ios/` |
| 3.3 | Routing 250 ms p95 on a 3 GB phone | PARTIAL | Far under on the PC and the emulator. The partner's Poco X6 Pro gave 0.72 ms p95, but **for his planner, not ours**. No 3 GB phone. |
| 3.3 | Other metrics, and the ETA accuracy measure (19.3) | NOT-STARTED | Need live features |
| 5.1 | Route 4 only; route data from the database | DONE-TESTED | `routeDb.test.ts` (13), `seed.test.ts` (9) |
| 5.1 (19.3) | Community feed in the pilot | NOT-STARTED | F8 |
| 5.1 | Data to collect | NOT-STARTED | 0 of 6. An inactive candidate trace exists (`r4.traced.candidate.ts`). |
| 5.2 | Coverage states; never "no vehicles" | PARTIAL | Live shows a "No data" pill and "No data from riders right now" (`strings/en.ts`). No coverage logic yet (S5). |

### 3.2 Commuter app (PRD 7, with the 19.3 overrides)

| PRD | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 7.1 | Team email and password sign-in | DONE-UNTESTED | `sign-in.tsx`, `services/auth.ts`. Never run against a backend (backlog 19). |
| 7.1 | Classification on the device only | DONE-TESTED | `profileStore.ts` (kv-store), `privacy.test.ts`; Emjay's F1 review |
| 7.1 | No edit cooldown | DONE-UNTESTED | No cooldown code exists |
| 7.1 / 19 D3 | 12 vector avatars; picked once from the gender set; Shuffle; picker shows the own set; profile only | DONE-TESTED | `avatarPick.ts`; `avatarPick.test.ts` (10), `profileStore.test.ts` (6), `avatarPicker.test.ts` (3); Emjay's F1 review. The picker change (`b80aede`) was not seen on the emulator. |
| 7.1 / 15.1 | **Consent screen before any location permission** | **CONTRADICTED** | Since the merge (`29cc0b0`), "Locate me" shows an explainer and then the system prompt (`useLiveLocation.ts`, `locationStore.requestPermission`). There is no consent screen, no stored consent and no way to withdraw. Emjay's merge rules put the consent screen in G0, so the gap is known and accepted, but the app now asks for location without it. |
| 7.1 | Device binding | DEFERRED | PRD 0.6 |
| 7.1 / 19 D7, D10 | Username, account deletion | NOT-STARTED | F2 |
| 7.2 | Tiles as `.mbtiles` through Play Asset Delivery | CONTRADICTED (approved) | PMTiles bundled in the APK; Audit 2 §13 item 5 |
| 7.2 | SQLite route data with a version | DONE-TESTED | `routeDb.test.ts` |
| 7.2 | Online check for a newer route version | NOT-STARTED | — |
| 7.2 | Routing steps 3 to 6; board anywhere; 500 m per leg | DONE-TESTED | `routing.test.ts` |
| 7.2 step 1 | Origin from GPS | NOT-STARTED | My Ride takes map taps and stop chips only. The merged `selectOrigin` is unused (G0). |
| 7.2 step 2 | Spatial grid | DEFERRED | One route (Audit 2) |
| 7.2 | Fare from the route slice; configurable rounding; "Estimate" label | DONE-TESTED | `fare.test.ts` (4.0, 4.1, 6.3 and 10.0 km; ₱16.80 and ₱16.75); My Ride "Estimate" chip |
| 7.2 | Other routes at 8 % opacity | DEFERRED | One route. F4 adds fading on Check-in (19 D13). |
| 7.2 | Blue dot, working offline | DONE-TESTED (partly) | `BlueDot.tsx`: Emjay's emulator test after the merge, and the partner's walk on his own build. The offline dot on the emulator was not run. |
| 7.3 | Viewport culling, markers, occupancy halo, stopped bubble, coverage | NOT-STARTED | S5. Only `stopped_since` exists, on the server (`ingest.test.ts`). |
| 7.3 / 19 D1 | Browsing free; tracking one PUV costs 1 Energy per 30 min; free in the pilot | NOT-STARTED | F6, F7 |
| 7.3 | Night view | DEFERRED | PRD 0.6 |
| 7.4 | Marker age and distance | NOT-STARTED | S5 |
| 7.4 / 19 D9 | Simple ETA | NOT-STARTED | F7 |
| 7.5 / 19 D13 | Check-in: route chips, station dots, 15-minute lifetime | PARTIAL | Local only: `localCheckin.ts`, `checkinStore.ts`, `localCheckin.test.ts` (7). **Never run on the emulator** (backlog 49). |
| 7.5 | Geofence 60 m, accuracy 25 m, one active, reminder at 5 min, cloud counts, cron, auto-cancel | PARTIAL | One active check-in (local) and the Haversine test. No geofence, accuracy gate, reminder, cloud table or job (G1). |
| 7.5 / 19 D13 | Route-coloured station dots; other routes faded | NOT-STARTED | F4 |

### 3.3 Relay, driver app, verification (PRD 8 to 10)

| PRD | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 8.1 to 8.3 | Relay lifecycle, BLE, baton | DEFERRED | PRD 0.7. The 19 D5 manual picker (F9) is not started either. |
| 8.1 (19.3) | A report without GPS goes to the feed | NOT-STARTED | F8, F9 |
| 8.4 | Packet ≤150 bytes with seven fields; timestamp limits | DONE-TESTED | `packet.test.ts` (25), `ingest.test.ts` (22) |
| 8.4 | Send rule, liveness, buffer, idle stop, hard cap, 30 m gate | NOT-STARTED | Constants only. Idle stop and hard cap still have no constant (Audit 2 item 9). |
| 8.5 | Foreground service, vendor guide, health check | DEFERRED | G4 |
| 9.x | Driver app and SMS | DEFERRED | PRD 0.7. The protocol itself is DONE-TESTED. |
| 10.1 | RSSI EMA | DONE-TESTED | `rssi.test.ts` (3) |
| 10.2 | Verification window | DEFERRED | `verifyReport` hook only |
| 10.3 | Mock fixes discarded | NOT-STARTED | `LocationFix.mocked` is read in `services/location.ts` but never used (G0) |
| 10.3 | Play Integrity, fingerprint, risk score | DEFERRED | PRD 0.6. `deviceIntegrity()` exists but is never called. |
| 10.4 | Night Mode window set on the server | PARTIAL | Client constants only; no `app_config` (unchanged since Audit 2) |
| 10.4 | Night publishing rules | DEFERRED | No live markers yet |
| 10.4 (19 D2) | Feed: no coordinates; posts naming a stop delayed ≥2 min at night | NOT-STARTED | F8 |
| 10.4 | Markers never show riders | DONE-TESTED | `migration.test.ts`, `ingest.test.ts` |
| 10.5 | Detours | DEFERRED | — |

### 3.4 Tokenomics, data, edge cases, privacy (PRD 11 to 15, and 19)

| PRD | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 11.1 / 19 D14 | Energy ledger, caps, reset at Manila midnight | NOT-STARTED | F6 (needs Supabase) |
| 11.2 | Trust and Merit | DEFERRED | 19.3 keeps them out |
| 11.3 / 19 D2 | Feed flags: 3 unique flags hide a post and queue it | NOT-STARTED | F8 |
| 12.1 | Local schema with direction | DONE-TESTED | `schema.ts`, `routeDb.test.ts` |
| 12.2 | `profiles`, `vehicles`, `telemetry_latest` | DONE-UNTESTED (live) | Migration; `migration.test.ts` (22) |
| 12.2 (19.3) | `username`, `feed_posts`, `feed_flags`, `energy_ledger` | NOT-STARTED | F6, F8 |
| 12.3, 12.4 | SMS protocol and formulas | DONE-TESTED | `sms.test.ts`, `fare.test.ts`, `rssi.test.ts`, `geo.test.ts` |
| 12.5 | Placeholder data | DONE-TESTED | `seed.test.ts` |
| 13 | NFR | See §14 | |
| 14 | Edge cases | PARTIAL | Offline first holds: map, routing, fare and dot need no network. "No data" wording exists. A denied permission gives a notice and a manual pin. The live, relay and SMS rows are not built. |
| 15.1 | Consent and notice in English and Cebuano | **CONTRADICTED** | See 7.1 above |
| 15.1 | Data minimisation | DONE-TESTED | `privacy.test.ts` (8), `migration.test.ts` |
| 15.1 | Retention | PARTIAL | The ingest log is purged by the function only; no `pg_cron` |
| 15.1 / 19 D10 | Account deletion (local wipe for now) | NOT-STARTED | F2 |
| 15.2 | Play Store, Asset Delivery, signing | DEFERRED | PRD 0.6 |
| 15.3 | Fare disclaimer; fare order cited on About | PARTIAL | "Estimate" shown; no fare order to cite yet |
| 19 D11 | Time-based greeting from the strings file | DONE-TESTED | `greeting.test.ts` (14); Emjay's F1 review |
| 19 D4 | Landmarks seed; at most 3 destinations | PARTIAL | `landmarks.placeholder.ts`, `destinations.test.ts` (4). No map tap. |
| 19 D8 | Count badges, no ranking | NOT-STARTED | F5 |
| 19 D12 | Floating Report button; feed in the expanded sheet | NOT-STARTED | F8, F9 |

## 4. What changed since Audit 2 (`0796803` to `c148972`)

| Requirement | Audit 2 | Now | Why |
| --- | --- | --- | --- |
| UX redesign | NOT-STARTED | Done (UX2) | UX2 commits |
| Draggable sheet | — | DONE-TESTED (emulator, partly) | `9c8eb06`; `sheetSnap.test.ts` (34) |
| Light and Dark themes, contrast in both | PARTIAL (dark only) | DONE-TESTED | `contrast.test.ts` (119); Emjay's F1 review |
| 7.1 avatars | DONE-TESTED (hand-picked) | DONE-TESTED (assigned automatically by set) | F1 |
| 7.1 consent before permission | NOT-STARTED (no breach yet) | **CONTRADICTED** | The merge asks for location without a consent screen |
| 7.2 blue dot | DEFERRED | DONE-TESTED (partly) | Merge |
| 4.2 reduced mode after a denial | Not built | DONE-TESTED (emulator, by Emjay) | Merge |
| 7.5 check-in | PARTIAL (constants) | PARTIAL (local flow, never seen running) | UX2 |
| 19: onboarding, greeting, destinations | — | DONE-TESTED / PARTIAL | F1 |
| 5.2 "No data" wording | NOT-STARTED | PARTIAL | Live pill and line |
| Icon and splash | Expo defaults | Prepared, not built | R1a |
| Tests | 21 suites, 273 passed | 32 suites, 483 passed | — |
| `npm audit --omit=dev` | 38 (10 moderate, 28 high) | 39 (11 moderate, 28 high) | One more moderate entry; the same four advisories |

## 5. Merged location code (partner's work)

| Item | Finding | Evidence |
| --- | --- | --- |
| Files | `src/services/location.ts`; `src/state/locationStore.ts` with `state/__tests__/locationStore.test.ts` (9 tests); `src/features/map/useLocationTracking.ts`, `BlueDot.tsx`, `OriginPin.tsx`, `LocationExplainer.tsx`. Added at the merge: `useLiveLocation.ts`, `boundsContainPoint`, the `locationDot` tokens and the `RoundButton` `active` state. | `29cc0b0` |
| Who reads the GPS | Only `services/location.ts` imports `expo-location` | `privacy.test.ts`, location test |
| Permission flow | 1. At start, `getForegroundPermissionsAsync` reads the status without a prompt, and again when the app returns to the foreground. 2. The first "Locate me" tap opens the explainer (`explainer: 'idle'` until then). 3. Continue calls `requestForegroundPermissionsAsync`. 4. Not now closes it. 5. If the permission is denied and Android will not ask again, the button opens the app's Settings page. | `useLocationTracking.ts`, `useLiveLocation.ts`, `locationStore.ts` |
| Foreground only | Yes. `ACCESS_BACKGROUND_LOCATION` is in `blockedPermissions`. The `expo-location` plugin has background and foreground service off. | `app.json` |
| Accuracy and rate | `Accuracy.High`, every 2 s or 5 m (`BLUE_DOT_UPDATE_INTERVAL_S`, `BLUE_DOT_UPDATE_DISTANCE_M`, labelled "blue dot only") | `services/location.ts`, `config/index.ts` |
| Stored | **Nothing.** The fix and the manual pin live in memory only; `locationStore` is not persisted (test checks for no `persist` or kv-store). The permission state is re-read each start. | `locationStore.ts`; `privacy.test.ts` |
| Sent | **Nothing.** No file that imports a service or the backend client reads the location store (test). The only network calls in the app are sign-in, sign-out and the session read (`services/auth.ts`, `sessionStore.ts`); `sendTelemetry` is never called. | `privacy.test.ts`; code search |
| When denied | A notice "Location is off. Long-press the map to set your starting point." with Turn on or Open settings. Long-press drops a green pin. **The pin is not used by anything:** My Ride does not read `manualOrigin`, so the notice promises something the app does not do yet. | `index.tsx`, `OriginPin.tsx`; `selectOrigin` unused |
| Outside the map | Notice "You are outside the offline map area"; no follow | `useLiveLocation.ts` |

**Against G0 and the PRD**

| Requirement | State |
| --- | --- |
| Consent screen, stored consent, withdraw (G0; PRD 7.1, 15.1) | **Missing.** The permission is requested without it (see §3.2, CONTRADICTED). |
| Explanation before the system prompt (4.2) | Present: on the first tap, in context |
| Accuracy gates 30 m relay (8.4) and 25 m check-in (7.5) | **Missing** (`accuracyGate.ts` not written). No feature that needs a gate exists yet. |
| Mock rejection (10.3) | **Missing.** `mocked` is read but never checked. |
| Stale-fix rule | **Missing** |
| Development fake location source | **Missing** |
| "Use my location" on My Ride (7.2 step 1, G0 decision 2026-10-04) | **Missing.** `selectOrigin` exists unused. |
| Background rules (8.5) | Not applicable yet. No background work; the watch stops when the hook unmounts. |
| Battery | 2 s High accuracy while Live is open, unmeasured. The partner's walk saw updates about every 5 s. |
| Tests | Store logic is unit-tested. No test covers `useLiveLocation` (render-time follow), the explainer UI or the service. |

## 6. User flow v2 conformance (PRD 19)

| Flow item | Status | Blocked by |
| --- | --- | --- |
| Onboarding: welcome, gender, commuter type, destinations | DONE-TESTED (Emjay, F1 review) | — |
| Greeting on every open, with chips into My Ride | DONE-TESTED | — |
| Gender question and avatar assignment | DONE-TESTED; own-set picker not seen running | — |
| Frequent destinations | PARTIAL: landmark chips only; map tap is F3 | Real landmark names and coordinates (Emjay) |
| Route suggestion ("Take Route 4, board near X", with the fare) | NOT-STARTED (F3) | Nothing for the logic; real data for usefulness |
| Check-in route-first | NOT-STARTED (F4); local Check-in exists, unseen | Cloud check-in needs Supabase, G0, G1 |
| Profile (username, Shuffle, badges, delete, settings) | NOT-STARTED (F2); Shuffle exists | Blocklist lists (Emjay) before a public release; cloud uniqueness needs Supabase |
| Badges | NOT-STARTED (F5) | Real counts need F6 and F9 |
| Energy | NOT-STARTED (F6) | Supabase |
| Tracking with ETA | NOT-STARTED (F7) | S5 data (simulator); boarding point needs G0 or a pin |
| Report flow (manual picker; GPS or not) | NOT-STARTED (F9) | Supabase; GPS path G0 and G2; BLE later on phones |
| Newsfeed (60 min, fixed fields, 3 flags, neutral badge, team only) | NOT-STARTED (F8) | Supabase, sign-in |

## 7. Backend

| Item | State | Evidence |
| --- | --- | --- |
| S4 Part 1 code | Migration with 5 tables, RLS on each, `revoke all` then minimal grants, no client write on `telemetry_latest`, Realtime publication; ingest function with token check, allowlist, packet validation, verification hook, newer-only upsert, `stopped_since` | `supabase/migrations/20261003000000_v0_core.sql`; `ingestCore.ts`; `migration.test.ts` (22), `ingest.test.ts` (22), `packet.test.ts` (25) |
| Run against a live project | **Never.** The 8 integration tests skip. The Deno entry `supabase/functions/ingest/index.ts` has never run or been type-checked. | §11 |
| `team_accounts` rename | **Does not exist.** The allowlist is `telemetry_writers` everywhere; no document records a rename decision. (Question 1.) | code search |
| `app_config` | **Missing.** Decided "yes, in S4 Part 2" (GPS plan decision 4). Also needed for `energy_enabled` and the feed lifetime (flow plan). | — |
| `pg_cron` | None. Decided "yes, with the command approved first" (decision 5). | — |
| Retention | Ingest log purged at 30 days by the function only | `ingestCore.ts` |
| Seed | 3 test vehicles, one inactive | `supabase/seed.sql` |
| Who may read live data | Signed-in accounts only (decision 13) | migration policies |

**Before "Supabase is ready" is useful:**
1. Emjay creates two accounts and fills `.env` (`docs/BACKEND_SETUP.md` §3).
2. The S4 Part 2 migration gains `app_config` (Night Mode window, `energy_enabled`, feed lifetime) before the first push, so the live project does not start without it.
3. Decide the `verify_jwt` setting for the function (open in `BACKEND_SETUP.md`).
4. Docker may be needed for `functions deploy`; it is not installed (unverified for the CLI version).
5. Approve `pg_cron` and its exact commands.
6. Then run the commands in `BACKEND_SETUP.md` §4, one at a time, with approval.

## 8. UX and design

| Item | Finding |
| --- | --- |
| Tabs | Exactly three, Live (`Compass`), Check-in (`MapPin`), My Ride (`Route`); `tabs.test.ts` (2) |
| Themes | Light default, Dark choice, stored on the device; the map remounts per theme (`OfflineMap` `key={scheme}`) |
| Contrast test | 119 checks: every `TEXT_PAIRS` pair at 4.5:1 in both themes; map graphics (trip, stops, occupancy, stale, blue dot) at 3:1 on land; route line and badge. **Not covered:** the avatar art colours (illustrations, same in both themes), the status bar, and three hand-written opacities (`checkin.tsx` 0.38, `settings.tsx` 0.32, `sign-in.tsx` 0.5). |
| Text budget (≤8 words on main screens) | Over budget on a main screen: the location explainer body (28 words) and "Location is off. Long-press the map to set your starting point." (11 words), both on Live, both from the merge. Others are behind Settings, sign-in or Details (`backendMissing` 23 words, `signIn.note` 19, `signedOut` 14). Onboarding `welcomeBody` is 10 words. |
| DESIGN.md | Followed per plan v2 Revision 2: prose palette, system Roboto (Emjay's decision), sheet top radius 28, handle 4 x 32 dp at 8 dp, three snap points 72 dp / 40 % / 90 %, chips 32 dp with a 48 dp target, 48 dp round map buttons, Level 2 elevation for floating controls. Missing: the floating search bar (not planned). |
| Draggable sheet | Works on the emulator by `adb` swipes; flick speed with injected events unreliable; TalkBack never tried (backlog 42 to 45) |
| Dev-only controls | `MapDevOverlay` and `DevBenchmark` return `null` unless `__DEV__`; dev logs are `__DEV__`-guarded. Never checked in a release build (backlog 33). |

## 9. Privacy and security

| Rule | Finding (from reading the code) |
| --- | --- |
| Classification, gender, avatar, destinations stay on the device | **Holds.** Stored only in kv-store (`profileStore.ts`, `destinationsStore.ts`). No service file mentions them; no file that imports a service reads those stores. The only network code is `services/auth.ts`, `services/supabase.ts`, `services/telemetry.ts` (unused) and the session store, none of which import them. |
| Locations | **Never stored or sent** (§5). The check-in stores route and station codes and times, no coordinates (`checkinStore.ts`). |
| Session storage | The Supabase session (token, email) would sit in `expo-sqlite/localStorage` on the device once sign-in is used. |
| Secrets in git history | **Clean.** Scan of `git log -p --all` for publishable and secret keys, JWTs, private keys, AWS, GitHub and Expo tokens: one match, a three-character fake key in `ingest.test.ts`. Only `.env.example` was ever committed (names only, plus `EXPO_PUBLIC_DEV_BROADCAST`). No `.env`, keystore or credential file in history. |
| `eas.json` | Build profiles only, no token |
| `app.json` | Fine and coarse location, notifications; background location blocked; plugins `expo-router`, `expo-build-properties` (min SDK 26), `expo-location` (no background, no foreground service), `expo-sqlite`, MapLibre, `expo-asset`, `expo-splash-screen`; `extra.eas.projectId` (an identifier) |
| Night Mode | Client constants only; no server setting (unchanged). No live markers exist yet, so nothing is published at night today. |
| Retention (10.4, 15.1) | Only the ingest log has a rule (30 days, by the function). No job exists. |
| Consent (7.1, 15.1) | **Breached since the merge** (§5) |

## 10. Process and standing rules

**Pushes.**
- None by the agent since `9a436eb` (2026-10-02 21:28, requested).
- `origin/main` moved to `b21b0c1` on 2026-10-03 through the partner's own push.
- `main` is 28 ahead and 0 behind.

**Packages added since `9a436eb`**

| Package | Version | Native | When | Approved |
| --- | --- | --- | --- | --- |
| `react-native-gesture-handler` | ~2.32.0 | yes | `a5fea43` | Yes (Audit 2) |
| `patch-package` (dev) + `postinstall` | ^8.0.1 | no | `a5fea43` | Yes, under "Fix it before proceeding" (Audit 2) |
| `expo-asset` | ~57.0.18 | yes (part of Expo) | `f852592` | Yes (Revision 1) |
| `expo-file-system` | ~57.0.7 | yes (part of Expo) | `f852592` | Yes (Revision 1) |
| `expo-system-ui` | ~57.0.4 | yes | `29cc0b0` | Yes (merge answer 8; Phase B) |
| `expo-splash-screen` | ~57.0.9 | yes | `45f9798` | Yes (2026-10-04) |

**Native builds.**

| Build | Who | Approval |
| --- | --- | --- |
| Emulator, 2026-10-02 at 23:13 and 23:48 | Emjay, then (23:48) unverified | 23:48 "accepted afterwards" (decision 14) |
| Partner's EAS development build `13591f67`, 2026-10-02 23:43, Poco X6 Pro | The partner | His own; outside this agent's rules |
| Since then | None. R1a is prepared, not built. | — |

**Work beyond an approved step**
1. F1 took in the landmarks file and the destinations store from F3. It was reported in the plan, and F1 was then approved with it.
2. During the merge, the agent added `useLiveLocation.ts`, `boundsContainPoint`, `RoundButton` `active`, the blue-dot tokens, a location privacy test, root background `#ffffff`, and agent-drawn icons. All are in `MERGE_RESULT.md`, approved with the merge.
3. Nothing else found.

**Grouped or unverified commits**
- The first UX2 commits (backlog note: `2eda9d0`, `d76f93d`, `3647293`, `9c8eb06`) are grouped and not individually verified.
- The merge `29cc0b0` is one commit holding both the merge and the port. Its checks were run only on the final state.

**Records missing**
- Emjay's emulator test of `integrate-partner` (2026-10-04) is not in `docs/device-tests.md`.
- The dev-client crash ("App react context shouldn't be created before", on the old build) was not in the backlog; it is now item 64. Who observed it is not recorded. The `SIGSEGV` crash (item 41) was observed by the agent on the emulator; cause unknown (corrected after Audit 3).
- `device-tests.md` "Pending on a physical phone" still says S0 is pending, but the partner's row says S0-M1 passed on his phone, for his code.

## 11. Quality gates (run on 2026-10-04 at `c148972`)

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass (exit 0) |
| `npx expo lint` | Pass (exit 0, no warnings shown) |
| `npx jest` | **32 suites passed; 483 passed, 8 skipped, 491 in all** |
| `npx expo-doctor` | 21/21 checks passed |
| `npx expo install --check` | "Dependencies are up to date" |
| `npm audit --omit=dev` | **39 vulnerabilities (11 moderate, 28 high)**, against 38 (10 moderate, 28 high) at Audit 2. Advisories: `braces`, `decode-uri-component`, `node-forge`, `uuid`. No fix run (standing rule). |

**Skipped tests.** All 8 are in `tests/integration/supabase.test.ts`. They are the live-project acceptance tests, and skip themselves when the `.env` values are absent (the test prints which names are missing):
- ingest accepts an allowlisted writer
- direct insert, update and delete on `telemetry_latest` are denied
- ingest rejects a non-allowlisted account
- ingest rejects an anonymous caller
- client reads active vehicles only
- allowlist and audit log not readable by clients
- ingest rejects malformed packets
- Realtime delivers a telemetry change

They wait for S4 Part 2.

**Per suite (passed):**
- `contrast` 119, `config` 40, `sheetSnap` 34
- `packet` 25, `ingest` 22, `migration` 22, `offlineMap` 22
- `planGuidance` 19, `routing` 18, `sms` 16, `greeting` 14, `routeDb` 13, `fare` 12, `tileInstall` 12
- `avatarPick` 10, `geo` 9, `seed` 9, `locationStore` 9, `privacy` 8, `arrows` 7, `localCheckin` 7, `profileStore` 6, `retry` 6
- `destinations` 4, `routing.bench` 4, `avatarPicker` 3, `rssi` 3, `snapAccuracy` 3, `bounds` 2, `fareType` 2, `tabs` 2
- `supabase` (integration) 1 passed, 8 skipped

**Areas with no automated test:**
- **Screens:** no render tests at all; no rendering library is installed.
- **Map components:** `OfflineMap`, `RouteLines`, `StopDots`, `TripLayers`, `BlueDot` and `OriginPin`. Only the style objects are tested.
- **Hooks and UI logic:**
  - `BottomSheet` as a component (its snap logic is tested);
  - `useLiveLocation`, the render-time follow;
  - `useOfflineTiles` (the install logic is tested);
  - `GreetingCard`;
  - the onboarding step flow;
  - the My Ride destination parameter.
- **Other code:**
  - the Check-in screen;
  - `services/auth.ts` and `services/telemetry.ts`;
  - `RouteDataProvider` (the database code is tested);
  - the avatar drawings;
  - the Deno entry `supabase/functions/ingest/index.ts`.

## 12. Never tested on an emulator or a phone

| Feature | Why not | Partner's phone covers it? |
| --- | --- | --- |
| UX2 Check-in tab (countdown, I boarded, Cancel, restart) | Metro not running when built; never re-run (backlog 49) | No |
| Short About screen | Same (backlog 51) | No |
| Own-set avatar picker (`b80aede`) | Metro stopped for the merge | No |
| TalkBack sheet actions; font scale 1.3 on UX2 screens | Not run (backlog 45, 32) | No |
| Ten-minute soak; zoom 18; Senior and PWD on screen | Not run (backlog 1 to 3) | No |
| Blue dot in airplane mode on the emulator (`G0-M4`) | Not run | Partly: his phone kept the map with data off, on his code |
| Location outside the map area | Not run | No |
| Sign-in, Team account card with a backend | No live project | No |
| Any backend path: ingest, RLS, Realtime | No live project | No |
| Release build: dev controls hidden, cold start, splash, icon | No release build; R1a not built | No |
| **The merged app on any phone** | His build lacks our native modules | **No.** All his results ran his own code (his Map, Plan and Profile tabs, his tile loading through `expo-asset`, his planner). They show that this phone can install a development build, render offline PMTiles, and run a foreground `watchPositionAsync` dot that follows a walk (about every 5 s). The location code kept after the merge is nearly his, so that one result carries over best. His fare and benchmark results do **not** cover our planner. |
| Vendor background survival, battery, data, real accuracy at terminals | Nothing broadcasts; no measurement | Not yet: his phone can now prove these (master plan) |

## 13. Technical debt

| Item | Where | Suggestion |
| --- | --- | --- |
| Inactive candidate trace, 256 lines | `src/data/seed/r4.traced.candidate.ts` | Keep until the import script validates or rejects it; then delete or activate |
| Unused exports | `selectOrigin`, `sendTelemetry`, `deviceIntegrity`, `readDevBroadcastFlag`, `BentoCard`, `BentoGrid`, `telemetry_buffer` table | Each belongs to a future step (G0, G2, G3, S5). `BentoCard` and `BentoGrid` have no planned use: remove in a clean-up step. |
| Hand-written opacities | `checkin.tsx` 0.38, `settings.tsx` 0.32, `sign-in.tsx` 0.5 | Move to theme tokens (`disabledOpacity`, `scrimOpacity`). The magic-number lint covers only `src/shared`. |
| Notice promises an unused feature | "Long-press the map to set your starting point" | Use the pin in G0 ("Use my location"), or shorten the text now |
| Text over budget on Live | Explainer 28 words; location-off 11 | Shorten in G0; the explainer may move into the consent flow |
| Settings vs Profile naming | `settings.tsx`, `strings.settings.title` "Settings" | F2 renames it to Profile |
| Large screen files | `(tabs)/index.tsx` 439 lines, `ride.tsx` 345, `BottomSheet.tsx` 293, `checkin.tsx` 250 | Split Live into its sheet content and floating controls before S5 adds markers |
| `supabase/config.toml` template | 415 lines of `supabase init` defaults | Harmless (Audit 2) |
| Stale doc rows | `device-tests.md` "Pending on a physical phone"; `BACKEND_SETUP.md` "There is no `app_config` table"; GPS plan G0 file names (`locationSource.ts`, "On Fare") | Update with the next docs commit |
| No UI test layer | — | Add `@testing-library/react-native` only with approval; until then keep logic in pure modules |

## 14. NFR status (PRD 13)

| Requirement | Target | Measured? | Where and result |
| --- | --- | --- | --- |
| Live map FPS, 50 markers | ≥55 FPS | Not measured | No markers |
| Routing plus fare | ≤250 ms p95, 3 GB | Partly | PC 0.077 ms p95 on the 4-point line (`routing.bench.test.ts` today); emulator 0.033 to 0.048 ms; partner's Poco X6 Pro 0.72 ms **on his planner**. No 3 GB phone. |
| Cold start to usable map | ≤4 s | Not measured | Development builds only |
| Offline, 30 min airplane | No crash | Not measured | Short airplane runs passed (`S2-M1`, `S3-M1`) |
| Telemetry after 10 min loss | 95 % in order | Not measured | No buffer |
| Marker freshness | p90 ≤30 s | Not measured | Nothing broadcasts |
| SMS latency | p90 ≤60 s | Not measured | Deferred |
| Boarding code replay | 100 % rejected | Not measured | Deferred |
| Night Mode by server | Clock change has no effect | Not measured | Not built |
| Sensitive values | HMAC, vault, TLS | Partly | No secrets in git; TLS by the client library; fingerprint and vault not built |
| Night raw coordinates | Deleted in 24 h | Not measured | No raw table |
| Touch targets and contrast | 48 dp, WCAG AA | Partly | Contrast measured in both themes (119 checks). 48 dp is used on buttons and chip targets; not audited control by control. |
| English and Cebuano | Both | Partly | English only, in `src/strings/en.ts` |
| Primary battery | ≤5 %/h | Not measured | — |
| Data while broadcasting | ≤150 KB/h | Not measured | Packet ≤150 bytes enforced |
| Android 8.0+, six skins | Matrix | Partly | `minSdkVersion` 26. Emulator API 34; one real phone (Android 16), on the partner's code only. |
| Route update without release | Next online launch | Not measured | No sync |

## 15. Document consistency

**Contradictions**

| Where | Says | But |
| --- | --- | --- |
| PRD 1 (design system) | "Dark-mode-first bento grid" | UX2 is light-first Material 3 (plan v2 Revision 2) |
| PRD 7.1 and 15.1 | Consent before any location permission | The app asks for location without consent since the merge (accepted until G0) |
| PRD 12.2 `profiles` | `avatar_id` column | 19 D3: the avatar never leaves the phone |
| PRD 0.2 | S0, S2 and S5 verified on a phone | Emulator accepted in practice; a phone now exists |
| PRD 0.6 and 5.1 | Energy, feed and ETA out of the prototype | 19.3 brings them in (19 wins; the earlier text was not rewritten) |
| PRD 11.1 | Pioneer period ends at a coverage target | 19 D1: free for the whole prototype and pilot, with a switch |
| PRD 7.2 | 8 % opacity for other routes | F4 fades unselected routes; no number decided |
| GPS plan G0 | `locationSource.ts`, "On Fare tap Use my location", consent before the explainer | Actual file `services/location.ts`; there is no Fare tab; the explainer exists without consent |
| GPS plan R1 | One rebuild with everything | Emjay split it into R1a and R1b (2026-10-04) |
| `BACKEND_SETUP.md` | "There is no `app_config` table" | Decision 4: add it in S4 Part 2 |
| `AGENTS.md` | "The approved plan is `docs/IMPLEMENTATION_PLAN_v2.md`" | The master plan will replace it for remaining work (AGENTS.md was not edited, as instructed) |
| `device-tests.md` | S0 pending on a phone | The partner's S0-M1 passed on his phone (his code) |

**Superseded by `docs/IMPLEMENTATION_PLAN_MASTER.md` for remaining work:**
- `IMPLEMENTATION_PLAN_v2.md` (S4 Part 2, S5);
- `IMPLEMENTATION_PLAN_GPS.md` (G0 to G4, R1);
- `IMPLEMENTATION_PLAN_FLOW.md` (F2 to F9).

They stay as history. `FLOW_GAP_ANALYSIS.md`, `MERGE_ANALYSIS.md` and `MERGE_RESULT.md` stay as references.

**Recommended PRD changes (not applied)**
1. Section 1 and 7: the light-first Material 3 design, the three tabs Live, Check-in and My Ride, and the Profile sheet.
2. 0.2 and 0.7: the actual build order (Revision 1, UX2, F, G, the merge), and the emulator for criteria that need no radio or battery.
3. 7.2: PMTiles bundled; the flat projection with its measured accuracy.
4. 12.2: remove `avatar_id` from `profiles`; add `telemetry_ingest_log`, `app_config`, and the 19.3 tables with their columns.
5. 7.3: live view for signed-in team accounts only in v0.
6. 4.2 and 7.1: the location flow as built. The explainer appears on the first "Locate me" tap, after a consent screen (G0). The blue dot is display-only at 2 s or 5 m.
7. 0.3: add the constants the code uses (`BLUE_DOT_*`, `MAP_FOLLOW_ZOOM`, `GREETING_*`, `AVATAR_*`, `FREQUENT_DESTINATIONS_MAX`, sheet snap values) and the missing idle-stop and hard-cap rows.
8. 17: name the partner's Poco X6 Pro (Android 16) as the first test phone, and say what still needs a 3 GB phone.

## 16. Risks and gaps, ranked

| # | Gap | Impact on the thesis and the pilot | Mitigation |
| --- | --- | --- | --- |
| 1 | No live feature exists (markers, coverage, check-in in the cloud, relay) | Very high: the core claim of the product | Supabase live, then S5 and G2 (master plan) |
| 2 | The backend has never run | High: policy or function mistakes appear only live | "Supabase is ready", then S4 Part 2 with `app_config` |
| 3 | Location permission without consent | High for privacy compliance (RA 10173) | G0 consent first in the G0 phase; until then keep the build private |
| 4 | Merged app never ran on a phone; `android/` stale | High: native crashes (like the reported dev-launcher crash) surface only after R1a | R1a now, on the emulator and the partner's phone, as the first phase |
| 5 | All route, stop, landmark and fare data is placeholder | Medium to high: real rides fail the route snap; fares are estimates | Data gathering in parallel; the candidate trace through the import script |
| 6 | Night Mode not on the server | High once markers exist | `app_config` and the suppression view before S5 is used after 21:00 |
| 7 | No UI tests | Medium: regressions only seen by hand | Keep logic pure; ask about a testing library |
| 8 | Battery of the 2 s High-accuracy blue dot | Medium: users may turn location off | Measure on the partner's phone in the stabilise phase; tune the constants |
| 9 | Two unexplained crashes (backlog 41, observed by the agent; 64) | Medium | Reproduce in ST1; full log and conditions each time; count them; no library patch on one crash |
| 10 | Text over budget and misleading notice on Live | Low | G0 |
| 11 | `npm audit` 39 entries | Low (tooling, one shipped DoS path) | Deferred, as decided |

## 17. Questions arising from the audit

1. **`team_accounts` rename:** no such rename exists; the allowlist is still `telemetry_writers`. Did you decide a rename I have no record of? *Blocks the S4 Part 2 migration names.*
2. **The dev-client crash:** what were you doing when it happened, and may I try to reproduce it after R1a? *Blocks stabilise acceptance.*
3. **Tag `s0-s1-code`** on `dd82438`: who made it, and should it stay? *Blocks nothing.*
