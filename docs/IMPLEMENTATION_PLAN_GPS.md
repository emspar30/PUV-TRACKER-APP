# Implementation plan: GPS and location features (UX2, G0 to G4)

- **Date:** 2026-10-03.
- **Builds on:** `docs/AUDIT_2.md` (commit `0796803`).
- **Source of truth:** `docs/PRD.md` v2.0. Where this plan and the PRD disagree, the PRD wins until you approve a change (`AUDIT_2.md` section 13).
- **Status:** proposal. No code is written until you approve it. Each step ends with tests, a short report and a stop for approval, as before.

## Decisions after Audit 2 (2026-10-03)

Emjay approved this plan and `docs/AUDIT_2.md` with the answers below. **Where they differ from the sections that follow, these decisions win.** The sections have been updated where noted.

**Order (approved).**
- UX2, G0, then S4 Part 2 (after "Supabase is ready"), then R1, G1, S5, G2, G3, G4.
- S4 Part 2 does not start until Emjay writes "Supabase is ready".
- R1 does not start until Emjay writes "start R1". Emjay runs it.
- No package from the R1 list is installed before then.

| # | Question | Decision |
| --- | --- | --- |
| 1 | UX2 design source | Emjay's UX2 specification and `docs/DESIGN.md` (now in the repository). See plan v2, Revision 2. Profile and settings move behind an **avatar button** at the top right of each tab, which opens a Settings sheet. They do not move into My Ride. My Ride is route discovery. |
| 2 | `expo-system-ui` | **Yes, in R1.** Until then the system bars may not follow the theme; the theme is built in JavaScript. |
| 3 | Check-in, cloud or local | **Cloud table.** UX2 builds the Check-in tab with a local 15-minute countdown (from a stored `expires_at`) and a `verifyCheckIn()` hook returning `unverified` with `verification_disabled`. G1 adds the cloud table, the geofence and the reminder. Offline check-in is not possible, and the screen says so briefly. |
| 4 | `app_config` | **Yes, in S4 Part 2**, with the Night Mode window 21:00 to 04:59 Asia/Manila as a server-side setting. |
| 5 | `pg_cron` | **Yes**, but the exact command is shown and Emjay's approval awaited before anything runs on the live project. |
| 6 | Activity recognition | **Skipped for now. Removed from R1.** A speed-only motion rule sits behind an interface (`getActivity()` returns `unknown`), so a real module can be added later. The in-vehicle check-in refusal is marked "needs a phone". |
| 7 | Night Mode suppression | Moving markers hidden from 21:00 to 04:59 by **server time**, from S5 on. |
| 8 | Who may check in | **Allowlisted team accounts only.** The waiting count is shown on the Check-in tab to those accounts. |
| 9 | Consent wording | A short English draft for later data-protection review. Not final. |
| 10 | `telemetry_raw` | **Kept**, with PRD retention (7 days by day, 24 hours at night), readable only by the service role. |
| 11 | Mock-location counter | Sent in the **session keepalive**. The packet keeps the PRD's seven fields. |
| 12 | Real polylines | Not yet. The import script waits for "go". |
| 13 | Live view audience | **Signed-in team accounts only** in v0. |
| 14 | 2026-10-02 11:48 PM rebuild | Recorded as "accepted afterwards". From now on, the agent asks before any native build. |
| 15 | `braces` advisory | Recorded as deferred in `docs/AUDIT.md` section 11.1. |
| 16 | Fare tab (later the same day) | **Removed at Emjay's request.** Three tabs: Live, Check-in, My Ride. The fare is part of My Ride: big number with a peso icon, distance chip, "Estimate", a quick fare-type chip that writes the same stored classification as Settings, and a "Details" breakdown. The existing fare engine and its tests are reused; no second calculator. |

**What changed in this plan because of these decisions**
- **R1:** the activity recognition module and `ACTIVITY_RECOGNITION` are removed, and `expo-system-ui` is confirmed. R2 is now needed only if G4 shows that background location is required, or a phone test finds a native problem.
- **UX2:** rewritten to match Revision 2 of plan v2. Three tabs: Live, Check-in, My Ride (the Fare tab was removed, decision 16). Settings sheet behind the avatar button. A local check-in in the Check-in tab. The fare lives in My Ride.
- **G1:** cloud table, team accounts only, waiting count for team accounts. The in-vehicle rule uses `getActivity()`, which returns `unknown` until a module exists, so it never refuses on the emulator (needs a phone).
- **G2:** `telemetry_raw` is confirmed, service role only. The mock counter goes in the keepalive.
- **G3:** the motion test is speed-only (25 km/h for 20 s) until an activity module exists; the 60% `IN_VEHICLE` share stays behind the interface.
- **S5:** Night Mode suppression by server time; team-only reads.
- **Questions:** section 11's questions are answered above. The new ones are at the end of section 11.

## 1. Approach and assumptions

**Approach**

1. **Same rules as plan v2.**
   - Pure logic in `src/shared/` with tests in plain Node.
   - Every threshold in `src/shared/config/` (server values in `supabase/functions/_shared/serverConfig.ts`).
   - Route facts only in the seed file.
   - One local commit per approved step, never pushed.
   - Android only.
2. **One location source.**
   - Every fix enters the app through one store (`src/state/locationStore.ts`), fed by `expo-location` `watchPositionAsync`.
   - The blue dot, "use my location", check-in and broadcasting all read from it.
   - In development builds a **fake location source** can replace it, replaying a fixture with chosen accuracy, speed and mock flag. This lets accuracy gates and mock handling be tested on the emulator, whose `geo fix` cannot set accuracy or the mock flag.
3. **Rules on both sides.**
   - Each acceptance rule is a pure function, tested in Node.
   - Where the PRD makes the server the authority (check-in expiry, Primary assignment, Night Mode, verification), the same function runs in the Edge Function, under `supabase/functions/_shared/`.
4. **Emulator first, phone flagged.**
   - Every criterion is labelled **Emulator** or **Phone** (section 5).
   - Phone criteria stay "pending on a phone" in `docs/device-tests.md` until one is used.
5. **Few native rebuilds.**
   - Every permission, plugin and native package is batched into one rebuild, **R1** (section 3).
   - You run native builds yourself.
6. **Consent before permission.** No runtime permission prompt appears before the consent screen of G0 (PRD 7.1, 15.1).

**Assumptions** (each one that needs your answer is in section 11)

- Verified against the Expo SDK 57 docs (read 2026-10-03):
  - `expo-location` gives `coords.accuracy`, `coords.speed` (m/s), `coords.heading` and an Android `mocked` flag.
  - Its plugin option `isAndroidForegroundServiceEnabled` adds `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION`.
  - Background updates use `startLocationUpdatesAsync` with a task defined through `expo-task-manager`, which is required.
