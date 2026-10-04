# Project status

## Where we are in plain words

| Works with real data | Works with demo data only | Not built |
| --- | --- | --- |
| Offline map of Butuan; **real traced lines for R3, R4 and R5**, shown only when picked (RR1, UX3). R4 and R5 have only their return leg, partial. | **Moving PUVs on Live** (AF3): 2 or 3 simulated vehicles per route on the real lines, seat tiers, Live / Stale / No data, stopped state, all marked "Demo". Settings → "Demo data" turns it off. | Real live PUVs, tracking and ETA |
| My Ride: trip and fare on the stored direction (the **stops and fares are still placeholders**) | | Cloud check-in and waiting counts |
| Onboarding, greeting, avatars, Light and Dark | | Reports, newsfeed, Energy |
| Local check-in countdown (never seen on a device) | | Profile with username and badges |
| Blue dot and "Locate me" (location tests pending) | | Consent screen (G0). **Do not use outdoors or share yet.** |

**Next three steps:**
1. Emjay: check AF1 to AF3 and LB1a (backlog 74 to 78, and 68); approve AF4.
2. Agent: AF4 and AF5 on approval (then G0, as ordered); LB1b on approval.
3. Emjay: the location test results; the missing R4 and R5 legs when ready.

## Details

- **Date:** 2026-10-05.
- **Code:** `main`, ahead of `origin/main`, 0 behind. Last code commits: AF1 (text and hints), LB1a (offline glyphs), AF2 (repositories and the Demo switch, backlog 68 fix), AF3 (demo vehicles on Live).
- **Docs:** history files are in `docs/history/` (`f857cef`). Closed backlog items are in `docs/history/AUDIT_BACKLOG_CLOSED.md`. The index is `docs/README.md`.
- **Tests:** 41 suites; 619 passed; 8 skipped. The skipped ones are the live Supabase tests, which have no `.env`.
- **Quality gates, run today:**

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | pass |
| `npx expo lint` | pass |
| `npx jest` | pass |
| `npx expo-doctor` | 21/21 |
| `npx expo install --check` | up to date |

- **Native build:** `android/` and the emulator's APK date from 2026-10-02 at 23:46 and 23:48, so **R1a is not built**.
- **Status codes:**

| Code | Meaning |
| --- | --- |
| VERIFIED | Code, a named passing test, and a device result where one is needed |
| UNVERIFIED | Code exists, but a test or a device record is missing |
| PARTIAL | Some of it exists |
| NOT-STARTED | Nothing exists |
| BLOCKED | Waiting for something outside the code |

## 1. In one paragraph

The offline half of the app works and is tested: the map, Route 4 routing and fares, the three-tab design, the sheet, onboarding and avatars. The partner's location code is merged: the blue dot, "Locate me", and the location-off mode. Nothing live exists: no vehicles, no cloud check-in, no backend run. All route, stop, landmark and fare data is placeholder. The current native set (R1a) has never been built, and the merged app has never run on a phone. **Do not use the app outdoors or share it before G0:** it asks for location without a consent screen.

## 2. What the app can do today

