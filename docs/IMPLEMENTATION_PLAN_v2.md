# Implementation plan v2: Prototype v0 (S0 to S5)

Date: 2026-10-02. Source of truth: `docs/PRD.md` (v2.0), section 0 first. Replaces the root `IMPLEMENTATION_PLAN.md`. Builds on the audit in `docs/AUDIT.md`.

No application code is written until this plan is approved. Each step ends with its tests run, a short report of what passed, and a stop for approval before the next step.

## 1. Approach and assumptions

**Approach**

1. **Extend, do not rewrite.** The theme and the three Bento primitives are kept as they are. The root layout and tab layout are edited. Two placeholder tab screens are removed (`routes.tsx`, `crowdfeed.tsx`) because their features are out of scope; that is a deletion of blank stubs, not a rewrite.
2. **Single Expo app, no monorepo.** Pure logic lives in `src/shared/` with no React Native or Expo imports, enforced by a lint rule, and is tested in a plain Node environment. It can be lifted into `packages/shared` later without edits.
3. **One config module.** Every threshold, fare value and feature flag is a named constant in `src/shared/config/`. No other file contains a threshold literal. Server-side values are mirrored in a Supabase `app_config` table.
4. **One seed file.** All Route 4 placeholder data is in `src/data/seed/r4.placeholder.ts`, each value marked `TODO(placeholder)`. Replacing it means editing that file and bumping `route_data_version`.
5. **Route data is read from SQLite.** Nothing outside the seed file names Route 4, its stops or its color. Adding a route later is a data change.
6. **Thin device code.** Screens and hooks call shared functions; they hold no rules of their own.
7. **Verification is a hook, not a feature.** `verifyReport` and `deviceIntegrity` exist and are called, but always answer "unverified".
8. **Android only.** No iOS config, scripts, branches or packages.

**Screen layout for v0** (three tabs instead of the current five)

| Tab | Route file | Delivers |
| --- | --- | --- |
| Map | `src/app/(tabs)/index.tsx` | Offline map and blue dot (S2), live markers (S5) |
| Plan | `src/app/(tabs)/plan.tsx` (renamed from `fare.tsx`) | Origin, destination, itinerary and fare estimate (S3) |
| Profile | `src/app/(tabs)/profile.tsx` | Fare classification, sign-in state (S3, S4) |

Outside the tabs: `src/app/sign-in.tsx` (S4) and `src/app/dev-broadcast.tsx` (S5, hidden unless the development flag is on).

**Assumptions** (each is also an open question in section 8 where it needs your answer)

- Tests in S0, S2 and S5 run on the Android Studio emulator (`Pixel_7` AVD). Physical-phone checks from PRD 0.2 are recorded as "later" in `docs/device-tests.md`.
- A hosted Supabase project is used; nothing runs in Docker.
- Team accounts sign in with email and password for v0 (question 1).
- React Native 0.86 runs the New Architecture, which MapLibre React Native 11 needs. Confirmed or refuted by `npx expo-doctor` and the first build in S0.
- The marker badge is driven by each row's `verified` value, which is always `false` while `ENABLE_VERIFICATION` is off. The flag itself is read in one place, inside `verifyReport`.

## 2. Target file tree (new and changed files only)

```text
app.json                                   changed  Android only, plugins, permissions, min SDK 26
package.json                               changed  scripts, Jest config, dependencies via one install
tsconfig.json                              changed  Jest types, extra include paths
.gitignore                                 changed  ignore .env files
.env.example                               new      variable names only, no values
eslint.config.js                           new      Expo config + "no React Native in src/shared" rule
docs/device-tests.md                       new      numbered manual test scripts and results log

src/shared/                                new      PURE TYPESCRIPT, no react-native / expo imports
  config/index.ts                                   all constants and ENABLE_VERIFICATION
  fare/fare.ts                                      fare formula and rounding
  geo/haversine.ts                                  point-to-point distance
  geo/line.ts                                       progress along a line, slice length, walk-along
  geo/bounds.ts                                     point-in-viewport test for culling (S5)
  sms/protocol.ts                                   HM2 parser, signer and validator
  rssi/ema.ts                                       exponential smoothing
  routing/plan.ts                                   direction-aware itinerary planner (S3)
  telemetry/sendRule.ts                             100 m or 30 s rule (S5)
  telemetry/coverage.ts                             Live / Stale / No data (S5)
  telemetry/occupancy.ts                            seats taken to Green / Amber / Red (S5)
  telemetry/stopped.ts                              stopped-bubble rule (S5)
  telemetry/packet.ts                               re-export of the packet validator below
  verification/verifyReport.ts                      re-export of the hook below
  verification/deviceIntegrity.ts                   placeholder integrity hook
  __tests__/*.test.ts                               unit tests, Node environment

src/data/seed/r4.placeholder.ts            new      the only place placeholder route data lives
src/data/db/schema.ts                      new      SQLite DDL from PRD 12.1, as data
src/data/db/migrate.ts                     new      create tables, seed when version is newer
src/data/db/routeRepository.ts             new      typed reads: routes, stations, route stations

src/state/locationStore.ts                 new      permission state, last fix, manual origin pin
src/state/profileStore.ts                  new      classification, persisted on the device only
src/state/sessionStore.ts                  new      Supabase auth session
src/state/vehiclesStore.ts                 new      live telemetry rows from Realtime

src/services/supabase.ts                   new      the one Supabase client, keys from env
src/services/telemetry.ts                  new      call the ingest function; subscribe to Realtime

src/features/map/OfflineMap.tsx            new      MapLibre map with the offline style
src/features/map/BlueDot.tsx               new      user position layer
src/features/map/LocationExplainer.tsx     new      plain-language screen before the system prompt
src/features/map/tiles.ts                  new      copy the bundled tile set to app storage once
src/features/live/VehicleMarker.tsx        new      halo, heading cone, badge, stopped bubble
src/features/live/CoverageBanner.tsx       new      Live / Stale / No data line for the route
src/features/plan/ItineraryCard.tsx        new      walk, ride, walk steps
src/features/plan/FareCard.tsx             new      distance, fare, discount, "estimate" label
src/features/profile/ClassificationPicker.tsx  new  four classifications

src/app/_layout.tsx                        changed  database provider, session bootstrap
src/app/(tabs)/_layout.tsx                 changed  three tabs: Map, Plan, Profile
src/app/(tabs)/index.tsx                   changed  map screen
src/app/(tabs)/plan.tsx                    renamed  from fare.tsx; routing and fare
src/app/(tabs)/profile.tsx                 changed  classification, sign-in state
src/app/(tabs)/routes.tsx                  removed
src/app/(tabs)/crowdfeed.tsx               removed
src/app/sign-in.tsx                        new      team sign-in
src/app/dev-broadcast.tsx                  new      dev-only test vehicle broadcaster
src/components/Screen.tsx                  changed  optional non-scrolling, edge-to-edge mode for the map

assets/map/style.json                      new      offline map style
assets/map/<placeholder tile set>          new      small Butuan tile set (format decided in S2)

supabase/migrations/0001_v0_core.sql       new      tables, row-level security, Realtime publication
supabase/seed.sql                          new      test vehicles and config rows (no secrets)
supabase/functions/ingest/index.ts         new      authenticated, allowlisted telemetry ingest
supabase/functions/_shared/packet.ts       new      packet validator, pure TS, shared with the app
supabase/functions/_shared/verifyReport.ts new      verification hook, pure TS, shared with the app

scripts/simulate-vehicle.ts                new      vehicle simulator, run from Node
tests/integration/supabase.test.ts         new      S4 acceptance tests against the hosted project
```