- Unverified: whether a location foreground service started while the app is open needs `ACCESS_BACKGROUND_LOCATION`, which is blocked in `app.json` today. Checked at the start of G4 (risk 4).
- No Expo module provides activity recognition (`IN_VEHICLE`). It needs a native module (question 6).
- Route 4 placeholder lines cut across blocks, so the 30 m route snap will fail on a real ride (PRD 12.5). G3 can pass on the emulator with GPX built from the placeholder line. A real ride needs the real polylines.
- The UX redesign prompt and `docs/DESIGN.md` are not available (`AUDIT_2.md` section 6). UX2 below is built from your summary: four tabs, light-first, Material 3 transit look, little text. (Superseded: see decisions 1 and 16. There are three tabs.)

## 2. Order, dependencies, and how S4 Part 2 and S5 fit

| # | Step | Needs first | Native rebuild? | Effort |
| --- | --- | --- | --- | --- |
| 1 | **UX2** redesign: three tabs, light-first theme, Light and Dark switch | Your approval and the design source (question 1) | No (see R1 for system bars) | Large |
| 2 | **G0** location foundation: consent, permission, reduced mode, blue dot, "use my location", accuracy gate | UX2 tab skeleton | **No**: fine location is already declared in `app.json` | Medium |
| 3 | **S4 Part 2** live backend, as planned, plus `app_config` | "Supabase is ready" | No | Small to medium |
| 4 | **R1** native rebuild (you run it) | Packages for G1 to G4 approved and installed | **Yes** | Small (yours) |
| 5 | **G1** station check-in | S4 Part 2, G0; R1 for the reminder notification | No beyond R1 | Medium to large |
| 6 | **S5** live map from the simulator | S4 Part 2, UX2 (Live tab) | No | Large |
| 7 | **G2** live tracker from phones: dev broadcast, send rule, buffer, liveness, baton | S5, G0; R1 for battery and network | No beyond R1 | Large |
| 8 | **G3** verification, mock rejection, integrity hook, Night Mode stage 1 | G2; R1 for activity recognition | No beyond R1 | Large |
| 9 | **G4** background reliability: foreground service, vendor guide, idle stop, hard cap | G2; R1 | No beyond R1 | Medium, mostly phone testing |

**Why UX2 first**
- The Live tab (compass icon) is where S5 and G2 land.
- The Check-in tab (pin icon) is where G1 lands.
- Building those features on the old Map, Plan and Profile tabs would mean moving them twice.

**What in UX2 can wait**
- Only polish can wait: animation, final illustration, and the map style tuning for dark mode.
- The three-tab skeleton, the theme tokens with both palettes, the theme switch, and moving the existing screens into the new tabs must come first.

**Where S4 Part 2 fits**
- It runs whenever you write "Supabase is ready", in parallel with UX2 and G0.
- It must finish before G1 and S5, which both use the live project.
- **What changes now:**
  - Add `app_config`, with the Night Mode window and server constants readable by clients (question 4).
  - Ask before enabling `pg_cron` (question 5).
  - Otherwise unchanged: the commands in `docs/BACKEND_SETUP.md`, a dry run first, and permission asked before each live change.

**Where S5 fits**
- After S4 Part 2 and UX2.
- Its acceptance criteria stay as in plan v2, fed by the simulator script.
- **What changes now that real GPS is possible:**
  1. The dev broadcast screen (`S5-M6`), deferred by Revision 1, moves into G2. There it uses emulator GPS from `adb emu geo fix` and GPX playback.
  2. Live coordinates can now be produced at night, so the minimal Night Mode suppression rule is brought forward. Until G3 builds the static node view, the server hides moving markers during the window (question 7).
  3. Markers render in the Live tab, not the old Map tab.

## 3. Native rebuild plan (batched)

Changing `app.json` permissions or plugins, or adding a package with native code, needs a new APK. Everything known now is collected into **one rebuild, R1**. You run it in your own terminal, as on 2026-10-02: `npx expo run:android`, or Gradle directly, with JDK 17 and the IPv6 setting.

**R1 contents.** Every package is to be approved by you first; none is installed yet.

| Item | For step | Change | Source |
| --- | --- | --- | --- |
| Placeholder launcher icon and splash in theme colours | UX1 carry-over | `assets/` images; `app.json` `icon`, `android.adaptiveIcon`, splash config | UX1 prompt |
| `expo-system-ui` | UX2 | Lets `userInterfaceStyle` take effect on Android, so system bars and the window follow light or dark | Expo SDK 57 app config reference. **Approved for R1** (decision 2). |
| `expo-notifications` | G1 | Local "Have you boarded yet?" reminder at 5 minutes. `POST_NOTIFICATIONS` is already declared. | PRD 7.5 |
| ~~Activity recognition module and `ACTIVITY_RECOGNITION`~~ | — | **Removed from R1** (decision 6). `getActivity()` returns `unknown`; the motion rule is speed-only until a module is added in a later rebuild. | PRD 7.5, 10.2 |
| `expo-battery` | G2 | Primary eligibility: battery at 30% or more, not in battery saver | PRD 8.3 |
| `expo-network` | G2 | Detect reconnect to flush the offline buffer | PRD 8.4 |
| `expo-task-manager` | G4 | Required by `startLocationUpdatesAsync` | Expo SDK 57 location docs |
| `expo-location` plugin: `isAndroidForegroundServiceEnabled: true`, `androidForegroundServiceIcon` | G4 | Adds `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION`; Android 14 location service type | PRD 8.5 |
| `expo-intent-launcher` | G4 | Open the battery-optimisation settings page from the vendor guide | PRD 8.5 |
| Background location | G4 | **Not added.** `ACCESS_BACKGROUND_LOCATION` stays blocked unless the G4 check shows the foreground service needs it (risk 4). If it does, that is **R2**. | PRD 4.2 |

**Timing**
- R1 is built once, after UX2 and G0 are approved and the packages above are installed with `npx expo install`.
- G0 does not need it: it runs on today's APK.

**R2**
- Only if G4 shows that background location is needed, a phone test finds a native problem, or a real activity-recognition module is added later.
- Marked as "only if needed".

**Not needed by any step:** iOS anything, Google Maps, Firebase, Expo Go.

## 4. Steps

Each step uses the same seven parts: goal; files; dependencies; tests per acceptance criterion; manual test script; risks and open questions; definition of done. "E" is Emulator, "P" is Phone.

### UX2: three-tab, light-first redesign

The full direction is plan v2, Revision 2, and Emjay's UX2 specification. This section is the step template.

**1. Goal.**
- Three bottom tabs, a light-first theme with a Light and Dark switch, a Settings sheet behind an avatar button, and the text budget.
- The existing routing, snapping and fare logic is unchanged.

| Tab | Icon | Holds in UX2 | Gains later |
| --- | --- | --- | --- |
| Live | `Compass` | Full-screen map, route line in the theme route colour, floating status pill ("No data" for now), "Show whole route", "Sample data" chip. Vehicle layer ready but empty. | Blue dot and locate-me (G0), vehicles and coverage (S5, G2) |
| Check-in | `MapPin` | Route chip (R4), station chips, one "Check in" button. Local 15-minute countdown from a stored `expires_at`, with "I boarded" and "Cancel". "Not location-verified" pill. `verifyCheckIn()` hook. | Cloud table, geofence, reminder, team-only waiting count (G1) |
| My Ride | `Route` | Origin and destination pills with swap; a result card with the route badge, "Board near", "Get off near", the walks as small numbers, the **fare as the big number** with a peso icon, a distance chip, "Estimate", a quick fare-type chip, a "Details" breakdown and "View on map"; short failures with "Move pin to the route"; "All routes" list | "Use my location" (G0) |

