# Tunton: what the app can do today

A plain-language inventory of the Android prototype, checked against the code, the tests and the git history on 2026-10-17. Where a document said "done" but no test or device record backs it, this file says so.

## 1. Summary

| Item | Value |
| --- | --- |
| Date checked | 2026-10-17 |
| Commit | `900f3c8` on `main` (same as the remote; last code change 2026-10-09) |
| Platform | Android only (Expo SDK 57, React Native 0.86) |
| Tests | 72 suites, 954 tests: 954 passed, 0 skipped on the second full run; the first run that day had 1 failed test that did not repeat (flaky, not identified) |
| Live backend tests | 17 of 17 passed against the live project (part of the 954) |
| Quality gates | Typecheck pass; lint pass; tests pass on rerun (see above) |

| Status | Features (section 4) |
| --- | --- |
| REAL | 23 |
| DEMO | 2 |
| PARTIAL | 7 |
| UNVERIFIED | 1 |
| NOT BUILT | 7 |
| **Total** | **40** |

## 2. Status legend

- **REAL**: works with real or locally stored data and has a named test or a recorded device result.
- **DEMO**: works only with simulated data, labelled "Demo" in the UI.
- **PARTIAL**: some of it exists (the row says which part).
- **NOT BUILT**: nothing usable exists.
- **UNVERIFIED**: code exists, but no test or device record.

"Device" in this file means the Android emulator (Pixel 7 image, API 34, on a laptop) unless a physical phone is named. **No version of the current app has been run on a physical phone** (section 6).

## 3. Screen by screen

The app opens with a splash screen, then the introduction on first launch, then four tabs: **Map**, **Check-in**, **My Rides**, **Crowdsource**. The avatar in the top bar opens Profile; the menu button opens Settings, Demo & simulation, About and Licences; the bell opens Notifications.