The packet validator and `verifyReport` physically live under `supabase/functions/_shared/` because the Edge Function can only bundle files inside `supabase/functions/`. `src/shared/` re-exports them, so there is one copy and the same Jest suite tests it.

## 3. Dependency and config changes (one batch, linked to docs/AUDIT.md section 6 and 7)

All dependency changes happen once, at the start of S0, using the single command line in **`docs/AUDIT.md` section 6**. There is no uninstall. No later step adds a package; if one turns out to be needed, I stop and ask first.

All config changes are the list in **`docs/AUDIT.md` section 7** and are applied in S0: `app.json` (remove `ios` and `web`, Android only, five plugins, permissions, min SDK 26), `package.json` (scripts, Jest config), `.gitignore`, `.env.example`, `tsconfig.json`, ESLint config.

Machine setup that only you can do is also in AUDIT section 7: `ANDROID_HOME`, `JAVA_HOME` pointing at Android Studio's JBR, the API 36 platform and NDK 27.1 installed through the SDK Manager.

## 4. Steps

### S0: Tooling and project baseline

**1. Goal.** The existing project builds as an Expo dev client for Android, opens in the emulator, and has passing test, lint and type-check commands.

**2. Files to create or change**

| Path | Purpose |
| --- | --- |
| `package.json` | Dependencies from the one-shot install; remove `ios` script; add `lint`, `test`, `simulate`; Jest config with a Node project for `src/shared` and an Expo project for the rest |
| `app.json` | Changes from AUDIT section 7 |
| `tsconfig.json` | Jest types; include `scripts/` and `supabase/functions/_shared/` |
| `.gitignore` | Ignore `.env` and `.env.*`, keep `.env.example` |
| `.env.example` | Names of the Supabase and dev-flag variables |
| `eslint.config.js` | Expo lint config plus the import restriction for `src/shared` |
| `src/app/(tabs)/_layout.tsx` | Three tabs |
| `src/app/(tabs)/plan.tsx` | Renamed from `fare.tsx`, still a blank Bento layout |
| `src/app/(tabs)/routes.tsx`, `crowdfeed.tsx` | Deleted |
| `src/services/supabase.ts` | Client factory that reads the two public keys from env and fails with a clear message if they are missing |
| `src/shared/config/index.ts` | Created with the full constants table from section 6, so later steps only read from it |
| `src/shared/__tests__/config.test.ts` | First unit test |
| `docs/device-tests.md` | Created with the S0 script |

**3. Dependencies.** Plan approval; answers to open questions 3, 8 and 9; machine setup from AUDIT section 7.

**4. Tests per acceptance criterion**

| Acceptance criterion | Test name | Asserts | Kind |
| --- | --- | --- | --- |
| App installs and opens in the emulator | `S0-M1 dev client launch` | The dev client installs, the three tabs render, no red error screen | manual device test |
| The test command runs and passes | `config exposes every PRD 0.3 default` | Each constant in section 6 exists with its default value | unit test |
| The test command runs and passes | `shared code has no React Native imports` | The lint rule reports zero violations in `src/shared` | unit test (lint run) |
| `npx tsc --noEmit` is clean | `S0 type-check` | Exit code 0, zero errors | unit test (command) |
| Supabase connection from env | `supabase client requires env keys` | Creating the client without the env keys throws the documented error; with dummy keys it returns a client | unit test |

**5. Manual test script (`S0-M1`)**

1. Confirm no other npm process is running in the folder.
2. Start the `Pixel_7` emulator from Android Studio.
3. Run `npx expo run:android` and wait for the build (the first build downloads Gradle and Android libraries and can take a long time on this connection).
4. Confirm the app named in `app.json` opens without a red error screen.
5. Tap each of the three tabs; each shows its title on the dark canvas.
6. Close and reopen the app from the launcher; it opens again.
7. In Android Settings, Apps, open the app's info page and confirm the minimum is honored (the build installs only on API 26 or newer; note the emulator's API level).
8. Record emulator model, API level, date and result in `docs/device-tests.md`.

**6. Risks and open questions**

- The first install and first Gradle build are slow on this network. Neither may be interrupted or run twice at once.
- Java 25 is on PATH. If `JAVA_HOME` is not pointed at Android Studio's JBR, the Gradle build is likely to fail.
- The API 36 platform and the NDK are not installed yet.
- MapLibre React Native 11.4.1 declares support for `react-native >= 0.80` and `expo >= 54`, but nobody on this project has built it against React Native 0.86. If the native build fails, I report the error and stop rather than swap libraries.
- Expo Router 57 `Tabs` options and lucide 1.x icon names in the existing tab layout are unverified until the first type-check after the install.
- Open questions 3, 8, 9 (section 8).

**7. Definition of done**