**Settings sheet** (avatar button, top right of every tab)
- Rows: Fare type (four chips), Theme (Light or Dark), Avatar (12 presets), About, Replay intro.
- The team account card moves here too, below the rows, unchanged: it is needed for S4 Part 2 sign-in.

**2. Files**
- Theme:
  - `src/theme/tokens.ts` (new): the light and dark palettes, with the same semantic names.
  - `src/theme/ThemeProvider.tsx` (new): context and hook; reads the stored choice.
  - `src/theme/index.ts`: spacing, radii, type scale, elevation, route colours by route code.
- `src/state/settingsStore.ts` (new): the theme choice, on the device.
- `src/data/map/offlineStyle.ts`: light and dark styles from the tokens.
- `src/shared/ui/contrast.ts` (existing).
- `src/shared/checkin/localCheckin.ts` (new, pure): lifecycle from a stored `expires_at`.
- `src/shared/verification/verifyCheckIn.ts` (new): the hook.
- `src/state/checkinStore.ts` (new): the local check-in, on the device.
- Components: `src/components/` gains Pill, Chip, StatusPill, LineBadge, Sheet, BigNumber, Details and AvatarButton.
- Tabs and screens:
  - `src/app/(tabs)/_layout.tsx`.
  - `index.tsx` (Live), `checkin.tsx`, `ride.tsx` (My Ride, with the fare).
  - The old `plan.tsx` and `profile.tsx` are removed after their parts move.
  - `src/app/settings.tsx` (sheet), `src/app/onboarding.tsx` (one screen), `src/app/about.tsx`.
- Strings: `src/strings/en.ts`, shortened to the text budget.
- Tests:
  - `contrast.test.ts`: every pair, both themes.
  - `localCheckin.test.ts`.
  - The existing `planGuidance.test.ts` and `fare.test.ts`, which stay on fixed fixtures.

**3. Dependencies**
- Emjay's approval (given) and `docs/DESIGN.md`.
- No new package and no rebuild. The system bars follow the theme only after R1.

**4. Tests**

| Criterion | Test | Kind | E/P |
| --- | --- | --- | --- |
| Every text and background pair passes WCAG AA, both themes | `contrast: every pair passes 4.5:1 (text) or 3:1 (large text, graphics)` | unit | — |
| Light route colour readable | `route colour: line at least 3:1 on light land, badge text at least 4.5:1` | unit | — |
| Check-in lasts 15 minutes and survives a restart | `local check-in: countdown from expires_at; cancel; expired after a long time away` | unit | — |
| Naming, failure reasons, fare breakdown (6.3 km: ₱21.00 regular; ₱16.80 then ₱16.75 student) | existing tests on fixtures | unit | — |
| No text on the map, no remote source, both styles | `offlineMap.test.ts`, extended | unit | — |
| Exactly three tabs, in order | `tab list has Live, Check-in, My Ride and nothing else` | unit | — |
| The quick fare-type chip and Settings share one stored classification | `fare-type chip and Settings read and write the same stored value` | unit | — |
| Three tabs, sheet, theme switch | `UX2-M1`, `UX2-M2` | manual | E |
| Large text does not clip | `UX2-M3` at font scale 1.3 | manual | E |

**5. Manual test script**
- `UX2-M1`:
  1. Open the app.
  2. Expect tabs Live, Check-in, My Ride, and no Fare tab.
  3. Tap the avatar button; expect the sheet with five rows.
- `UX2-M2`:
  1. In Settings, switch to Dark, then Light.
  2. Expect every screen and the map to follow.
  3. Force-stop and reopen; expect the choice kept.
- `UX2-M3`: `adb shell settings put system font_scale 1.3`, visit each tab, then set it back to 1.0.
- Per-tab scripts are added to `docs/device-tests.md` with parts 3 to 5.

**6. Risks and open questions**
- System bars do not follow the theme until R1.
- Dragging the sheet depends on the installed gesture libraries working with MapLibre; tap to expand is the fallback.

**7. Definition of done**
- [ ] Five local commits as listed in Emjay's UX2 message.
- [ ] Stop after part 2 for review.
- [ ] Contrast test passes in both themes.
- [ ] `UX2-M1` to `M3` pass on the emulator.
- [ ] `AUDIT_BACKLOG.md` updated.
- [ ] Tests, lint and type-check clean.

### G0: location foundation

**1. Goal.**
- The user gives informed consent, then may grant foreground location.
- With it, a blue dot shows their position and "use my location" sets the trip origin.
- Without it, the app works in reduced mode with manual pins.
- Fixes worse than the accuracy gate are ignored for every feature that needs precision.

**2. Files**
- `src/shared/location/consent.ts` (new, pure): states `none`, `consented`, `withdrawn`; it may request permission only after `consented`.
- `src/shared/location/accuracyGate.ts` (new, pure):
  - `acceptFix(fix, gateM)` returns accepted or a reason (`poor_accuracy`, `mocked`, `stale`).
  - Gates come from config: 30 m for relay, 25 m for check-in.
  - The blue dot shows every fix, with its accuracy ring.
- `src/shared/config/index.ts`:
  - `LOCATION_WATCH_INTERVAL_MS`.
  - `LOCATION_WATCH_DISTANCE_M`.
  - `LOCATION_FIX_MAX_AGE_S`.
- `src/state/locationStore.ts` (new): consent, permission status, latest fix, watch start and stop.
- `src/services/locationSource.ts` (new):
  - The `expo-location` source.
  - A fake source in development builds only (`__DEV__`).
- `src/app/consent.tsx` (new): privacy notice and explicit consent, separate from the introduction. It says what is collected, why, that nothing is sent in this step, and how to withdraw.
- `src/features/map/BlueDot.tsx` (new): dot and accuracy ring, drawn from the store as a map layer. MapLibre's own user-location component is checked first; the store is kept as the single source either way.
- `src/features/plan/PointPicker.tsx`: "Use my location" button.
- `src/app/(tabs)/index.tsx`: "Locate me" button.
- My Ride: a "Location" row with consent state, permission state and withdraw.
- Tests: `src/shared/__tests__/location.test.ts`.
- Docs: `docs/device-tests.md` gets `G0-M1` to `M5` (they replace the deferred `S2-M2` and `S2-M4`).

**3. Dependencies.** UX2. No new package. No rebuild: `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` are already in `app.json`.

**4. Tests**

