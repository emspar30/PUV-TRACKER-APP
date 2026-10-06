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
| Done | LB1 licences screen | UNVERIFIED | `licences.test.ts`; agent's run | You check backlog 80 |
| Done | RR2 first-pass snapping, terminal trim, Draft chips | UNVERIFIED | `firstPass.test.ts`, `trimDraft.test.ts`, `routing.bench.test.ts`; agent's run; stored lines not rewritten | You check backlog 81; decide 82 |
| 0 | R1a rebuild | BLOCKED | `app.json`, icons, `expo-system-ui` and `expo-splash-screen` in `package.json`; `29cc0b0`, `45f9798`, `cdc0bbb` | Skipped for now (Emjay, 2026-10-04) |
| 0 | ST1 smoke test | BLOCKED | — | R1a builds |
| 0 | ST2 records and fixes | NOT-STARTED | — | After ST1 |
| 1 | G0 location foundation | PARTIAL | Exists: explainer, permission, dot, follow, denied mode (`useLiveLocation.ts`). Missing: `consent.ts`, `accuracyGate.ts`, `consent.tsx`, fake source, "Use my location" | Write "start G0" |
| 2 | F2 Profile | NOT-STARTED | No `profile.tsx`, `username.ts`; Shuffle exists (F1) | After G0 |
| 2 | F3 suggestions | PARTIAL | `landmarks.placeholder.ts`, `destinationsStore.ts`, `destinations.test.ts`; no `suggest.ts`, no map tap | Real landmarks (you) |
| 2 | F4 route-first Check-in | NOT-STARTED | Route chips exist from UX2; no route-coloured dots, no fading | — |
| 2 | F5 badges | NOT-STARTED | No `badges.ts`, `countsStore.ts` | — |
| 3 | SB1 commuter-side database (**applied 2026-10-05**) | VERIFIED (live) | `db push` applied `20261003000000_v0_core.sql`; seed, team account and `pg_cron` retention jobs pasted by Emjay; `ingest` deployed by Emjay; `npx jest tests/integration` 15 of 15 passed. Live map readable by team accounts only; night hides moving vehicles only. `delete_my_account` not run live (it would delete the test account). **Open sign-up** `20261005000000_open_signup.sql` applied 2026-10-05 with `npx supabase db push` (dry run first: only that file pending); any signed-in account now reads the map, checks in, reports and uses Energy | — |
| 3 | SB2 accounts, username, Energy | PARTIAL (unit + live functions; not seen on the emulator) | Energy repository behind the Demo switch: `data/demo/demoEnergy.ts` (in-memory ledger on the shared rules), `data/live/liveEnergy.ts` + `services/energy.ts` (refill, balance, `energy_enabled`, newest 20 ledger rows, `start_tracking`), `state/energyStore.ts` (refresh on start, sign-in, Demo switch, return to the app). Top bar balance; Profile balance and history; Track pays through `start_tracking`: the demo wallet charges (`ENERGY_ENABLED_DEMO`), live charges only once `app_config.energy_enabled` is on; asks to sign in on live data, ends after 30 min. A new wallet starts at 1 (one refill; cap 5). Refill countdown in the top bar and Profile (`nextPassiveRefillMs`), refreshes when due. Username: sent on sign-in or edit while signed in, taken from the account when the phone has none, "taken" shown in Profile; phone-side blocklist (reserved names, small English list) in config. `energy.test.ts` 14 tests; live suite 16 of 16 | Check on the emulator; turn on `energy_enabled` on the live project (approval); Cebuano and full English blocklists (you, before launch) |
| 4 | C1 cloud check-in | PARTIAL (unit + live suite 16/16; not seen on the emulator) | Geofence on the phone (`shared/checkin/geofence.ts`: 60 m radius, 25 m accuracy, simulated stop trusted, pin refused); `CheckinsRepository` demo (`data/demo/demoCrowd.ts`, made-up others + own, earns into the demo wallet) and live (`data/live/liveCrowd.ts` + `services/crowd.ts`: `check_in`, `checkin_counts`, `end_check_in`); counts in a station list, reloaded every 30 s. Sheet after Google Maps' place sheet (`features/checkin/CheckInParts.tsx`): peek row with the nearest or tapped station, distance, waiting and Check in; while active a countdown pill, three fact tiles, an expiry bar and the two endings. Refusals and failures use the app's dialog (`components/Dialog.tsx`, `state/dialogStore.ts`), which replaced every system alert. Migration `20261006000000_checkin_end.sql` APPLIED 2026-10-05: `energy_enabled = true` only (`end_check_in()` already existed in v0_core). Live tests: parked test vehicle (Night Mode hides moving ones), tracking test expects the 1 Energy spend. `crowd.test.ts` 14 tests | Emulator check; 5-min reminder |
| 5 | L1 live map | PARTIAL (unit only) | `liveRow.ts` (row to snapshot, line by heading), `data/live/liveVehicles.ts` (load, Realtime, reload every 30 s, 5 s age tick), `services/liveVehicles.ts`, `scripts/sim-ingest.ts`; `liveVehicles.test.ts` 13 tests. Used with Demo data off. Not yet run against the live project or seen on the emulator | Emjay approves `npx tsx scripts/sim-ingest.ts`; check on the emulator |
| 5 | L2 tracking with ETA | BLOCKED | No `eta.ts` | L1, SB2 |
| 6a | RP1 report | PARTIAL (unit; not seen on the emulator) | Report button on the Live tab, `features/report/ReportSheet.tsx`: route, preset phrase, optional seat tier, dev-only vehicle picker (D5), with GPS when the fix is 30 m or better or the stop is simulated; `post_report` live, demo posts earn into the demo wallet. Crowdsource tab reads `feed_posts` live and shows own demo posts | Emulator check; flagging (N1); live-map broadcast (T1) |
| 6b | N1 real feed | PARTIAL (unit; not seen on the emulator) | Crowdsource reads `feed_posts` (RP1); each post shows a neutral badge from the handle (`shared/feed/badge.ts`, FNV hash into `FEED_BADGES`, 6 colours per theme, AA-checked in `contrast.test.ts`), never the avatar (D2). Flag button on other people's posts: themed confirm, `flag_post` live (`ReportsRepository.flag`), the post hides for the flagger at once and for everyone at 3 flags; own posts show "You". `feedBadge.test.ts` 3 tests, live flag mapping in `crowd.test.ts` | Emulator check; "nearby stop" field needs a `post_report` change |
| 6c | UI pass 2 (Check-in card, multi-route ping, Live map, My Rides, Crowdsource) | PARTIAL (unit and live 16/16; not seen on the emulator; migration 20261007 applied 2026-10-06) | Check-in: the draggable sheet is replaced by one floating card (route chips, nearest or tapped station with distance, walk time, waiting, Check in; while active the countdown, expiry bar and both endings side by side, never behind a swipe); route lines at 30% opacity; floating location pills removed. Shared stops (2+ routes, `routesAtStop`) show "Ping routes" (All or each): `check_in_routes(routes[], station, key)` in `20261007000000_checkin_routes.sql` writes one row per route, earns once; one route still uses `check_in`. Dialog: in-app overlay with fade and spring (no system Modal), Back closes it. Live: Report renamed Relay, icon-only round button; zoom-out button and direction labels/swap removed; vehicles drawn as a rotating top-down multicab icon (`assets/map/puv*.png`, `scripts/make-puv-icon.py`) with a seat-tier halo, no cone; tracking ETA falls back to the vehicle's next stop when there is no usable boarding point, `ETA_MAX_KM` 30; alert button green when on; the screen no longer re-renders on every camera move. My Rides: map moved out of the scroll view; routing benchmark removed. Crowdsource: only updates without GPS (`with_gps = false`); skeleton cards while loading; posts fade in, flagged ones fade out | Emulator check; GPS relays onto the live map is T1 |
| 6d | UI feedback B1 (motion and cleanups, `docs/UI_FEEDBACK.md`) | PARTIAL (unit; not seen on the emulator) | Dialog card eases up instead of a spring (no bounce, `dialogDamping` removed). Every stack page, the menu included, slides in from the right over the whole screen; the menu is a full page (`Screen`) with no dimmed backdrop, and Back from an item returns to it. Tracking: one update time (Last updated; Synced removed), alert button blue when on, Stop is red. Check-in: expiry bar removed (the countdown stays), Demo/Shared and not-verified pills removed. Crowdsource: Demo chip removed. My Rides: Sample data chip removed. Fix after the emulator check: the Check-in card lost its layout transition, which on an absolute, bottom-anchored view grew the card downward under the tab bar; seen fixed on the emulator (both card heights) | B2 to B8 |
| 6e | UI feedback B2 (tracking) | PARTIAL (unit; emulator: track, ETA round the loop, route switch, bar, jump back seen; distance toasts not seen live) | `routing/loop.ts`: `withReturnLegs` adds a reversed stand-in leg (`~back`) for one-leg routes (R4, R5), `routeRound` orders a route's legs. Demo vehicles drive the looped lines: no layover or jump back; stops 8 to 20 s, terminals 50 to 90 s (Stopped still shows). `etaTo` follows the round, so after passing the commuter the ETA counts to the next pass (`round: false` keeps the old one-leg rule for route ranking); `ETA_MAX_KM` 60; next stop wraps to the next leg (`trackProgress`, `nextStopOf`). `trackingStore` (zustand) holds the session: picking another route or closing the route card no longer ends it; a second feed follows the tracked route on other routes and tabs; a TrackingBar on other routes and a Crosshair round button jump back to the vehicle. In-app distance alerts (`crossedDistance`, `TRACK_DISTANCE_ALERTS_M` 1000/500/250/100) while the alert is on: vibration plus a toast (`toastStore`, `ToastHost` at the root, `TOAST_VISIBLE_MS`); no system notifications | R4/R5 stand-in legs turn at both ends until their other leg is traced; map framing leaves empty space below a route (moved to B8) |
| 6f | B2 fix: forward distance on lines that use a street twice | DONE (unit; real-data probe; emulator) | R4's line runs in and out of its downtown loop on the same street, and the nearest-point snap could put the vehicle or the commuter on the wrong pass (jumps of up to 31.7 km in a probe). `routing/progress.ts`: `vehicleChainageKm` picks, among passes within `LIVE_LINE_TIE_M`, the one whose direction matches the vehicle's heading; `passesKm` lists every pass by a point, and the ETA takes the first one ahead (then the next legs). Stops and next stop count each pass. Probe on the shipped R3/R4/R5 data over two demo rounds: shown distance within 0.06 km of the distance actually driven to the pass. The distance now reads "by road" | — |
| 6g | R4 goes round: derived outbound (closes_back) | DONE (unit; real-data probe; emulator) | `route_4_primary_updated.geojson` was already the R4 line, but it is open: De Oro to downtown, ending on J C Aquino Ave where it passed at 12.72 km. With one leg, the demo's stand-in drove the whole line backwards, against the arrows. New import rule `closes_back` (`closesBackAtKm`, `ROUTE_CLOSE_BACK_M` 30, `ROUTE_CLOSE_BACK_MIN_GAP_M` 1000) derives the outbound from the end back along the first 12.72 km to De Oro (12.74 km); seed regenerated, `ROUTE_DATA_VERSION` 4. Demo R4 vehicles now drive OUT then RET with no layover, restart or stand-in leg; the only turn is at De Oro. My Ride now finds MCA→DEO and RCA→DEO (R4 outbound, 12.74 km). R5 has the same shape (closes back at 15.99 km) but still uses the stand-in | — |
| 6h | R5 goes round; tracking ends on arrival | DONE (unit; real-data probe; emulator for R5 data) | R5 uses `closes_back` too (no terminal trim): outbound 16.00 km back to Santo Niño; `ROUTE_DATA_VERSION` 5; the unused terminal constant left the import script. Tracking ends by itself when the multicab reaches the commuter's boarding point: `hasArrived` (within `TRACK_ARRIVED_M` 50 m, or within `TRACK_ARRIVED_PASS_M` 200 m and then a jump of more than that, so a pass between readings counts and GPS wobble does not; never on the first reading). Alert on or off, it stops the session, vibrates and shows a "Your multicab has arrived" toast. Probe at the 1 s demo tick: fires at each pass within 50 m (R4 JCA 3 passes, R5 2). Dev note: Fast Refresh can store a new route data version before the regenerated lines land; on the emulator the route database was deleted and rebuilt (twice) | — |
| 6i | UI feedback B3 (Check-in) | PARTIAL (unit; emulator: all stops, filter, station card, check in, tab dot, minimise, farewell seen; the 5-minute reminder not seen live) | Every route's stations and faint lines show by default; an All chip and the route chips filter them (fixes the R4 dots that stayed with R3 picked). The station card follows Google Maps' place sheet: nearest or selected, name, distance, walk, waiting, "Routes here" badges, Ping routes at a shared stop (default: the filtered route, else every route there), full-width Check in. Waiting counts of the shown routes are merged per station, larger count kept (`shared/checkin/waiting.ts`). A Locate round button (simulated stop or G0 Locate me with its explainer) and a chevron that shrinks the card to one row (`CompactBar`). "I boarded" shows a Safe travel card for `CHECKIN_FAREWELL_S` (6 s). A red dot on the Check-in tab icon while checked in (`useActiveCheckIn`, re-renders at expiry only). `CheckInReminder` at the tabs: an in-app toast `CHECKIN_REMINDER_MIN` (5) minutes into a check-in when Check-in is not in front (`reminderAtMs`) | — |
| 6j | UI feedback B4 (Relay form) | PARTIAL (unit; emulator: new order, R3/R5 empty destinations, send with GPS, sharing bar, auto-end at the destination with toast, Bluetooth card with a temporary fake vehicle; migration 20261008 pushed 2026-10-06, live test of a seats-only relay passes) | Relay panel order: vehicle (Bluetooth card from `useBleVehicle`, a slot that returns null until the BLE module; else Route chips and the dev vehicle picker), Seats (required), What's happening (optional; `feed_posts.phrase` nullable in migration 20261008), Destination (the route's stops in riding order, `inRouteOrder`, minus the stop the rider is at), Share with GPS (needs a destination). Sent with GPS, `relayStore` keeps a session; `useRelayBroadcast` ends it within `RELAY_DESTINATION_ARRIVED_M` (100 m) of the destination or after `RELAY_BROADCAST_MAX_MIN` (90), with a vibration and toast; `RelayBar` on the Map shows it with Stop. No position upload yet: that is T1. R3 and R5 have no stops, so they relay without GPS only | — |
| 6k | UI feedback B5 (My Rides) | PARTIAL (emulator: normal size with fields pinned and results scrolling below them, a planned trip, bigger map with From and To still shown; shrinking back not re-seen after the emulator lagged) | From, To and the stop chips sit in a fixed block under the map in both sizes; only the results (hint, fare, suggested and other routes, recent rides) scroll, in a bounded `flex: 1` area, so nothing scrolls under the map. The map takes `MAP_SHARE` (0.3) of the window; made bigger it takes the free space and the results hide until it is made smaller. The blank band at the top of the bigger map is the edge of the offline tiles (B8 framing) | — |
| 6l | UI feedback B6 (Crowdsource) | PARTIAL (unit and migration text; emulator: compact demo cards with multicab, Trusted badge and "Near" stop; migrations 20261009 pushed 2026-10-06, live tests 17/17 incl. stop, Trusted flag, capped points, hidden server column, old post_report) | Compact post card: route badge, multicab ID (or "Multicab"), Trusted pill, time and Flag on one row; seats dot, seats and status on the next; "Near <stop>" when the relay named one. The author's handle badge is gone (handle kept for the flag's label). A relay sends the nearest stop of any route within `FEED_STOP_NEAR_M` (500 m) of the phone, GPS or not (`relayStopCode`, code only). Migration 20261009000000: `feed_posts.stop_code`, a seven-argument `post_report(..., stop, request_key)` beside the old one. Migration 20261009000001: `profiles.trust_points`, `app_config.trust_badge_points` (5), `feed_posts.author_trusted`; triggers add a point per check-in call and per relay, at most `trust_daily_max` (3) a Manila day (`trust_award`), and take a relay's point back at its first flag from someone else if it earned one (`feed_posts.trust_earned`, server-only). Card spacing fix: the card's 16 dp padding, route/multicab/Trusted on the left (wrapping) and time/Flag on the right, 12 dp between rows, a 32 dp Flag with a 48 dp touch target. The Demo badge on Profile's Energy row is removed | — |
| 6m | UI feedback B7 (Profile) | PARTIAL (unit; emulator: avatar grid hidden until the avatar is tapped and closed after a pick, pencil edit with save and cancel, fare type dropdown, trust progress line; the Trusted badge seen with a temporary forced value; live trust points not seen in the app) | The header card: the avatar (tap: the 12 or 6 avatar choices, closed after a pick), `@handle` with a pencil for inline editing (check saves, X cancels; hint and errors under it), the trust line ("n of 5 toward Trusted" or "Trusted commuter") and `FareTypeDropdown` (one row; the four types drop below). Shuffle moved to the introduction's avatar step only. B7 completion: Tracking Energy as its own card under the info card (balance / 5 and a progress bar, refill line); Storage and Location history rows removed; "General history" (Energy entries and boarded rides, newest first, `shared/profile/history.ts`) folded until tapped, with Clear history (hides what came before on this phone, `historyStore`; Energy and ride counts unchanged). `TrustedAvatar` puts a green shield at the avatar's bottom right once Trusted, on Profile and in the top bar. Trust points: `shared/profile/trust.ts` (daily cap like the server); `trustStore` reads `profiles.trust_points` on live data (when Profile opens and after a check-in or relay) and counts the phone's own check-ins and relays in the demo; Reset app clears it | — |
| 6 | T1 broadcast, V1 verification | BLOCKED | No `sendRule.ts`, `dev-broadcast.tsx` | L1, R1b; V1 needs the real polyline |
| 7 | B1 background | BLOCKED | No `backgroundLocation.ts` | T1, R1b, phone |
| 8 | BLE, driver app, SMS, moderation | NOT-STARTED | SMS protocol and RSSI functions only | Field data, phones, SIMs |

**Counts (37 rows):**

| Status | Rows |
| --- | --- |
| VERIFIED | 10 |
| UNVERIFIED | 11 |
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