- [ ] One-shot install finished; `npx expo install --check` and `npx expo-doctor` report no blocking issue
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` passes
- [ ] `S0-M1` passes on the emulator and is recorded in `docs/device-tests.md`
- [ ] No `ios` key, script or folder exists
- [ ] `.env` is git-ignored; `.env.example` contains names only
- [ ] S0 report written; approval received

### S1: Shared core (pure TypeScript)

**1. Goal.** All rules that can be tested without a phone exist as pure functions with the unit tests the PRD requires.

**2. Files to create or change**

| Path | Purpose |
| --- | --- |
| `src/shared/config/index.ts` | Final constants (already created in S0); typed, frozen |
| `src/shared/fare/fare.ts` | Fare from distance, route fare parameters, multiplier and rounding setting. Works in centavos internally to avoid floating-point drift. Returns both the unrounded and rounded amounts. |
| `src/shared/geo/haversine.ts` | Distance in meters between two coordinates |
| `src/shared/geo/line.ts` | Nearest point on a line with its distance along the line (chainage); length of the slice between two chainages; point at a given chainage |
| `src/shared/sms/protocol.ts` | Build and sign an `HM2` message; validate with one regular expression, then split the station list; verify signature, sequence (wrap-around aware), time window and, when given, sender |
| `src/shared/rssi/ema.ts` | Exponential moving average where the first reading initializes the average |
| `src/data/seed/r4.placeholder.ts` | Stops RCA, MCA, JCA, TSO, IMA, the `DEO` end point, the outbound line and the return line derived by reversing it, the route color, a `route_data_version`. Every value marked `TODO(placeholder)`. |
| `src/shared/__tests__/fare.test.ts`, `haversine.test.ts`, `line.test.ts`, `sms.test.ts`, `rssi.test.ts`, `seed.test.ts` | Unit tests below |

Beacon codes are not built (deferred to S6).

**3. Dependencies.** S0 (test runner, config module, `@noble/hashes`, `@turf/turf`).

**4. Tests per acceptance criterion** (all are unit tests)

| Test name | Asserts |
| --- | --- |
| `fare regular 4.0 km` | ₱15.00 |
| `fare regular 4.1 km` | ₱17.00 |
| `fare regular 6.3 km` | ₱21.00 |
| `fare regular 10.0 km` | ₱27.00 |
| `fare discounted 6.3 km unrounded` | ₱16.80 with multiplier 0.8 and rounding off |
| `fare discounted 6.3 km rounded` | ₱16.75 with rounding to the nearest ₱0.25 |
| `fare rounding is a config setting` | Changing the rounding step in config changes the result; no literal in `fare.ts` |
| `fare uses route parameters` | Passing different base fare, base distance and per-km rate changes the result as the formula predicts |
| `rssi first reading initializes` | A single reading of -60 returns -60 |
| `rssi alpha 0.3` | -60 then -70 returns -63.0 |
| `haversine RCA to JCA` | Between 59 m and 63 m |
| `line chainage increases along the outbound line` | The five stops project onto the outbound line in the order IMA, TSO, RCA, JCA, MCA |
| `line slice length` | The slice between two chainages equals their difference |
| `sms parses all three stations` | A message generated by the signer with three stations returns three entries with the right codes and counts |
| `sms rejects a changed signature character` | Flipping one signature character fails validation |
| `sms rejects a sequence that is not newer` | Equal and older sequence numbers fail; a wrapped newer number (for example 9999 then 0001) passes |
| `sms rejects a stale timestamp` | 31 minutes off fails; 29 minutes passes; a window that crosses midnight is handled |
| `sms rejects a wrong sender` | When a sender and an expected gateway number are supplied and differ, validation fails |
| `sms round trip` | A message built by the signer validates with the same key and fails with a different key |
| `seed stops are inside the expected ranges` | Every stop latitude is within 8.90 to 8.96 and longitude within 125.52 to 125.65 (bounds are constants in the test, taken from the PRD 12.5 values) |
| `seed coordinates are longitude first` | Every polyline coordinate has its first number above 100 and its second below 20 |
| `seed return is outbound reversed` | The return coordinates equal the outbound coordinates in reverse order |
| `seed matches PRD 12.5` | The six coordinates equal the PRD table exactly |

Test messages are generated with the signer and a test key. The sample signature printed in the PRD is not used as a fixture.

**5. Manual test script.** None. S1 is fully automated.

**6. Risks and open questions**

- The sequence wrap-around window is not defined in the PRD (open question 11).
- The `HHMM` field carries no date. The validator compares against the current Asia/Manila time and picks the nearest matching minute within a day. This is stated in a code comment and covered by the midnight test.
- The fare values and the ₱0.25 rounding are placeholders to be confirmed against the official fare order. They are in config and marked as such.

**7. Definition of done**

- [ ] Every test in the table passes
- [ ] No number other than 0 and 1 appears in `src/shared` outside `config/` (checked by review and a lint rule for magic numbers scoped to `src/shared`)
- [ ] `src/shared` imports nothing from React Native or Expo
- [ ] `npx tsc --noEmit` and `npm run lint` are clean
- [ ] S1 report written; approval received

### S2: Offline map and blue dot

**1. Goal.** The Map tab shows an offline map of Butuan with a blue dot that follows the device location, with no network.

**2. Files to create or change**

| Path | Purpose |
| --- | --- |
| `assets/map/style.json` | Dark offline style that points at the local tile set |
| `assets/map/<placeholder tile set>` | Small vector tile set for the Butuan bounding box |
| `src/features/map/tiles.ts` | Copy the bundled tile set into app storage on first launch and return its local path |
| `src/features/map/OfflineMap.tsx` | MapLibre map, camera bounded to the tile set, no remote sources |
| `src/features/map/BlueDot.tsx` | Dot and accuracy ring drawn from the location store |
| `src/features/map/LocationExplainer.tsx` | Plain-language explanation with "Continue" and "Not now", shown before the system permission prompt |
| `src/state/locationStore.ts` | Permission status, latest fix, manual origin pin |
| `src/components/Screen.tsx` | Optional full-bleed, non-scrolling mode |
| `src/app/(tabs)/index.tsx` | Map screen: explainer, map, blue dot, "set origin" by long-press when permission is denied |
| `docs/device-tests.md` | S2 scripts |

The blue dot is fed by `expo-location` (the PRD's stated location source) through the store, so routing in S3 and the dev broadcast in S5 reuse the same fix.

**3. Dependencies.** S0. Open question 7 (who supplies the placeholder tile set, and labels or no labels).

**4. Tests per acceptance criterion**

| Acceptance criterion | Test name | Asserts | Kind |
| --- | --- | --- | --- |
| Map renders in airplane mode | `S2-M1 offline render` | With airplane mode on from a cold start, map tiles draw | manual device test |
| Dot follows simulated GPS | `S2-M2 blue dot follows route` | The dot moves along a GPX route played from the emulator's extended controls | manual device test |
| No crash in a 10 minute session | `S2-M3 ten minute soak` | Ten minutes of GPX playback with panning and zooming, no crash, no red screen | manual device test |
| Denying permission does not crash | `S2-M4 permission denied` | After "Deny", the map still renders and a long-press sets a manual origin pin | manual device test |
| Explanation comes before the prompt | `location store: explainer before prompt` | The store does not request permission until the explainer is accepted | unit test |
| Reduced mode | `location store: denied enables manual pin` | With status "denied", setting a manual pin updates the origin and the fix stays empty | unit test |
| No remote sources | `style has no network URLs` | The style file contains no `http` or `https` source, glyph or sprite URL | unit test |

**5. Manual test scripts**

`S2-M1 offline render`
1. Install the dev client build and open the app once online so the JavaScript bundle is loaded, or use a build with the bundle embedded.
2. Force-stop the app.
3. Turn on airplane mode in the emulator's quick settings.
4. Open the app and go to the Map tab.
5. Expect: streets or land shapes of Butuan are drawn. Pan and zoom; tiles keep drawing.
6. Record the result.

`S2-M2 blue dot follows route`
1. Keep airplane mode on.
2. Accept the explainer, then allow location in the system prompt.
3. In the emulator's Extended controls, Location, set a single point at stop RCA (8.947459, 125.541426). Expect the dot there.
4. Load a GPX file that walks the placeholder outbound line and press play.
5. Expect the dot to move along the line. Record the result.

`S2-M3 ten minute soak`
1. Continue the GPX playback on loop for 10 minutes.
2. Every minute, pan, zoom in and zoom out once; switch to another tab and back twice during the run.
3. Expect no crash and no red error screen. Record start time, end time and result.

`S2-M4 permission denied`
1. Clear the app's data. Open the app.
2. On the explainer, tap Continue; in the system prompt tap "Don't allow".
3. Expect the map to render with no dot and a short notice that location is off.
4. Long-press the map. Expect an origin pin at that point.
5. Clear the app's data again and choose "Not now" on the explainer. Expect the same reduced mode with no system prompt shown.

**6. Risks and open questions**

- **Local tile format is the main technical risk.** The MapLibre React Native 11 documentation I could read only shows web tile URLs. Whether it reads a local `.mbtiles` or PMTiles file on Android must be proven first. S2 therefore starts with a short test: load a tiny local tile file. If neither format loads, I stop and report options before building the rest.
- Text labels need font (glyph) files stored offline. If labels are wanted in v0, glyph files must be bundled too (open question 7).
- I cannot create map data. The placeholder tile set must come from a real source that you approve (open question 7).
- App size grows by the size of the tile set.
- "Follows the phone" on a physical device is a later check; the emulator test uses simulated GPS.

**7. Definition of done**

- [ ] Local tile loading proven and the chosen format recorded in `docs/device-tests.md`
- [ ] `S2-M1` to `S2-M4` pass on the emulator and are recorded
- [ ] Unit tests in the table pass
- [ ] Only foreground fine location is requested; no background permission appears in the built manifest
- [ ] Type-check and lint clean
- [ ] S2 report written; approval received

### S3: Local route data, offline routing and fare

**1. Goal.** The Plan tab turns an origin and a destination into a walk, ride, walk itinerary on Route 4 with a fare estimate, entirely offline, using route data read from SQLite.

**2. Files to create or change**

| Path | Purpose |
| --- | --- |
| `src/data/db/schema.ts` | The five tables from PRD 12.1 (`franchise_routes`, `route_alternatives`, `stations`, `route_stations`, `telemetry_buffer`), plus whatever open question 4 decides for direction |
| `src/data/db/migrate.ts` | Create tables; seed from the placeholder file when its `route_data_version` is newer than the stored one; compute each stop's `seq` and `chainage_km` from the polyline instead of hardcoding them |
| `src/data/db/routeRepository.ts` | Typed reads; parses GeoJSON once and caches it |
| `src/shared/routing/plan.ts` | Planner: project origin and destination onto each directed line; reject a direction when the destination is not ahead of the origin; reject when either walk exceeds the walking limit; choose the best valid direction; return walk, ride, walk steps with distances and the ride slice length |
| `src/state/profileStore.ts` | Classification, persisted with the on-device key-value store only |
| `src/features/profile/ClassificationPicker.tsx` | Regular, Student, Senior Citizen, Person with Disability |
| `src/features/plan/ItineraryCard.tsx`, `FareCard.tsx` | Result cards; the fare is labelled an estimate |
| `src/app/(tabs)/plan.tsx` | Origin (GPS fix or manual pin), destination picker, results |
| `src/app/(tabs)/profile.tsx` | Classification picker |
| `src/app/_layout.tsx` | Database provider that runs the migration before screens render |
| `src/shared/__tests__/routing.test.ts`, `routing.bench.test.ts`, `privacy.test.ts` | Tests below |
| `src/data/db/__tests__/seed.test.ts` | Seed-to-row mapping tests |

`telemetry_buffer` is created because it is part of the 12.1 schema, but nothing writes to it in v0.

**3. Dependencies.** S1 (fare, geometry, seed), S2 (location store, manual pin). Open questions 4, 5 and 6.

**4. Tests per acceptance criterion**

| Acceptance criterion | Test name | Asserts | Kind |
| --- | --- | --- | --- |
| Routing plus fare in 250 ms or less at p95 | `routing benchmark p95` | 1,000 random origin and destination pairs near the line; the 95th percentile of plan-plus-fare time is 250 ms or less. The test prints the machine it ran on. | unit test (Node benchmark) |
| Same, on a device | `S3-M3 on-device benchmark` | A development-only button runs the same 1,000 pairs in the app and shows p50 and p95 | manual device test |
| Destination behind the origin is rejected | `routing rejects destination behind origin on one direction` | On the outbound line alone, origin at JCA and destination at TSO returns "not ahead" | unit test |
| Direction check uses both lines | `routing picks the return line when the destination is behind on outbound` | With both lines loaded, JCA to TSO is served by the return direction | unit test |
| Walking limit | `routing rejects walks over the limit` | An origin 600 m from the line returns "too far to walk"; 400 m is accepted | unit test |
| No transfers | `routing returns exactly walk, ride, walk` | Every itinerary has three legs | unit test |
| Fare uses the route slice | `fare uses ride distance not walk distance` | Moving the origin sideways away from the line changes the walk leg but not the fare | unit test |
| Discount only for discounted classes | `discount applies to Student, Senior Citizen, PWD only` | Regular gets multiplier 1.0; the other three get the configured multiplier | unit test |
| Works in airplane mode | `S3-M1 offline plan` | A plan and fare appear with airplane mode on | manual device test |
| Classification stays on the device | `no cloud payload contains classification` | The telemetry packet validator rejects unknown keys, and no file under `src/services` or `supabase/` references the classification field | unit test |
| Route data comes from the database | `seed maps to rows` | The seed produces two directed lines, the stations and route-station rows with increasing chainage, and the stored version equals the seed version | unit test |
| Version bump reseeds | `newer route_data_version replaces rows` | Seeding with a higher version replaces the route rows; the same version does nothing | unit test |

**5. Manual test scripts**

`S3-M1 offline plan`
1. Turn on airplane mode. Open the Plan tab.
2. Set the emulator location to stop TSO (8.946096, 125.533083).
3. Choose a destination ahead on the route (which destinations are offered depends on open questions 5 and 6).
4. Expect three steps (walk, ride Route 4, walk), a distance and a fare labelled as an estimate.
5. Record the result.

`S3-M2 discount`
1. In Profile, choose Regular. Note the fare for the S3-M1 trip.
2. Choose Student, then Senior Citizen, then Person with Disability. Expect the discounted fare each time.
3. Force-stop and reopen the app. Expect the classification to be remembered.

`S3-M3 on-device benchmark`
1. Open the development benchmark from the Plan tab (shown only in development builds).
2. Run it three times. Record p50 and p95, the emulator or phone model, RAM and API level.
3. Note that the PRD target is defined on a 3 GB phone; an emulator figure is indicative only.

`S3-M4 destination behind`
1. Set the origin near DEO or the easternmost stop and a destination to the west.
2. Expect the itinerary to use the return direction, or a clear "no route in this direction" message if the pair is not servable. Never a crash.

**6. Risks and open questions**

- The PRD schema has one polyline per `route_id`, but Route 4 needs two (open question 4).
- Whether riders board only at stops or anywhere on the line changes the planner and the screen (open question 5).
- Whether `DEO` is a stop decides if any placeholder trip exceeds the base fare distance (open question 6).
- The return line is the outbound line reversed, so with this data every pair of points is servable in exactly one direction. Real data will not behave this way; the tests that depend on it are marked as placeholder-specific.
- The placeholder line cuts across blocks, so walking distances on the map will look wrong. Expected, per PRD 12.5.
- A Node benchmark is not a phone benchmark. The 250 ms claim is only made for the device actually measured.

**7. Definition of done**

- [ ] Tables match PRD 12.1 (plus the agreed direction change)
- [ ] All unit tests in the table pass, including the benchmark
- [ ] `S3-M1` to `S3-M4` pass and are recorded with device details
- [ ] No route id, stop code, color or fare value appears outside the seed file and config
- [ ] Classification is written only to on-device storage
- [ ] Type-check and lint clean
- [ ] S3 report written; approval received

### S4: Minimal backend (Supabase)

**1. Goal.** A signed-in, allowlisted team account can publish telemetry through one Edge Function, and nobody can write telemetry any other way.

**2. Files to create or change**

| Path | Purpose |
| --- | --- |
| `supabase/migrations/0001_v0_core.sql` | Tables: `profiles` (user id, created at; no classification, no avatar), `vehicles` (vehicle id, plate, route id, active), `telemetry_latest` (one row per vehicle: latitude, longitude, speed, heading, seats taken, packet timestamp, server `updated_at`, `stopped_since`, `verified boolean default false`, `verification_reasons jsonb`), `telemetry_writers` (the team allowlist), `app_config` (server-side constants). Row-level security enabled on all five. Realtime publication on `telemetry_latest`. |
| `supabase/seed.sql` | Two test vehicles on Route 4 with fake plates, one inactive vehicle for the "active only" test, and the config rows. No secrets. |
| `supabase/functions/_shared/packet.ts` | Validator for the seven packet fields; rejects missing, mistyped, out-of-range and unknown fields |
| `supabase/functions/_shared/verifyReport.ts` | Returns `unverified` with reason `verification_disabled` while the flag is off; the only reader of `ENABLE_VERIFICATION` |
| `supabase/functions/ingest/index.ts` | Check the caller's session; check the allowlist; validate the packet; call `verifyReport`; ignore packets older than the stored one; upsert `telemetry_latest`, maintaining `stopped_since` from the stationary speed threshold |
| `src/shared/telemetry/packet.ts`, `src/shared/verification/verifyReport.ts` | Re-exports of the two shared files |
| `src/shared/verification/deviceIntegrity.ts` | Placeholder hook returning "not checked" |
| `src/state/sessionStore.ts` | Session state from Supabase Auth |
| `src/app/sign-in.tsx` | Team sign-in screen |
| `src/app/(tabs)/profile.tsx` | Signed-in state and sign-out |
| `src/services/telemetry.ts` | Function that sends one packet to the ingest function |
| `tests/integration/supabase.test.ts` | Acceptance tests below; skipped with a clear message when the test env variables are absent |
| `src/shared/__tests__/packet.test.ts`, `verify.test.ts` | Unit tests |
| `.env.example` | Names of the test-account variables |

Row-level security rules, in words: clients can read `vehicles` where `active` is true; clients can read `telemetry_latest` rows whose vehicle is active; a user can read and create only their own `profiles` row; clients can read `app_config`; clients have no insert, update or delete right on `telemetry_latest`, `vehicles`, `telemetry_writers` or `app_config`; only the ingest function, running with elevated rights on the server, writes telemetry. `telemetry_latest` stores no user id, so rider identity cannot reach the map.

Latitude and longitude are stored as plain numeric columns because Realtime delivers PostGIS geometry in a binary form that the app would have to decode. A PostGIS `geom` column, as named in PRD 12.2, can be added as a generated column without touching the app.

Not built in S4: `devices`, `relay_sessions`, `telemetry_raw`, `node_events`, `checkins`, `sms_outbox`, ledgers, flags, `route_versions`.

**3. Dependencies.** S0 (client, env). S1 (config). Open questions 1, 2, 3 and 13.

**4. Tests per acceptance criterion**

| Acceptance criterion | Test name | Asserts | Kind |
| --- | --- | --- | --- |
| Allowlisted client can send telemetry | `ingest accepts an allowlisted writer` | The function returns success and `telemetry_latest` holds the sent values with `verified = false` and reason `verification_disabled` | integration test |
| Direct insert is denied | `direct insert into telemetry_latest is denied` | An insert and an update from a signed-in client both fail with a permission error | integration test |
| Non-allowlisted account cannot write | `ingest rejects a non-allowlisted account` | The function returns a "forbidden" status and the row is unchanged | integration test |
| Signed-out caller cannot write | `ingest rejects an anonymous caller` | The function returns an "unauthorized" status | integration test |
| Read active vehicles only | `client reads active vehicles only` | The inactive seeded vehicle and its telemetry row are absent from client reads; a signed-out client reads nothing | integration test |
| Malformed packets rejected | `ingest rejects malformed packets` | Missing field, text where a number is expected, latitude out of range, seats above capacity, unknown extra field: each returns a "bad request" status | integration test |
| Same, without the network | `packet validator cases` | The same cases against the shared validator | unit test |
| Verification hook | `verifyReport returns unverified with verification_disabled` | Status and reason as specified while the flag is off | unit test |
| Integrity hook | `deviceIntegrity returns placeholder` | Returns the placeholder result | unit test |
| Classification not in the cloud | `profiles has no classification column` | The migration text defines no classification or avatar column; the packet validator rejects a `classification` key | unit test |
| Realtime | `realtime delivers a telemetry change` | A subscribed client receives the row within a few seconds of an ingest call | integration test |

**5. Manual test script (`S4-M1 sign-in`)**

1. In the Supabase dashboard, create two team accounts: one added to the allowlist table, one not.
2. Open the app, go to Profile, sign in with the allowlisted account. Expect the signed-in state.
3. Force-stop and reopen. Expect to still be signed in.
4. Sign out. Expect the signed-out state.
5. Run `npm test` with the test env variables set. Expect every integration test to pass. Record the result.

**6. Risks and open questions**

- No Supabase project, CLI, Docker or Deno exists on this machine yet (open questions 2 and 3).
- The PRD's sign-in methods cannot be automated for tests or the simulator (open question 1).
- Integration tests need the network and two test accounts whose passwords live in a git-ignored env file.
- The PRD gives no rule for how old or how far in the future a packet timestamp may be (open question 13).
- With verification off, an allowlisted account can publish any position. This is accepted for a private v0 and is why the allowlist exists.
- No audit trail of who wrote a telemetry row is kept in v0, to keep rider identity out of the table. If you want one, it needs a separate, client-unreadable table (open question 14).
- Free-tier limits on Realtime and Edge Function calls are not expected to matter at this scale, but are unmeasured.

**7. Definition of done**

- [ ] Migration applied to the hosted project; row-level security on for every table
- [ ] Ingest function deployed
- [ ] All integration and unit tests in the table pass
- [ ] `S4-M1` passes and is recorded
- [ ] No key, password or secret is in the repository; `.env` is ignored
- [ ] No classification, avatar or rider identity column exists in any table
- [ ] Type-check and lint clean
- [ ] S4 report written; approval received

### S5: Live map

**1. Goal.** The Map tab shows live Route 4 vehicles from Realtime with occupancy, heading, coverage state and a stopped bubble, fed by a simulator and a dev broadcast screen.

**2. Files to create or change**

| Path | Purpose |
| --- | --- |
| `src/shared/telemetry/sendRule.ts` | Decide whether to send: moved the configured distance or the configured time elapsed, whichever is first |
| `src/shared/telemetry/coverage.ts` | Live, Stale or No data from the age of the newest packet, per marker and per route |
| `src/shared/telemetry/occupancy.ts` | Seats taken and capacity to Green, Amber or Red with its label |
| `src/shared/telemetry/stopped.ts` | Bubble shown when the latest packet is under the speed threshold and the stopped span is at least the configured duration |
| `src/shared/geo/bounds.ts` | Keep only markers inside the visible bounds |
| `src/state/vehiclesStore.ts` | Rows from the initial read and Realtime; server-clock offset; a refresh tick |
| `src/services/telemetry.ts` | Initial read, Realtime subscription, resubscribe on reconnect |
| `src/features/live/VehicleMarker.tsx` | Route color, heading cone, occupancy halo, "Prototype data, unverified" badge when the row is unverified, stopped bubble, greyed style with age when Stale |
| `src/features/live/CoverageBanner.tsx` | Route coverage line; the No data wording is exactly "No data from riders right now" |
| `src/app/(tabs)/index.tsx` | Adds the marker layer, culling by the visible bounds, and a development-only counter of rendered markers |
| `src/app/dev-broadcast.tsx` | Dev-only screen: pick a seeded test vehicle, set seats taken, start and stop broadcasting the phone's GPS using the send rule |
| `scripts/simulate-vehicle.ts` | Signs in as a team account, walks the placeholder line at a chosen speed, sends packets by the send rule; options to stop for a set time and to go silent for a set time |
| `src/shared/__tests__/sendRule.test.ts`, `coverage.test.ts`, `occupancy.test.ts`, `stopped.test.ts`, `bounds.test.ts`, `simulator.test.ts` | Unit tests below |

Route color comes from the route row in SQLite. Marker time calculations use the server's clock offset, not the phone's clock.

**3. Dependencies.** S2 (map), S3 (route data and color), S4 (ingest, Realtime, sign-in), S1 (config, geometry).

**4. Tests per acceptance criterion**

| Acceptance criterion | Test name | Asserts | Kind |
| --- | --- | --- | --- |
| A simulated vehicle shows a marker | `S5-M1 simulated marker` | A marker appears on Route 4 and moves | manual device test |
| 100 s of silence becomes Stale | `coverage: 100 s old is Stale` | Age 89 s is Live, 100 s is Stale, 10 minutes and beyond is No data | unit test |
| Same, on the device | `S5-M2 silence becomes Stale` | The marker greys out and shows its age during the simulator's silent period | manual device test |
| A 60 s stop shows the bubble | `stopped: under threshold across 45 s shows bubble` | Packets under 2 km/h spanning 44 s give no bubble; spanning 45 s give the bubble; a faster packet clears it | unit test |
| Same, on the device | `S5-M3 stop shows bubble` | "Stopped: loading or traffic" appears during the simulator's 60 s stop | manual device test |
| No data shows "No data" | `coverage: empty route is No data` | With no rows, the route state is No data and the text is "No data from riders right now"; the words "no vehicles" appear nowhere in the app's strings | unit test |
| Same, on the device | `S5-M4 no data wording` | The banner shows the exact wording with no simulator running | manual device test |
| Markers outside the viewport are not rendered | `bounds: culls markers outside the viewport` | Of two markers, only the one inside the bounds is returned | unit test |
| Same, on the device | `S5-M5 culling counter` | With two simulated vehicles far apart, the development counter reads 1 when only one is in view and 2 when both are | manual device test |
| Occupancy by seats taken | `occupancy bands` | 0 and 6 are Green, 7 and 12 are Amber, 13 and 16 are Red, using the configured capacity and bands | unit test |
| Unverified badge | `badge shown when row is unverified` | An unverified row yields the badge text "Prototype data, unverified" | unit test |
| Send rule | `send rule: 100 m or 30 s` | 99 m and 29 s do not send; 100 m sends; 30 s sends | unit test |
| Simulator behavior | `simulator plan: stop and silence` | Given a speed, a 60 s stop and a 100 s silence, the generated schedule has stationary packets across the stop, no packets in the silent window, and otherwise follows the send rule | unit test |
| Dev broadcast | `S5-M6 dev broadcast` | With the flag on, a team phone or emulator broadcasting its GPS appears as a test vehicle on a second device or after reopening the map | manual device test |
| Dev screen hidden | `dev broadcast route is hidden without the flag` | With the flag off, the screen is not reachable from the UI | unit test |

**5. Manual test scripts**

Setup for all: emulator online, signed in with an allowlisted account, simulator env variables set.

`S5-M1 simulated marker`
1. Start the simulator at 20 km/h on the outbound line with test vehicle 1.
2. Open the Map tab and zoom to the western stops.
3. Expect a marker in the Route 4 color with a heading cone, a halo and the badge "Prototype data, unverified". Expect it to move.

`S5-M2 silence becomes Stale`
1. Start the simulator with the silent option (100 s).
2. Watch the marker when packets stop. Expect: Live until about 90 s, then greyed with its age. The coverage banner reads Stale.
3. Expect it to return to Live when packets resume.

`S5-M3 stop shows bubble`
1. Start the simulator with the stop option (60 s).
2. Expect "Stopped: loading or traffic" above the marker once the stopped packets span 45 s.
3. Expect the bubble to disappear after the vehicle moves again.

`S5-M4 no data wording`
1. Stop all simulators and wait 10 minutes, or clear the test rows from the dashboard.
2. Expect the banner to read "No data from riders right now". Confirm "no vehicles" is not shown anywhere.

`S5-M5 culling counter`
1. Start two simulators: vehicle 1 near the western stops, vehicle 2 near the De Oro end.
2. Zoom to the western stops. Expect the development counter to read 1.
3. Zoom out until both are in view. Expect 2. Pan so neither is in view. Expect 0.

`S5-M6 dev broadcast`
1. Build with the development flag on. Open the dev broadcast screen.
2. Choose test vehicle 2, set seats taken to 8, tap Start.
3. Play a GPX route in the emulator. On the Map tab, expect an Amber marker following the route.
4. Tap Stop. Expect the marker to go Stale after about 90 s.
5. Rebuild or relaunch with the flag off. Expect no way to reach the screen.

**6. Risks and open questions**

- The marker is drawn as a native view on the map so the badge and bubble need no font files. The exact component name in MapLibre React Native 11 is confirmed from its documentation at the start of S5. If view markers are too slow with many vehicles, the fallback is map layers with bundled font files.
- The PRD's 55 FPS target with 50 markers is not a v0 acceptance criterion and is not measured here.
- The stopped rule counts time between packets, so in a 60 s stop the bubble appears late in the stop. The simulator sends a final stationary packet at the end of the stop so the test is deterministic.
- Phone clocks can be wrong. Ages are computed against the server clock offset; if the offset cannot be fetched, ages fall back to the phone clock and may be off.
- Realtime can drop on poor networks; the client resubscribes and re-reads on reconnect.
- Waiting 10 minutes for No data is slow to test by hand; the unit test covers the boundary and the manual test confirms the wording.
- The dev broadcast uses foreground location only. It stops when the app is backgrounded. Background relay is out of scope.
- GPS accuracy gates are defined in config but, per the build guide, not applied in v0.

**7. Definition of done**

- [ ] All unit tests in the table pass
- [ ] `S5-M1` to `S5-M6` pass and are recorded
- [ ] The simulator can run, stop for 60 s and go silent for 100 s from command options
- [ ] The dev broadcast screen is unreachable with the flag off
- [ ] Every marker shows the unverified badge
- [ ] No rider identity, avatar or classification appears on the map or in any packet
- [ ] Type-check and lint clean
- [ ] S5 report written; Prototype v0 review

## 5. Test strategy

**Runner.** Jest with the `jest-expo` preset, in two projects:

| Project | Covers | Environment |
| --- | --- | --- |
| `shared` | `src/shared/**`, `supabase/functions/_shared/**`, `src/data/seed/**` | Plain Node. No React Native. This is the bulk of the tests. |
| `app` | Stores, repository mapping, anything that touches Expo modules (mocked) | `jest-expo` |

Integration tests in `tests/integration/` run in the Node project against the hosted Supabase project and are skipped, with a printed reason, when the test env variables are missing.

**Folders.** Unit tests sit in `__tests__` folders beside the code they test. Integration tests are in `tests/integration/`.

**Commands.**

| Command | Runs |
| --- | --- |
| `npm test` | All unit tests, and integration tests when configured |
| `npm test -- --selectProjects shared` | Pure logic only; fast |
| `npm run lint` | ESLint, including the `src/shared` import restriction |
| `npx tsc --noEmit` | Type-check |

All three (test, lint, type-check) must pass before any step is reported as done.

**Manual tests.** `docs/device-tests.md` holds one section per step. Each script has an id (for example `S2-M1`), numbered actions and the expected result. Each run adds a row to a results log: date, script id, device or emulator model, Android API level, build identifier, pass or fail, and notes. A failed run stays in the log. Checks that the PRD assigns to a physical phone are listed there as "pending on a phone" until one is used.

**Reporting.** After each step I report the exact commands run, the counts of passed and failed tests, and which manual scripts were run by whom. I do not report a manual test as passed unless it was actually run.

## 6. Config constants table

All in `src/shared/config/index.ts`. "Used in v0" says whether S0 to S5 read the value or only define it for later. Server-side values are mirrored in the `app_config` table.

| Constant | Default | Used in v0 | PRD section |
| --- | --- | --- | --- |
| `ENABLE_VERIFICATION` | `false` | Yes, in `verifyReport` only | 0.7 |
| `POSITION_SEND_DISTANCE_M` | 100 | Yes (simulator, dev broadcast) | 8.4 |
| `POSITION_SEND_INTERVAL_S` | 30 | Yes | 8.4 |
| `STATIONARY_SPEED_KMH` | 2 | Yes (app and server) | 7.3 |
| `STATIONARY_DURATION_S` | 45 | Yes | 7.3 |
| `LIVENESS_TIMEOUT_S` | 90 | Defined; same value as the Live threshold | 8.4 |
| `COVERAGE_LIVE_MAX_AGE_S` | 90 | Yes | 7.3 |
| `COVERAGE_STALE_MAX_AGE_S` | 600 | Yes | 7.3 |
| `OFFLINE_BUFFER_SIZE` | 60 | Defined only | 8.4 |
| `VEHICLE_CAPACITY_SEATS` | 16 | Yes (app and server) | 7.3 |
| `OCCUPANCY_GREEN_MAX_TAKEN` | 6 | Yes | 7.3 |
| `OCCUPANCY_AMBER_MAX_TAKEN` | 12 | Yes | 7.3 |
| `FARE_BASE_PHP` | 15.00 | Yes, as the seed default for the route row | 12.4 |
| `FARE_BASE_KM` | 4.0 | Yes, as the seed default | 12.4 |
| `FARE_PER_KM_PHP` | 2.00 | Yes, as the seed default | 12.4 |
| `FARE_DISCOUNT_MULTIPLIER` | 0.8 | Yes | 12.4 |
| `FARE_DISCOUNTED_CLASSES` | Student, Senior Citizen, PWD | Yes | 7.1 |
| `FARE_ROUNDING_STEP_PHP` | 0.25 (assumed) | Yes | 7.2 |
| `MAX_WALK_PER_LEG_M` | 500 | Yes | 7.2 |
| `ROUTE_SNAP_DISTANCE_M` | 30 | Defined only | 10.2 |
| `MIN_DISPLACEMENT_M` | 50 | Defined only | 10.2 |
| `GPS_ACCURACY_GATE_RELAY_M` | 30 | Defined only | 8.4 |
| `GPS_ACCURACY_GATE_CHECKIN_M` | 25 | Defined only | 7.5 |
| `CHECKIN_RADIUS_M` | 60 | Defined only | 7.5 |
| `NIGHT_MODE_START` / `NIGHT_MODE_END` / `NIGHT_MODE_TZ` | 21:00 / 04:59 / Asia/Manila | Setting only | 10.4 |
| `RSSI_SMOOTHING_ALPHA` | 0.3 | Yes (function and test only) | 12.4 |
| `RSSI_PRESENCE_THRESHOLD_DBM` | -65 | Defined only | 10.1 |
| `SMS_MAX_AGE_MIN` | 30 | Yes (parser and test only) | 12.3 |
| `SMS_SEQ_MODULUS` | 10000 | Yes (parser and test only) | 12.3 |
| `SMS_SEQ_NEWER_WINDOW` | 5000 (proposed, question 11) | Yes (parser and test only) | 12.3 |
| `SMS_STALE_HEATMAP_MIN` | 15 | Defined only | 12.3 |
| `ROUTING_P95_BUDGET_MS` | 250 | Yes (benchmark) | 3.3 |
| `LIVE_UI_REFRESH_INTERVAL_S` | 5 (proposed) | Yes | not in PRD |
| `PACKET_MAX_AGE_S` / `PACKET_MAX_FUTURE_S` | to be decided (question 13) | Yes (ingest) | not in PRD |
| `DEV_BROADCAST_ENABLED` | from env, default off | Yes | 0.7 |

Fare values are stored per route in SQLite (PRD 12.1); the three fare constants are only the defaults the seed writes, so there is still one source for each number.

## 7. Risks

| # | Risk | Effect | Mitigation |
| --- | --- | --- | --- |
| 1 | Slow npm registry and first Gradle build | S0 may take hours | One install, never interrupted, never doubled; SDK components installed through Android Studio beforehand |
| 2 | Java 25 on PATH, `JAVA_HOME` unset | Gradle build fails | Point `JAVA_HOME` at Android Studio's JBR before S0 |
| 3 | MapLibre React Native 11 untested on React Native 0.86 in this project | S0 or S2 build failure | Build proven in S0 before any map code; stop and report on failure |
| 4 | Local tile format support unknown | S2 blocked | Format test is the first task of S2 |
| 5 | No approved source for placeholder tiles | S2 blocked | Open question 7 |
| 6 | PRD schema cannot hold two directions as written | S3 blocked | Open question 4 |
| 7 | Boarding rule undefined | S3 planner and UI could be built wrong | Open question 5 |
| 8 | No Supabase project or tooling | S4 blocked | Open questions 2 and 3 |
| 9 | Sign-in method in the PRD cannot be automated | S4 tests and S5 simulator blocked | Open question 1 |
| 10 | Verification off | Anyone allowlisted can publish a fake marker | Private build, allowlist, badge on every marker |
| 11 | Emulator results do not prove phone behavior | Targets may fail on real low-end phones | Record every result with its device; keep phone checks listed as pending |
| 12 | Placeholder data is geometrically wrong | Walk distances, route snap and fares are not realistic | All placeholders in one seed file behind `route_data_version`; UI labels the fare an estimate |
| 13 | Expo SDK 57 APIs differ from older knowledge | Wrong API use | Versioned docs are read before each step, as `AGENTS.md` requires; type-check after every change |
| 14 | Node 25 is not an LTS release | Tooling surprises | Inside Expo's supported range; switch to Node 24 if a tool fails |
| 15 | Not a git repository | No history, no rollback | `git init` in S0 if approved |

## 8. Open questions for the user (numbered, each says what it blocks)

Questions 1 to 12 are the same as `docs/AUDIT.md` section 9; they are repeated here in short form so this plan stands alone.

1. **Sign-in for v0:** approve email and password team accounts, with Google and magic link deferred? *Blocks S4, S5.*
2. **Supabase project:** does one exist, and who creates the team accounts and allowlist? *Blocks S4.*
3. **Applying migrations and the function:** Supabase CLI as a dev dependency (recommended), or pasted by hand in the dashboard? *Blocks S4 and the install command.*
4. **Two directions for Route 4:** add `route_code` and `direction` columns (recommended), or encode the direction in `route_id`? *Blocks S3.*
5. **Boarding rule:** only at listed stops, or anywhere along the line? *Blocks S3.*
6. **Is `DEO` a selectable stop?** Recommended yes, as a placeholder. *Blocks S3 seed data.*
7. **Placeholder map tiles:** who supplies them, which format, and may the first set have no text labels? *Blocks S2.*
8. **App name and Android package id:** confirm `Tunton APP` and `com.tunton.app`, or give replacements. *Blocks S0.*
9. **Housekeeping:** `git init`; remove the old plan, the agent prompt and the two stub screens; amend `AGENTS.md` to Android only? *Blocks nothing.*
10. **Phone availability:** is a 3 GB Android phone available for the S3 benchmark and later checks? *Blocks only the final benchmark figure.*
11. **SMS sequence wrap-around window:** accept "1 to 5,000 ahead, modulo 10,000"? *Blocks one S1 test.*
12. **Folder name:** `Capstoneerr` in the prompt versus `Capstoneerrr` on disk; assumed the same. *Blocks nothing.*
13. **Packet timestamp limits:** how old and how far in the future may a telemetry packet's timestamp be before the ingest function rejects it? The PRD gives no value. *Blocks one S4 validation rule.*
14. **Writer audit trail:** do you want a server-only log of which account sent each packet? It is useful for debugging fake markers but stores a link between an account and a location. *Blocks nothing; changes the S4 migration.*
15. **Tab layout:** approve three tabs (Map, Plan, Profile) and the removal of Routes and CrowdFeed? *Blocks S0.*

## 9. What is explicitly not built in v0

- Anything for iOS.
- Any route other than Route 4, and the multi-route transfer graph.
- BLE advertising, BLE scanning, beacon codes, boarding detection and the boarding prompt.
- The verification window, route snap, displacement check, activity recognition, mock-location rejection and Play Integrity. Only the `verifyReport` and `deviceIntegrity` hooks exist.
- The relay baton (Primary and Secondary), background location, the foreground service and the offline telemetry buffer logic. The `telemetry_buffer` table exists but is unused.
- Station check-in, the SMS worker, the gateway app, the driver app and its heatmap. Only the SMS parser and signer exist, as tested pure functions.
- Energy, Trust Points, Merit shields, flags, strikes and appeals.
- ETA, the community feed, avatars, the onboarding flow and the admin console.
- Night Mode's static view. Only the window setting exists.
- Detour detection and alternative polylines. The `route_alternatives` table exists but is empty.
- Route data sync over the network. Data changes by replacing the seed file and bumping the version.
- Cebuano strings, Play Store submission and release signing.
- A monorepo restructure.
- Firebase, Expo Go support, Google Maps.