| Criterion (PRD) | Test | Kind | E/P |
| --- | --- | --- | --- |
| Consent before any permission request (7.1, 15.1) | `consent: no permission request before consent; none after withdrawal` | unit | — |
| Explainer before the system prompt (4.2) | `G0-M1`: first tap on "Locate me" shows consent, then the explainer, then the system prompt | manual | E |
| Denied permission gives reduced mode (4.2) | `location store: denied keeps manual pins and no fix`; `G0-M2` | unit, manual | E |
| Relay gate 30 m (8.4) | `accuracy gate: 30.0 m accepted, 30.1 m rejected for relay` | unit | — |
| Check-in gate 25 m (7.5) | `accuracy gate: 25.0 m accepted, 25.1 m rejected for check-in` | unit | — |
| Mock fixes flagged (10.3) | `accuracy gate: a fix with mocked true is rejected with reason mocked` | unit | — |
| Dot follows simulated GPS (old `S2-M2`) | `G0-M3`: `adb emu geo fix 125.541426 8.947459` (longitude first) puts the dot at RCA; GPX playback of the outbound line moves it | manual | E |
| Dot works offline (2.4, 6.2) | `G0-M4`: airplane mode on, GPX playing | manual | E |
| "Use my location" as origin (7.2 step 1) | `G0-M5`: with a fix at TSO, the origin reads "Near TSO ..." and a trip plans | manual | E |
| Real accuracy and passive GPS behaviour | `G0-P1` | manual | **P** |

**5. Manual test script**
- `G0-M1`:
  1. `adb shell pm clear com.tunton.app`, then open the app and finish the introduction.
  2. On Live, tap "Locate me". Expect the consent screen.
  3. Accept. Expect the explainer, then the system prompt.
  4. Allow "while using the app".
  5. Expect the dot.
- `G0-M2`: as above, but deny. Expect a short notice that location is off. Expect My Ride to still take pins, and "Use my location" to be disabled with the reason.
- `G0-M3`:
  1. In Extended controls, Location, load `docs/gpx/r4-outbound.gpx` (generated from the seed by a test helper) and press play.
  2. Expect the dot to move along the line.
- `G0-M4`: repeat `G0-M3` in airplane mode.
- `G0-M5`:
  1. Run `adb emu geo fix 125.533083 8.946096`.
  2. On Fare, tap "Use my location".
  3. Expect "Near TSO" and a trip once a destination is set.
- `G0-P1` (phone): stand in the open, then under a roof. Record the accuracy shown and whether the dot is stable.

**6. Risks and open questions**
- Emulator fixes are not flagged as mock and have a fixed accuracy (assumed, **unverified**). The fake source covers accuracy and mock cases on the emulator.
- The consent wording needs DPO review before any pilot (PRD 15.1). Cebuano comes later.
- Minors (PRD 15.1): the consent flow does not handle parental consent (question 9).

**7. Definition of done**
- [ ] No permission prompt without consent (unit test and `G0-M1`).
- [ ] `G0-M1` to `M5` pass on the emulator.
- [ ] `G0-P1` listed as pending on a phone.
- [ ] No fix is stored or sent.
- [ ] Commit `G0: consent, location permission and blue dot`.

### G1: station check-in

**1. Goal.**
- At a station, a signed-in user picks Route 4 and checks in.
- The check-in is refused outside the station's radius (default 60 m), with accuracy worse than 25 m, while another check-in is active, or when the phone reports `IN_VEHICLE`.
- It expires after 15 minutes, with a reminder at 5.
- Counts include only unexpired rows, even before cleanup.

**2. Files**
- `src/shared/checkin/rules.ts` (new, pure), also used by the function through `supabase/functions/_shared/checkinRules.ts`:
  - `canCheckIn({ fix, station, active, activity, nowS })` returns `ok` or one of `outside_radius`, `poor_accuracy`, `already_active`, `in_vehicle`, `stale_fix`.
  - `lifecycle(createdAtS)` returns `{ reminderAtS, expiresAtS }`.
- `supabase/functions/_shared/serverConfig.ts`:
  - `CHECKIN_LIFETIME_S = 900`.
  - `CHECKIN_REMINDER_S = 300`.
  - Radius and accuracy gate move here from the app config, which re-exports them.
- `supabase/migrations/<ts>_checkins.sql`:
  - `stations` (cloud copy, generated from the seed file by a script, so the seed stays the one source).
  - `checkins`.
  - `checkin_counts` function.
  - Cleanup job.
  - Row-level security and grants (section 7).
- `supabase/functions/checkin/index.ts` (new):
  - Create, cancel and read own.
  - Re-checks the distance and the accuracy against the server's station row.
  - Never stores the coordinates it was sent.
- `scripts/export-stations-sql.ts` (new): writes the `stations` seed SQL from `r4.placeholder.ts`.
- `src/services/checkin.ts` (new).
- `src/state/checkinStore.ts` (new): the user's active check-in.
- `src/app/(tabs)/checkin.tsx`: station list sorted by distance; button; reasons as short icon and text pairs; countdown; cancel; "I boarded".
- `src/features/checkin/useBoardingReminder.ts` (new): an `expo-notifications` local notification after R1. Before R1, an in-app banner.
- `src/services/activity.ts` (new): `getActivity()`.
  - Returns `in_vehicle`, `still`, `on_foot` or `unknown`.
  - With no activity module (decision 6) it always returns `unknown`, so the in-vehicle refusal never fires. It is marked "needs a phone".
- Builds on the UX2 local check-in: the stored `expires_at` and the `verifyCheckIn()` hook stay. G1 moves the record to the cloud and the hook checks the geofence and accuracy.
- Team accounts only (decision 8): the function returns 403 for an account not on `telemetry_writers` (or a separate check-in allowlist, if Emjay prefers). The waiting count is shown only to those accounts.
- `tests/integration/checkin.test.ts` (new).

**3. Dependencies.**
- G0 (fix and accuracy), S4 Part 2 (live project).
- R1 for the notification.
- `pg_cron`, with the command shown and approved first (decision 5).
- Cloud table (decision 3).

**4. Tests**

| Criterion (PRD) | Test | Kind | E/P |
| --- | --- | --- | --- |
| Refused outside the radius (7.5, 0.2 S1) | `check-in at JCA for RCA (61 m) is refused at 60 m; at 59 m it passes` | unit | — |
| Per-station radius override (7.5) | `a station with geofence 120 m accepts a fix 100 m away` | unit | — |
| Refused with accuracy worse than 25 m (7.5, 0.2 S9) | `25.0 m passes, 25.1 m refused (poor_accuracy)` | unit, and fake source on E | E |
| One active check-in per user (7.5) | `second check-in while one is unexpired is refused`; integration: a second create returns `already_active` | unit, integration | — |
| Refused when `IN_VEHICLE` (7.5) | `activity in_vehicle refuses; unknown does not` | unit | — |
| Same, for real | `G1-P1` | manual | **P** (activity recognition) |
| 15-minute lifetime, reminder at 5 (7.5) | `lifecycle: reminder at +300 s, expiry at +900 s` (fake clock) | unit | — |
| Reminder shows | `G1-M3`: with the lifetime overridden in a dev build, the notification (after R1) or banner appears | manual | E |
| Counts exclude expired rows before cleanup (7.5, 0.2 S4) | integration: a row inserted with `expires_at` in the past (through the service role in the test) is not counted, and the cleanup job has not run yet | integration | — |
| Cleanup every minute (6.3) | integration: after the job runs, the expired row is gone (or a manual `select cron.run...` in the dashboard) | integration | — |
| Server re-checks the geofence | integration: a create with a fix 200 m away is refused by the function even if the app allowed it | integration | — |
| Auto-cancel on boarding (7.5) | `starting a broadcast on the same route cancels the check-in` (G2) and the "I boarded" button | unit, manual | E |
| Coordinates not stored | `migration: checkins has no lat, lon or geom column`; `function stores only station, route and times` | unit | — |