| Screen | What a user can do (path) | Status | Placeholders |
| --- | --- | --- | --- |
| Introduction | First launch: welcome by the mascot, optional gender (chooses the avatar set), avatar in a swipe row, suggested username with a dice button, fare type, up to 3 frequent places with suggested routes; Skip. Replay: Menu, Settings | REAL (tests: `destinations`, `avatarPick`, `usernameSuggest`, `profileStore`; emulator F1-M1 to M4 for the earlier layout) | The 2026-10-09 layout (ST2-B) has no device record |
| Consent | Shown before any location prompt (Locate me, the introduction's location switch). I agree / Not now; Withdraw later in Settings, Privacy | REAL (`location.test`, `locationStore.test`; emulator 2026-10-06) | English draft; data protection officer review pending |
| Tips tour | Nine speech bubbles over the Map tab after the introduction; Skip / Next; replay from Settings | REAL (`tourPlacement.test`) | No device record |
| Sign-in | Email and password sign-in or sign-up, asked at the first cloud feature | REAL (live tests) | — |
| Map tab | Pick a route chip: the line, its stops and its multicabs appear; other routes fade. Tap a multicab: card with seat tier, ETA, "km from you", age of the last position. Track: ETA, distance by road, distance alerts, auto-stop on arrival. Relay (round button). Locate me | Vehicles: DEMO (or team test vehicles from a simulator). Lines: REAL | Live vehicles readable by team accounts only; others see "Team accounts only for now" |
| Relay sheet | Map, Relay: route, seats (3 tiers, required), what's happening (optional preset), destination by search, Share with GPS. Sent posts appear in Crowdsource | REAL for posting (live tests); GPS sharing is PARTIAL (a session and an auto-end exist, positions are not uploaded) | Vehicle picker is a development-only list |
| Check-in tab | Stations of every route (filter by route), station card with distance, walk time, waiting count, "Routes here", Check in (needs 60 m from the stop and 25 m GPS accuracy), Ping routes at shared stops, countdown 15 min, reminder at 5 min, I boarded / Cancel | REAL (`localCheckin`, `crowd`, `location` tests; live tests; emulator B3) | Waiting counts by other people are made up in Demo mode |
| My Rides | Type From and To (stops, 1,683 offline place and street names, saved places), or tap the map; result sheet with walk, ride, walk, the route and the fare (Estimate, "Does not replace the official fare"); star to save a place; hide or show stop dots | REAL (`routing`, `realRoutes`, `placeSearch`, `fare` tests; emulator S3-M1 and later) | **Fare is a placeholder** (₱15 base, see section 7) |
| Crowdsource | Relays from the last 60 minutes (no GPS posts), Trusted badge, "Near <stop>", Flag on other people's posts, "You" on own | REAL (live tests; emulator B6) | Demo posts when Demo data is on |
| Profile | Avatar, username (inline edit), trust line toward Trusted, fare type, Tracking Energy card, Trust Badges (7), Your places, General history with Clear | REAL (`badges`, `trust`, `history`, `countsStore` tests; emulator B7) | — |
| Settings | Theme, labels, Demo data on/off, location consent and Withdraw, privacy questions and data request (opens email), Delete account, Reset app, replay introduction and tour | REAL (`settingsStore`, `account`, `privacy` tests) | Live delete-account never run (it would delete the test account) |
| Demo & simulation | Simulated multicabs, simulated location ("Stand at" a stop), fake GPS accuracies (development builds) | DEMO | — |
| About, Licences | Version, OpenStreetMap and Noto Sans credits, ODbL note | REAL (`licences.test`; emulator LB1) | — |
| Notifications | Opens an empty list | NOT BUILT | Placeholder screen |
| Guests (no account) | Check-in and Crowdsource greyed with a lock; Relay and Track locked; tapping asks to sign in | UNVERIFIED (no test, no device record) | — |

## 4. Features by area

| # | Feature | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Offline map of Butuan (bundled tile file, works in airplane mode) | REAL | `offlineMap.test`, `tileInstall.test`; emulator S2-M1 (airplane mode), S2-M5 |
| 2 | Offline map labels (local glyphs) | REAL | `glyphInstall.test`, `labelLayers.test`; emulator LB1a-M1 |
| 3 | Grey base map, water drawing fix, zoom-aware pan limit | REAL | `bounds.test`; commit `8f8f5c0`; no device record |
| 4 | Route lines R1, R2, R3, R4, R5, R14 | REAL | `realRoutes.test`, `routeImport.test`, `rr3Import.test`, `routeLoop.test`; emulator 2026-10-08 (six routes) |
| 5 | Stops (39 stations) | PARTIAL | Names and positions from the team's stop list, snapped to the lines (`stopImport.test`); several stops left out as too far from the line; not checked in the field |
| 6 | Trip planning (walk, ride, walk; 500 m walk limit) | REAL | `routing.test`, `planGuidance.test`, `rankOptions.test`; emulator S3-M1, S3-M4 |
| 7 | Place and street search (offline) | REAL | `placeSearch.test`; 1,683 places counted in `places.generated.ts` |
| 8 | Fare and discounts (student, senior, PWD: 20 % off) | PARTIAL | Formula and discount: `fare.test`, `fareType.test`, emulator S3-M2. Fare values are placeholders, not an official matrix |
| 9 | Onboarding | REAL | `destinations`, `avatarPick`, `usernameSuggest` tests; emulator F1-M1 to M4 |
| 10 | Tips tour | REAL | `tourPlacement.test` |
| 11 | Avatars (16 illustrations: 10 male, 6 female) | REAL | `avatarPicker.test`; config `AVATAR_COUNT` |
| 12 | Greeting by time of day | REAL | `greeting.test` |
| 13 | Profile, places, history, badges | REAL | `badges`, `history`, `suggest`, `countsStore` tests; emulator B7, F5 |
| 14 | Accounts, username rules | REAL | `backendRules.test`; live tests |
| 15 | Delete account, data request | REAL | `account.test`; live delete not run |
| 16 | Guest locks | UNVERIFIED | Code in the tab layout and top bar; no test |
| 17 | Station check-in (geofence 60 m, 15 min life, 5 min reminder) | REAL | `localCheckin`, `crowd`, `location` tests; live tests; emulator B3 (reminder not seen live) |
| 18 | Live vehicles from real multicabs | NOT BUILT | No driver or vehicle broadcasting (step T1 blocked) |
| 19 | Live vehicle pipeline (server, map updates) with test vehicles | PARTIAL | `ingest.test`, `liveVehicles.test`; a simulator script sent two test vehicles through the server, seen on the emulator 2026-10-06 |
| 20 | Demo multicabs on every route | DEMO | `demoVehicles.test`, `vehicleMarkers.test`; emulator AF3-M1 |
| 21 | Tracking with ETA, distance alerts, arrival | DEMO | `eta.test`, `relayBroadcast.test`; emulator (demo and parked test vehicle) |
| 22 | Relay (crowd report) | REAL | `crowd.test`; live tests; emulator 2026-10-08 |
| 23 | Relay GPS sharing | PARTIAL | Session, auto-end at the destination or 90 min (`relayBroadcast.test`); positions are not sent |
| 24 | Crowdsource feed and flagging (3 flags hide a post) | REAL | `crowd.test`, `feedBadge.test`; live tests |
| 25 | Trust points and Trusted badge (5 points; max 3 a day) | REAL | `trust.test`; live tests (capped points, flag takes a point back) |
| 26 | Energy (tracking costs 1 per 30 min; earned by check-ins and relays) | PARTIAL | `energy.test`; demo wallet charges. The live switch-on migration exists; whether it was applied is unverified |
| 27 | Night Mode (21:00 to 04:59 Manila: server hides moving vehicles; stop-naming relays held 2 min) | REAL | `migration.test`; live tests; emulator 2026-10-06 |
| 28 | Location consent, accuracy gates (check-in 25 m, relay 30 m), mock and stale fixes refused | REAL | `location.test`, `locationStore.test`; emulator G0 |
| 29 | Offline banner when the server is unreachable | REAL | `account.test` (probe online, offline, timeout); phone check pending |
| 30 | Light and Dark themes | REAL | `contrast.test` (colour contrast pairs) |
| 31 | Licences screen | REAL | `licences.test`; emulator LB1 |
| 32 | Backend: 10 migrations, `ingest` function, retention jobs | REAL | `migration.test`, `ingest.test`; 17 live tests. 9 migrations recorded as applied; the 10th (`energy_on`) not recorded as applied |
| 33 | Report verification (Verified badge) | NOT BUILT | Verification hook always answers "unverified" |
| 34 | Device integrity check | NOT BUILT | Stub returns "not checked" |
| 35 | Bluetooth vehicle detection | PARTIAL | Signal smoothing function and test (`rssi.test`) only; no Bluetooth module |
| 36 | SMS fallback | PARTIAL | Message format, signing and validation (`sms.test`); nothing sends an SMS |
| 37 | Driver app | NOT BUILT | Deferred in the plan |
| 38 | Administrator dashboard | NOT BUILT | Flagged posts go to a review table read in the database console |
| 39 | Background location | NOT BUILT | Step B1 blocked |
| 40 | Notifications screen, Cebuano text | NOT BUILT | Empty screen; English only |

## 5. Data and privacy

**Kept on the phone only:** gender choice, avatar, fare type, frequent places (up to 3), ride history, badge counts, settings, location consent, the offline map and route data. The avatar is never sent.

**Sent to the server today, only when signed in and Demo data is off:**

| Data | Why | Kept for |
| --- | --- | --- |
| Email and password (the sign-in service) and the username | Account | Until Delete account |
| Check-ins (route, station, time) | Waiting counts | 15 minutes, then deleted by a scheduled job |
| Relays (route, seats tier, preset phrase, optional destination, nearest stop code, username) | Crowdsource feed | 60 minutes |
| Flags (who flagged which post) | Moderation | 30 days |
| Energy ledger and trust points | Wallet and badge | Until Delete account |
| Vehicle positions (team test vehicles only) | Live map | Latest position; raw history 7 days, 24 hours at night; ingest log 30 days |

No precise location of a commuter is stored on the server: the phone checks the geofence and sends only the station code and the nearest stop code. In Demo mode (the default) nothing is sent; a test (`privacy.test`) checks that demo code imports no network service. Connections use HTTPS. The consent text still needs a data protection officer's review. The retention jobs exist as a script and are recorded as installed on the live project; their running was not checked in this audit (unverified).

## 6. What has never run on a real phone

The only physical phone results (Android 16 phone, 2026-10-02 and 2026-10-03) were made on the **partner's own earlier code**, replaced at the merge on 2026-10-04: app install, offline map, a moving blue dot, two fares and a routing benchmark. For the current app, everything below is untested on a phone:

- The whole current build (smoke test ST1: cold starts, crash log, tabs, consent and blue dot, withdraw, check-in at 28 m, live markers): **pending**.
- Offline banner in airplane mode (PC1-M4), consent on a phone (G0-P1).
- Memory over 15 minutes of use (emulator showed touches stop working at 908 MB, EQ-2; must be confirmed on a phone).
- Frame rate and battery, real GPS accuracy at stops, outdoor use, moving vehicles by day.
- Everything changed on 2026-10-09 (launch, introduction, My Rides layout, search, tour, guest locks, Energy charging): no device record at all.

## 7. Known limitations and open problems (most serious first)

1. **No real multicab sends its position.** Live vehicles are simulated (Demo) or team test vehicles. Tracking and ETA have never run on real traffic.
2. **No version of the current app has run on a phone**, and the emulator showed a memory problem after 14 minutes (EQ-2).
3. **Fares are placeholders**: ₱15 for the first 4 km, ₱2 per km after, rounded to ₱0.25, 20 % discount. The official fare is not confirmed.
4. **Reports are never verified**: the Verified badge does not exist; trust relies on flags and daily caps.
5. **Stops are not field-checked**; some stops on the team's list were left out; R14 has only one direction (Draft).
6. **No driver module, no administrator dashboard, no heatmap.**
7. Live map limited to team accounts; the Energy switch-on for the live project is not recorded as applied.
8. Consent text not yet reviewed by a data protection officer.
9. One test failed once and passed on rerun (flaky; not identified).
10. Notifications screen empty; English only.

## 8. Ten-step demo walkthrough

Start from a fresh install on a phone or emulator, Demo data on (the default). Check-in, Crowdsource, Relay and Track are locked for guests even in Demo mode, so step 4 signs in. A new Energy wallet holds 1, enough for one tracking session. Rehearse this once on the defense device: it has not been run end to end in this order (unverified).

| # | Step | Expected result | Status |
| --- | --- | --- | --- |
| 1 | Turn on airplane mode, open the app | Splash, then the introduction; the map draws offline | REAL |
| 2 | Introduction: pick gender, avatar, keep the suggested username, fare type Student, add one place | Suggested routes per place; the Map tab opens and the tips tour starts | REAL |
| 3 | My Rides (still offline): type "SM City" in From and a street name in To | Walk, ride, walk; route; fare marked Estimate with the student discount and the disclaimer | REAL (fare values placeholder) |
| 4 | Turn airplane mode off; tap the locked Check-in tab, Sign in with a prepared account | Signed in; the locks disappear | REAL |
| 5 | Map: tap the R4 chip, then a moving multicab | R4's line and stops, other routes faded; card with seat tier, ETA and the "Demo" label | Line REAL; vehicle DEMO |
| 6 | Tap Track | 1 Energy spent; ETA and "km by road"; distance alerts; tracking stops on arrival with a toast | DEMO |
| 7 | Check-in: Demo & simulation, Stand at SM City; then Check in | Countdown from 15:00, red dot on the tab; I boarded shows a farewell card | REAL (location simulated; nothing sent in Demo mode) |
| 8 | Map, Relay: route, seats tier, a phrase, send | "Update relayed"; the post appears in Crowdsource with the "Near" stop | DEMO (with Demo data off it posts to the live feed: REAL) |
| 9 | Profile | Trust line, badges earned (first check-in, first relay), Energy card, history | REAL |
| 10 | Settings, Privacy: Withdraw location; then Sign out and Delete account | Blue dot gone; the phone is cleared and the introduction opens | REAL |

## 9. Numbers I can quote

| Number | Value | Source and device |
| --- | --- | --- |
| Automated tests | 954 in 72 suites, all passing (second run, 2026-10-17) | Development PC |
| Live backend tests | 17 of 17 | Live project, 2026-10-17 |
| Routing time | p50 0.019 ms; p95 0.033 to 0.048 ms (1,000 trips × 3), budget 250 ms | Emulator on a laptop CPU, 2026-10-03, older 6-point line: **not representative of a phone** |
| Routing time (phone) | p50 0.65 ms, p95 0.72 ms (one run) | Partner's Android 16 phone, **partner's earlier code**, development build |
| Offline map file | 3.67 MB (`butuan_v2.pmtiles`) | Repository |
| Offline place names | 1,683 (317 streets) | `places.generated.ts` |
| Routes and stops | 6 routes, 39 stations | Route seed |
| Frame times, 2 demo vehicles | p50 17 ms, p95 32 to 400 ms, 59 to 67 % janky | Emulator, development build, **not representative of a phone** |
| Frame times, 50 markers | p50 21 to 25 ms, p95 48 to 69 ms | Same emulator, **not representative** |
| Memory | 683 MB (demo, after cold start); 794 MB (50 markers); 908 MB when touches failed | Emulator, development build, software GL, **not representative** |
| Development APK | about 306 MB (debug build, includes development tooling) | Emulator build 2026-10-02 |