| Screen | A user can | Placeholder or missing | Ever run on a device? |
| --- | --- | --- | --- |
| First launch | Four steps: Tunton welcome, optional gender (picks an avatar), fare type, up to 3 destinations; Skip; Replay from Settings | Destinations are the 6 placeholder stops | Emulator (agent run and Emjay's F1 review) |
| Live | Offline Butuan map; Route 4 line both ways with arrows; tap a stop; greeting card with destination chips that open My Ride; "Show whole route"; "Locate me" opens the explainer, then permission, then the blue dot that the map follows | "No data" pill: vehicles never appear. If location is denied, a long-press pin is shown, but nothing uses it. | Emulator; blue dot by Emjay on the old build |
| Check-in | Pick R4 and a station; 15-minute countdown; I boarded; Cancel; all on the phone | Nothing is sent; no geofence | **Never run** |
| My Ride | From and To by map tap or stop chips; walk, ride, walk; fare as a big number; quick fare-type chip; Details; "All routes" | Fare values and the line are placeholders | Emulator |
| Settings (avatar button) | Fare type, Light or Dark, avatar grid of the own set plus Shuffle, About, Replay intro, Team account card | Not yet "Profile"; no username or badges; the backend is not configured | Emulator. The own-set grid and About were **never run**. |
| Sign-in | Screen exists | Never used against a backend | Never |

## 3. Progress table

| Phase | Step | Status | Evidence | Blocker or what you must do |
| --- | --- | --- | --- | --- |
| Done | S0 tooling | VERIFIED | `config.test.ts`; `S0-M1` (emulator) in `device-tests.md`; `9a436eb`, `a5fea43` | — |
| Done | S1 shared core | VERIFIED | `fare.test.ts`, `sms.test.ts`, `rssi.test.ts`, `geo.test.ts`; `9a436eb` | Beacon codes deferred |
| Done | S2 offline map | VERIFIED | `offlineMap.test.ts`, `tileInstall.test.ts`; `S2-M1`, `S2-M5`; `f852592` | Zoom 18 not checked (backlog 2) |
| Done | S3 routing and fare | VERIFIED | `routing.test.ts`, `routeDb.test.ts`, `planGuidance.test.ts`; `S3-M1` to `M4`; `bbb2679` | No 3 GB phone |
| Done | S4 Part 1 (code) | VERIFIED (unit only) | `migration.test.ts`, `ingest.test.ts`, `packet.test.ts`; `90b1080` | Live part is SB1 |
| Done | UX2 tabs and theme | VERIFIED | `tabs.test.ts`, `contrast.test.ts` (119); UX2 part 2 record; `d76f93d`, `3647293` | — |
| Done | UX2 sheet | VERIFIED | `sheetSnap.test.ts` (34); `UX2-S1` to `S8`; `9c8eb06`, `c31b21f` | TalkBack untried (backlog 45) |
| Done | UX2 My Ride | VERIFIED | `planGuidance.test.ts`, `fareType.test.ts`; UX2 part 3 record; `ebfc0a5` | — |
| Done | UX2 local Check-in | UNVERIFIED | `localCheckin.test.ts`; no device record; `a6f89c5` | Run backlog 49 |
| Done | UX2 About | UNVERIFIED | No test, no device record; `403bedd` | Run backlog 51 |
| Done | F1 onboarding, greeting, avatars | VERIFIED | `avatarPick`, `greeting`, `destinations`, `profileStore` tests; `F1-M1` to `M4`; `149023e` | — |
| Done | F1 own-set picker | VERIFIED | `avatarPicker.test.ts`; Emjay's emulator run 2026-10-04; `b80aede` | — |
| Done | RR1 real lines for R3, R4, R5 | UNVERIFIED | `routeImport.test.ts`, `routing.test.ts` (several routes), `routeDb.test.ts` (stop membership), `contrast.test.ts` (three routes); agent's RR1-M1 to M3 run; `scripts/import-route.ts` | You check backlog 69; supply the missing legs (70) |
| Done | UX3 route lines only when selected | UNVERIFIED | `routeVisibility.test.ts` (14); agent's `UX3-M1` to `M4` run; `11b66b1` | You check backlog 65 to 67 |
| Done | Merge: location on Live | UNVERIFIED | `locationStore.test.ts` (9), `privacy.test.ts`; `29cc0b0`. App, My Ride, sheet and theme passed in Emjay's run (2026-10-04); **location tests pending** | You send the location results |
| Done | AF1 text cleanup and first-run hints | UNVERIFIED | `wordCount.test.ts` (≤ 8 words on the tabs, explainer ≤ 12, hints ≤ 6), `hintsStore.test.ts`; agent's AF1-M1 run | You check backlog 74 and 75 |
| Done | LB1a offline glyph proof | UNVERIFIED | `glyphInstall.test.ts`, `offlineMap.test.ts` (no `http(s)`, `file://` glyphs, glyph facts); agent's LB1a-M1 run; `docs/LABELS_PLAN.md` §7a | You check backlog 76; LB1b on approval |
| Done | AF2 repository interfaces and the Demo switch | UNVERIFIED | `repositories.test.ts` (switch, chip rule, backlog 68 reopen), `settingsStore.test.ts`, `privacy.test.ts` (demo sends nothing); agent's AF2-M1 run | You check backlog 77 and 68 |
| Done | AF3 demo vehicles on Live | UNVERIFIED | `demoVehicles.test.ts` (fixed seeds: speeds, stops, direction, silent vehicle, coverage 89/100/600 s, tiers 6/7/13, stopped over 45 s), `vehicleMarkers.test.ts`; agent's AF3-M1 run and 50-marker stress on the emulator | You check backlog 78; the partner's phone for 79 |
| 0 | R1a rebuild | BLOCKED | `app.json`, icons, `expo-system-ui` and `expo-splash-screen` in `package.json`; `29cc0b0`, `45f9798`, `cdc0bbb` | Skipped for now (Emjay, 2026-10-04) |
| 0 | ST1 smoke test | BLOCKED | — | R1a builds |
| 0 | ST2 records and fixes | NOT-STARTED | — | After ST1 |
| 1 | G0 location foundation | PARTIAL | Exists: explainer, permission, dot, follow, denied mode (`useLiveLocation.ts`). Missing: `consent.ts`, `accuracyGate.ts`, `consent.tsx`, fake source, "Use my location" | Write "start G0" |
| 2 | F2 Profile | NOT-STARTED | No `profile.tsx`, `username.ts`; Shuffle exists (F1) | After G0 |
| 2 | F3 suggestions | PARTIAL | `landmarks.placeholder.ts`, `destinationsStore.ts`, `destinations.test.ts`; no `suggest.ts`, no map tap | Real landmarks (you) |
| 2 | F4 route-first Check-in | NOT-STARTED | Route chips exist from UX2; no route-coloured dots, no fading | — |
| 2 | F5 badges | NOT-STARTED | No `badges.ts`, `countsStore.ts` | — |
| 3 | SB1 live backend + `app_config` + `team_accounts` rename | BLOCKED | Migration still says `telemetry_writers`; no `app_config` | "Supabase is ready" plus `.env` (you) |
| 3 | SB2 accounts, username, Energy | BLOCKED | — | SB1 |
| 4 | C1 cloud check-in | BLOCKED | No `checkin/rules.ts` | G0, SB1, R1b |
| 5 | L1 live map | BLOCKED | No `vehiclesStore.ts`, `coverage.ts`, simulator | SB1 |
| 5 | L2 tracking with ETA | BLOCKED | No `eta.ts` | L1, SB2 |
| 6 | T1 broadcast, RP1 report, N1 feed, V1 verification | BLOCKED | No `sendRule.ts`, `dev-broadcast.tsx` | L1, R1b; V1 needs the real polyline |
| 7 | B1 background | BLOCKED | No `backgroundLocation.ts` | T1, R1b, phone |
| 8 | BLE, driver app, SMS, moderation | NOT-STARTED | SMS protocol and RSSI functions only | Field data, phones, SIMs |

**Counts (35 rows):**

| Status | Rows |
| --- | --- |
| VERIFIED | 10 |
| UNVERIFIED | 9 |
| PARTIAL | 2 |
| NOT-STARTED | 5 |
| BLOCKED | 9 |

The phase 6 row covers four steps.

## 4. Documents and code that disagree

1. **`AGENTS.md`** still names `IMPLEMENTATION_PLAN_v2.md` (now in `docs/history/`). The one-line fix waits for your review; it is not committed.
2. **`device-tests.md`**: your merge test and the R1a build now have rows marked "not yet recorded, to be supplied by the user". The S0 phone row now says it passed for the partner's own code only. *(Fixed in wording; results still owed.)*
3. *(Fixed)* The "F1 to F5 are being built" notes now say only F1 exists.
4. *(Fixed)* `BACKEND_SETUP.md` marks `app_config` and the `telemetry_writers` rename as planned changes in SB1.
5. **PRD 7.1 and 15.1** require consent before location; the code asks without it (accepted until G0).
6. **On Live,** "Long-press the map to set your starting point" describes a pin that My Ride does not use yet.
7. **GPS plan G0** (now `docs/history/IMPLEMENTATION_PLAN_GPS.md`) names `locationSource.ts` and a "Fare" tab. The code has `services/location.ts` and no Fare tab.
8. **PRD 12.2** lists `avatar_id` in `profiles`. The code follows D3: the avatar is never in the cloud.

## 5. Next 5 steps

| # | Step | Who |
| --- | --- | --- |
| 1 | R1a build on the emulator (`npx expo prebuild --platform android --clean`, then `npx expo run:android`) and the merge tests | You |
| 2 | Push `main` when you decide; partner runs `git pull --ff-only`, `npm ci`, his EAS development build, then sends the template results | You, then the partner |
| 3 | Record both sets of results, the crash counts and the ST2 fixes | Agent |
| 4 | G0, on "start G0" | Agent |
| 5 | F2 to F5. Meanwhile prepare Supabase (`docs/BACKEND_SETUP.md` §3) | Agent; you |

## 6. Waiting on you

| Kind | Item |
| --- | --- |
| Builds | R1a on the emulator; later R1b (before C1) |
| Tests | The merge tests on the R1a build; backlog 49 (Check-in), 51 (About), 54 (own-set picker), 59 to 62 |
| Decisions | Master plan §10, questions 6 to 11: shorten the Live text now or in G0; validate the candidate trace; a UI test library; one R1b batch; consent review; faded-route opacity |
| Data | Real Route 4 polylines; stations and terminals; landmarks; official fare; vehicle list; Supabase values and two test accounts; Cebuano strings; username blocklists; DPO review of the consent text |
| Push | `main` (only you push) |
| Review | The one-line `AGENTS.md` change (plan path), not yet committed |
| Results | Your merge test and the R1a build results, for `device-tests.md` |