**5. Manual test script**
- `G1-M1`:
  1. Signed in, run `adb emu geo fix 125.541426 8.947459` (RCA).
  2. On Check-in, choose RCA and Route 4, then tap Check in.
  3. Expect a countdown from 15:00.
- `G1-M2`:
  1. Run `adb emu geo fix 125.541979 8.947506` (JCA, 61 m from RCA).
  2. Try RCA.
  3. Expect "Outside the station".
- `G1-M3`: in a dev build with `CHECKIN_REMINDER_S` overridden by the dev panel, expect the reminder.
- `G1-M4`: check in, then try again. Expect "Already checked in". Cancel, then expect the count to drop.
- `G1-P1` (phone): ride a vehicle and try to check in. Expect "In a vehicle".
- `G1-P2` (phone): real accuracy at two terminals, open sky and covered (PRD 17 E3).

**6. Risks and open questions**
- No heatmap or SMS consumes the counts yet (out of scope). They are shown as a "waiting here" number on the Check-in tab, to team accounts only (decision 8).
- Check-in needs a connection; offline, the tab says so in a few words (decision 3).
- The in-vehicle refusal cannot be tested without an activity module and a phone.
- Auto-cancel on a verified boarding needs BLE (later). Until then: the "I boarded" button and starting a broadcast.
- `pg_cron` needs enabling on the live project (question 5).

**7. Definition of done**
- [ ] Unit and integration tests pass, including "counts exclude expired before cleanup".
- [ ] `G1-M1` to `M4` pass on the emulator.
- [ ] `G1-P1` and `P2` pending on a phone.
- [ ] No coordinates stored.
- [ ] Commit `G1: station check-in`.

### S5 (existing step, unchanged criteria): live map from the simulator

Plan v2 S5 applies as written, with three changes:
1. Markers live in the Live tab.
2. `S5-M6 dev broadcast` moves to G2.
3. Add the server-side Night Mode suppression (question 7): `app_config` window plus a `live_vehicles` view that returns no moving markers during the window, by server time.

Criteria and their kind:
- Simulated marker; Stale after 90 s; bubble under 2 km/h across 45 s; "No data from riders right now"; occupancy bands 0–6, 7–12, 13+ of 16; viewport culling; "Prototype data, unverified" badge.
- Unit tests, plus Emulator with `scripts/simulate-vehicle.ts` on the PC.
- New criterion: `night window hides live markers: at 21:00 Asia/Manila by the server clock the view returns no rows; changing the phone clock has no effect` (PRD 10.4, 13). Integration test plus Emulator with its clock changed.

Effort: large.

### G2: live tracker from phones

**1. Goal.**
- A team phone, or the emulator playing GPX, broadcasts its position as a test vehicle on Route 4.
- It follows the 100 m or 30 s send rule, discards fixes worse than 30 m, and buffers up to 60 points while offline, flushing them in order.
- Several riders on one vehicle are coordinated: one Primary sends positions, Secondaries keep a light keepalive.
- If the Primary is silent for 90 s, the next eligible Secondary is promoted.

**2. Files**
- New pure functions in `src/shared/telemetry/`:
  - `sendRule.ts`.
  - `buffer.ts`: ring buffer logic, oldest dropped first.
  - `liveness.ts`.
  - `baton.ts`: ranking by remaining distance along the route to the declared destination, and eligibility (battery at least 30%, not in saver, permission granted).
- `supabase/functions/_shared/serverConfig.ts`:
  - `LIVENESS_TIMEOUT_S` moves here.
  - `PRIMARY_MIN_BATTERY_PCT = 30`.
  - `SECONDARY_FIX_INTERVAL_S = 60`.
- Migration `relay_sessions`:
  - Columns: session, user, vehicle, role, destination chainage, started, ended, last seen.
  - Retention: 30 days (PRD 12.2, 15.1).
- Migration `telemetry_raw`: session, position, speed, timestamp, night flag (question 10).
- Edge Function `session`: start, keepalive, end. It returns the caller's role. Promotion is decided on the next keepalive after 90 s of Primary silence, so no timer job is needed.
- Ingest: accepts positions only from the current Primary session of the vehicle.
- `src/state/broadcastStore.ts`; `src/services/broadcast.ts`.
- `src/data/db/telemetryBuffer.ts`: the existing `telemetry_buffer` table.
- `src/app/dev-broadcast.tsx`: behind `EXPO_PUBLIC_DEV_BROADCAST=true` and `__DEV__`; reached from My Ride.
- Simulator: `scripts/simulate-vehicle.ts` gains `--role secondary` so the baton can be tested with the emulator plus the PC.

**3. Dependencies.** S5, G0. R1 (`expo-battery`, `expo-network`).

**4. Tests**

| Criterion (PRD) | Test | Kind | E/P |
| --- | --- | --- | --- |
| Send at 100 m or 30 s (8.4) | `99 m and 29 s do not send; 100 m sends; 30 s sends; a stopped vehicle sends every 30 s` | unit | — |
| Fixes worse than 30 m discarded (8.4) | `30.1 m fix is not sent and does not count for the distance rule` | unit | — |
| 60-point buffer, oldest dropped, flushed in order (8.4, 0.2 S8) | `61st point drops the oldest; flush sends in timestamp order and stops at the first failure` | unit | — |
| 95% delivered in order after a 10-minute loss (13) | `G2-M3`: airplane mode for 10 minutes during GPX playback, then off. Server rows arrive in order. Count delivered against generated. | manual | E |
| Liveness 90 s, promotion (8.3, 8.4, 0.2 S8) | `primary silent 89 s stays; 90 s promotes the next eligible secondary by remaining distance` | unit, integration | — |
| Same, end to end | `G2-M4`: emulator as Primary, simulator as Secondary. Stop the emulator broadcast. Expect the simulator promoted within one keepalive after 90 s, and the marker Stale during the gap. | manual | E |
| Eligibility: battery at least 30%, not in saver (8.3) | `battery 29% is secondary only`; `G2-M5`: `adb shell dumpsys battery set level 25` | unit, manual | E |
| Dev broadcast appears as a vehicle (old `S5-M6`) | `G2-M1` | manual | E |
| Dev screen hidden without the flag | `dev broadcast route is not reachable when the flag is off` | unit | — |
| Packet stays at most 150 bytes, no rider identity | existing `packet.test.ts` | unit | — |
| Battery at most 5% per hour (Primary), 2% (Secondary); data at most 150 KB per hour (3.3, 13) | `G2-P1`, `G2-P2` | manual | **P** |
| Marker freshness p90 at most 30 s (3.3, 13) | query on `telemetry_raw` after a 30-minute GPX run | integration | E, then P |

**5. Manual test script**
- `G2-M1`:
  1. With the flag on, sign in.
  2. On My Ride, open Dev broadcast, choose `R4-TEST-02`, set seats to 8, tap Start.
  3. Play the outbound GPX.
  4. Expect an Amber marker on Live, moving.
- `G2-M2`: Stop. Expect the marker to go Stale after about 90 s.
- `G2-M3`: buffer test, as in the table.
- `G2-M4`: baton test, as in the table.
- `G2-M5`: battery level test, as in the table.
- `G2-P1`: a 2-hour ride on a phone as Primary. Record battery and Android data usage.
- `G2-P2`: the same as Secondary.

**6. Risks and open questions**
- Broadcasting stops when the app is in the background until G4.
- Two emulators may be too heavy for this PC; the simulator covers the second rider.
- `telemetry_raw` is needed for the freshness metric but adds retention duty (question 10).
- Baton rules carry only team accounts in v0.

**7. Definition of done**
- [ ] Unit and integration tests pass.
- [ ] `G2-M1` to `M5` pass on the emulator.
- [ ] Phone items pending.
- [ ] Retention jobs in place for `relay_sessions` and `telemetry_raw`.
- [ ] Commit `G2: live tracker from phones`.

### G3: verification and anti-spoofing

**1. Goal.**
- With `ENABLE_VERIFICATION` on, a report is published only after the verification window passes:
  - route snap within 30 m;
  - at least 50 m along the route;
  - motion: `IN_VEHICLE` in at least 60% of samples, or speed at least 25 km/h for 20 s.
- Mock fixes are discarded and counted.
- The integrity hook is called.
- Night Mode publishes static node updates instead of moving markers.
- BLE presence is not checked; it is deferred with the beacon.

**2. Files**
- `supabase/functions/_shared/verifyReport.ts`: the real checks, still the only reader of the flag.
- New constants in `serverConfig.ts`:
  - `MOTION_IN_VEHICLE_SHARE = 0.6`.
  - `MOTION_SPEED_FALLBACK_KMH = 25`.
  - `MOTION_SPEED_FALLBACK_S = 20`.
  - `VERIFICATION_WINDOW_S = 30` and `VERIFICATION_WINDOW_MAX_S = 90`.
  - `ROUTE_SNAP_DISTANCE_M` and `MIN_DISPLACEMENT_M` move here.
- Migration `route_lines`: a cloud copy of the directed lines, exported from the seed by a script, so the server can snap.
- `src/shared/verification/window.ts`: window bookkeeping, shared.
- Client:
  - `mocked` fixes are dropped before the send rule; a per-session mock counter goes to the session function (not the packet; question 11).
- Night Mode:
  - `app_config` window.
  - Migration `node_events` (route, station, passed at).
  - A function that turns snapped passages near stations into `node_events`, delayed by at least 2 minutes.
  - Live tab shows "Route 4 passed CSU 3 minutes ago" during the window.
- `deviceIntegrity()` is called before the first relay of the day. It stays a placeholder: Play Integrity is out of scope (PRD 0.6).

**3. Dependencies.** G2. Motion is speed-only through `getActivity()` returning `unknown` (decision 6); the `IN_VEHICLE` share applies only once a module exists. Real polylines for real rides (import script, on hold).

**4. Tests**

| Criterion (PRD) | Test | Kind | E/P |
| --- | --- | --- | --- |
| A simulated ride passes (0.2 S8) | `verifyReport: GPX-like fixes on the line at 30 km/h for 30 s pass` | unit | — |
| A stationary rider fails (0.2 S8) | `fixes within 10 m for 90 s fail displacement and motion` | unit | — |
| Route snap 30 m (10.2) | `fix 30 m off passes, 31 m off fails` | unit | — |
| Displacement 50 m along the route (10.2) | `49 m fails, 50 m passes` | unit | — |
| Motion: 60% `IN_VEHICLE` or 25 km/h for 20 s (10.2) | `59% fails, 60% passes; 25 km/h for 19 s fails, 20 s passes` | unit | — |
| Motion for real | `G3-P1` | manual | **P** |
| Mock fix discarded and flagged (10.3, 0.2 S8) | `a mocked fix is never sent and raises the mock counter`; fake source on E | unit, manual | E (fake source), **P** (mock-location app) |
| Window extends to 90 s in slow traffic (10.2) | `slow progress extends the window up to 90 s, then fails` | unit | — |
| Night Mode: no moving markers, static node events delayed at least 2 min (10.4) | integration with the server clock in the window; `G3-M2` changes the emulator clock and expects no effect | integration, manual | E |
| Night raw coordinates deleted within 24 h (10.4, 13) | integration: a night row older than 24 h is removed by the job | integration | — |
| Badge disappears only for verified markers (0.7) | `marker shows "Prototype data, unverified" unless verified is true` | unit | — |

**5. Manual test script**
- `G3-M1`:
  1. With the flag on in a dev build, play the outbound GPX at 30 km/h.
  2. Expect the marker to become public after the window.
  3. Play a GPX that stays still. Expect it never to become public.
- `G3-M2`:
  1. Set the emulator clock to 21:30.
  2. Expect live markers to remain (the server clock rules).
  3. With the server window overridden to "now" in `app_config`, expect static node updates only.
- `G3-P1` (phone): a real ride, and walking beside the vehicle (PRD 17 E9). Record the motion samples.

**6. Risks and open questions**
- The placeholder polyline fails the 30 m snap on real streets (PRD 12.5). Real rides need the import script.
- Activity recognition behaviour in stop-and-go traffic is unknown until E9.
- Whether the mock counter is a packet field (question 11).

**7. Definition of done**
- [ ] Unit and integration tests pass.
- [ ] `G3-M1` and `M2` pass.
- [ ] Phone items pending.
- [ ] `ENABLE_VERIFICATION` still read in one place.
- [ ] Commit `G3: verification and Night Mode stage 1`.

### G4: background reliability

**1. Goal.**
- A broadcast keeps running with the screen off, in a foreground service of type location with a visible notification.
- It stops itself on the idle rule (under 30 m of movement for 20 minutes outside a terminal geofence, 30 inside) and at the 3-hour cap with a prompt to continue.
- A vendor guide explains battery exemptions.
- The app records when the service was killed and shows a one-time fix guide.

**2. Files**
- `src/shared/telemetry/session.ts` (new, pure): idle rule and hard cap.
- Constants:
  - `IDLE_RADIUS_M = 30`.
  - `IDLE_STOP_MIN = 20`.
  - `IDLE_STOP_TERMINAL_MIN = 30`.
  - `SESSION_HARD_CAP_H = 3`.
  - These are missing today; `AUDIT_2.md` section 12 item 9.
- `src/services/backgroundLocation.ts`: `TaskManager.defineTask` at top level, plus `startLocationUpdatesAsync` with `foregroundService` (`notificationTitle`, `notificationBody`, `notificationColor`).
- `src/app/battery-guide.tsx`: vendor steps for the brands in the pilot, opening settings through `expo-intent-launcher`.
- `src/state/serviceHealth.ts`: last start, last clean stop, kills detected on next open.
- `app.json` (R1): `expo-location` plugin `isAndroidForegroundServiceEnabled: true` and the notification icon.

**3. Dependencies.** G2. R1. Possibly R2 (risk 4).

**4. Tests**

| Criterion (PRD) | Test | Kind | E/P |
| --- | --- | --- | --- |
| Idle stop 30 m for 20 min, 30 min in a terminal (8.4) | `19:59 still runs, 20:00 stops; inside a terminal 30:00` | unit | — |
| Hard cap 3 h with a prompt (8.4) | `prompt at 3:00:00; stop if not confirmed` | unit | — |
| Foreground service with location type and notification (8.5) | `G4-M1`: start a broadcast, turn the screen off for 10 minutes with GPX playing; packets keep arriving; the notification is visible | manual | E (stock Android only) |
| Kill detected and fix guide shown (8.5) | `G4-M2`: `adb shell am kill com.tunton.app` while broadcasting; on reopen, the guide appears once | manual | E |
| Survival under vendor battery managers, six skins (8.5, 13, 17 E5) | `G4-P1` | manual | **P** (several brands) |
| Session dropout at most 15% after the guide (17.3) | pilot metric | field | **P** |

**5. Manual test script**
- `G4-M1`: as in the table.
- `G4-M2`: as in the table.
- `G4-P1`: on each available phone, a 60-minute screen-off ride, with and without the exemption. Record dropouts.

**6. Risks and open questions**
- Risk 4: whether the location service needs background permission.
- Play policy declarations are needed only for a Play release, which is out of scope.

**7. Definition of done**
- [ ] Unit tests pass.
- [ ] `G4-M1` and `M2` pass on the emulator.
- [ ] Phone matrix pending.
- [ ] No background permission unless R2 is approved.
- [ ] Commit `G4: background reliability`.

## 5. Test strategy (emulator vs phone)

**Emulator tools**
- **Single fix:** `adb emu geo fix <longitude> <latitude>`, longitude first. For example RCA is `adb emu geo fix 125.541426 8.947459`.
- **Route playback:** Extended controls, Location, load a GPX or KML file and press play. Speed is adjustable there.
  - GPX files for both placeholder lines are generated from the seed by a test helper and kept in `docs/gpx/`, so they never become a second source of route facts.
- **Accuracy, speed and mock flag:** `geo fix` cannot set accuracy or the mock flag (assumed, **unverified**). The development-only fake location source replays fixtures with chosen values.
- **Battery:** `adb shell dumpsys battery set level <n>`, then `adb shell dumpsys battery reset`.
- **Signal loss:** airplane mode. Or `adb shell svc data disable` and `adb shell svc wifi disable`, then enable both again.
- **Clock:** the emulator's date and time settings, for the Night Mode clock test.
- **Second rider:** the PC simulator script, not a second emulator.

**Needs a real phone**

| What | Why | Steps |
| --- | --- | --- |
| Activity recognition (`IN_VEHICLE`) | The emulator has no real motion sensors behind Play services | G1-P1, G3-P1 |
| Battery use (5% and 2% per hour) | Emulator battery is simulated | G2-P1, G2-P2 |
| Data use (150 KB per hour) | Network stats on a real SIM | G2-P1 |
| Background survival under vendor battery managers | The emulator runs stock Android | G4-P1 |
| Real GPS accuracy at terminals | Simulated fixes are exact | G0-P1, G1-P2 |
| Mock-location app detection end to end | Needs a mock-location app installed and selected in developer options. Possible on an emulator image with Play, but **unverified**. | G3 |
| 250 ms routing p95 on a 3 GB phone | Hardware target | carried over from S3 |

**Unit tests** continue in the `shared` project (plain Node). UX2 adds the first tests in the `app` project (`jest-expo`).

## 6. Privacy and data handling per step

| Step | Location data handled | Stored where | How long | PRD match |
| --- | --- | --- | --- | --- |
| UX2 | None | Theme choice on the device | Until changed | — |
| G0 | Foreground fixes | **Memory only.** Consent state and date on the device (kv-store). Nothing sent. | Fix: until the next fix. Consent: until withdrawn. | 7.1 and 15.1 consent before permission; 4.2 reduced mode |
| G1 | One fix per check-in attempt, sent to the function for the server re-check | Cloud `checkins` row: user, station, route, created and expires times. **The coordinates are not stored.** | Deleted at expiry by the job (at most about 16 minutes) | 7.5; 15.1 minimisation. Counts are aggregates with no user ids. |
| S5 | Simulator positions only | `telemetry_latest` (no user) | Overwritten; night suppression by the server | 10.4 vehicles, never riders |
| G2 | Primary positions | `telemetry_latest` (no user). `telemetry_raw` (session id, not user id). `relay_sessions` (user to vehicle link). On the device, the `telemetry_buffer` (60 points, until sent). | Raw: day 7 days, night 24 hours. Sessions: 30 days. Buffer: until flushed. All by scheduled jobs. | 12.2, 15.1 retention; 8.4 buffer |
| G3 | Same as G2, plus `node_events` (route, station, time; no user) | Cloud | Node events: kept, as aggregates | 10.4 static nodes, night retention |
| G4 | Same as G2, while the screen is off | Same as G2 | Same | 8.5. The notification makes tracking visible. |

At every step:
- No classification, avatar, name, email or phone goes to the cloud.
- Markers never show a rider.
- The privacy tests are extended to cover each new table and function.

## 7. Backend changes

**Already covered by S4 Part 1** (once applied in S4 Part 2):
- `profiles`, `vehicles`, `telemetry_writers` (allowlist), `telemetry_latest` (verification columns), `telemetry_ingest_log` (30 days).
- The ingest function with packet validation.
- The Realtime publication.

| Step | Adds | Row-level security and grants |
| --- | --- | --- |
| S4 Part 2 | `app_config` (key, value, description): Night Mode window, server constants that clients may read (question 4). `pg_cron` job purging `telemetry_ingest_log` daily (question 5). | `authenticated` select only; writes from the dashboard or `service_role`. |
| G1 | `stations` (cloud copy from the seed). `checkins` (`user_id` primary key, so one row per user at most; `station_id`, `route_id`, `created_at`, `expires_at`). `checkin_counts(route_id)` function, `security definer`, counting rows with `expires_at > now()` per station and returning counts only. `pg_cron` delete every minute. `checkin` Edge Function. | `stations`: `authenticated` select. `checkins`: select own row only, no client insert, update or delete (the function writes). `checkin_counts`: execute for `authenticated`. Nothing for `anon`. |
| S5 | `live_vehicles` view applying the Night Mode window by server time (question 7). | `authenticated` select on the view; `telemetry_latest` select narrowed to the view if you agree. |
| G2 | `relay_sessions`, `telemetry_raw`, `session` Edge Function. Ingest accepts only the Primary. Retention jobs (raw: 7 days day, 24 hours night; sessions: 30 days). | No client access to either table; the functions use `service_role`. |
| G3 | `route_lines` (cloud copy from the seed), `node_events`, verification in `verifyReport`. | `route_lines`: `authenticated` select. `node_events`: `authenticated` select (route, station, time only). |
| G4 | None. | — |

Every migration:
- Enables row-level security explicitly, revokes from `anon` and `authenticated`, then grants the minimum.
- Gets a text test like `migration.test.ts` and live tests like `tests/integration/supabase.test.ts`.
- Each is pushed only after you approve the exact command.

## 8. New dependencies

None are installed. Each needs your approval, through `npx expo install`, before R1.

| Package | Step | Native? | Why | Alternative |
| --- | --- | --- | --- | --- |
| `expo-system-ui` | UX2 | Yes | System bars and window follow the theme (question 2) | Keep the bars fixed; no package |
| `expo-notifications` | G1 | Yes | 5-minute reminder (PRD 7.5) | In-app banner only |
| ~~Activity recognition module~~ | G1, G3 | Yes | `IN_VEHICLE` (PRD 7.5, 10.2) | **Skipped for now (decision 6):** speed-only motion rule, no in-vehicle refusal |
| `expo-battery` | G2 | Yes | Primary eligibility (PRD 8.3) | Treat every rider as eligible |
| `expo-network` | G2 | Yes | Reconnect detection for the buffer | Retry on a timer |
| `expo-task-manager` | G4 | Yes | Required by background location updates | none |
| `expo-intent-launcher` | G4 | Yes | Open battery settings from the guide | Text instructions only |
| Splash support | R1 | Unverified | Whether SDK 57 needs `expo-splash-screen` listed for a custom splash is checked when R1 is prepared | — |

No dependency is needed for G0, S5 or the simulator.

## 9. Later phases

| Later work | Depends on from this plan |
| --- | --- |
| BLE beacon and boarding detection (S6, S7) | G2 sessions (the boarding prompt starts a session); G3 `verifyReport` (adds the BLE presence test); G1 auto-cancel (a verified boarding cancels the check-in); a rebuild with a Kotlin BLE module and the Bluetooth scan permission |
| Driver app | `vehicles` (plate, route), a vehicle secret in the vault; G1 counts as its data source; nothing from G0 |
| SMS worker, gateway and heatmap (S9) | G1 `checkin_counts`; `sms_outbox` table; the S1 signer and parser |
| Energy and rewards | G3 verified sessions, G1 check-ins (+0.3), G4 arrival stop; caps by Asia/Manila midnight from `app_config` |
| Trust, flags, strikes, appeals | G3 risk signals (mock counter, route-snap failures); `relay_sessions` to find the Primary at a flagged time |
| ETA | G2 `telemetry_raw` history for segment speeds |
| Other routes | The real-data import script; the spatial grid prefilter (PRD 7.2 step 2); per-route colours |
| Admin console | `app_config`, `vehicles`, `route_lines`, moderation tables |
| Play Store submission | G0 consent and notice; G4 foreground service declaration and video; Data Safety form; release signing; Play Asset Delivery for tiles |

## 10. Risks

| # | Risk | Effect | Mitigation |
| --- | --- | --- | --- |
| 1 | The design source for UX2 is missing | UX2 built on assumptions and reworked | Question 1 before UX2 starts |
| 2 | Only an emulator is available | Activity, battery, background and real accuracy cannot be proven | Phone items stay pending; fake source for logic; record every result with its device |
| 3 | Emulator GPS behaviour assumed (no accuracy control, no mock flag) | Gate and mock tests could pass for the wrong reason | Fake source covers them; confirmed on the first G0 run |
| 4 | The foreground location service may need `ACCESS_BACKGROUND_LOCATION` | Extra permission, Play declaration, R2 rebuild | Read the SDK 57 docs and test at G4 start; ask before R2 |
| 5 | Activity recognition needs native code | R1 grows; a module to maintain | Question 6; speed-only fallback |
| 6 | Placeholder polylines fail the route snap on real streets | G3 cannot pass on a real ride | The import script ("go" from you) before real-ride G3 tests |
| 7 | Night Mode not enforced when live markers start | Live coordinates published at night | Suppression view in S5 (question 7) |
| 8 | `pg_cron` not enabled | Expired check-ins and raw telemetry not purged (counts stay correct because they filter on `expires_at`) | Question 5; the function-side purge as fallback |
| 9 | A native rebuild fails (toolchain issues of 2026-10-02) | Lost time | R1 is a single batch; JDK 17 and IPv6 settings from `docs/device-tests.md` known issues |
| 10 | Free-tier limits with telemetry every 30 s plus keepalives | Throttling | Measure in G2; the send rule keeps volume low |
| 11 | Consent and minors (PRD 15.1) | Legal review findings | DPO review before any pilot (question 9) |
| 12 | Scope growth in G2 (baton) | Schedule | Baton limited to team accounts; the simulator plays the second rider |

## 11. Open questions for the user

**All 13 questions below were answered on 2026-10-03. The answers are in "Decisions after Audit 2" at the top.** The questions are kept so the decisions can be traced.

New questions:

- **N1. Team account card in Settings.** It is not in the UX2 Settings rows. It is kept below them, because S4 Part 2 sign-in needs it. *Blocks nothing; Emjay may move it.*
- **N2. Check-in allowlist.** Reuse `telemetry_writers` for G1, or a separate list? *Blocks the G1 migration.*

Original questions:

1. **UX2 design source:** please re-send the "UX redesign" prompt and add `docs/DESIGN.md`. Also confirm the Fare and My Ride icons, and that profile items move into My Ride. *Blocks UX2.*
2. **`expo-system-ui`:** install it in R1 so system bars follow Light and Dark, or keep the bars fixed? *Blocks the UX2 definition of done and R1.*
3. **Check-in in the cloud or on the device only?** Job B says a cloud table; your PRD-change list mentions "local-only check-in". A local-only check-in cannot feed counts or a heatmap. *Blocks G1.*
4. **`app_config` in S4 Part 2:** add it then, with the Night Mode window? *Blocks the S4 Part 2 migration.*
5. **`pg_cron`:** may it be enabled on the live project, when you approve the command, for the retention and cleanup jobs? *Blocks G1 cleanup and the G2 retention jobs.*
6. **Activity recognition:** a local Kotlin Expo module (more work, no third-party code), a third-party library (name to be checked against SDK 57), or skip it for now (speed-only motion; no in-vehicle refusal)? *Blocks the R1 content, the G1 in-vehicle rule and the G3 motion test.*
7. **Night Mode suppression in S5:** hide moving markers during 21:00 to 04:59 by server time from S5 on, before the static view exists in G3? *Blocks S5.*
8. **Who may check in in v0,** and should the Check-in tab show the waiting count? Any signed-in account, or allowlisted team accounts only? *Blocks G1 policies and screen.*
9. **Consent wording and minors:** draft it for DPO review later, or do you have approved text? *Blocks the G0 definition of done (wording only).*
10. **`telemetry_raw`:** keep raw positions (7 days day, 24 hours night) so freshness and delivery can be measured, or keep only `telemetry_latest`? *Blocks G2 and the NFR freshness measurement.*
11. **Mock-location counter:** send it in the session keepalive (recommended; the packet stays at the PRD's seven fields), or add a packet field? *Blocks G3.*
12. **Real polylines:** when may the import script go ahead? *Blocks real-ride tests of G3.*
13. **Live view audience** (`AUDIT_2.md` question 6): signed-in team accounts only, or signed-out viewers too? *Blocks S5 policies.*
