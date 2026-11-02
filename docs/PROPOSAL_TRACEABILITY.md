# Proposal traceability

How each commitment of the thesis proposal (Chapters 1 to 3, April 2026) maps to the Android prototype as of commit `ba52745` (checked 2026-11-03 against the code, `docs/PRD.md` and the git history). Use it to update the final manuscript: sections 1 to 6 give the status of each commitment, section 7 the risks to prepare for the defense, and section 8 the proposal text to change, chapter by chapter. `docs/SCOPE_AND_LIMITS.md` describes the prototype for evaluators; `docs/PRD.md` holds every rule and its change history.

The previous version of this file (2026-10-17, commit `900f3c8`) is in the git history. Since then the driver module, verification, moderation, the background relay and the position upload were built, so most HIGH risks of that version are closed.

**Status:** REAL (works, with tests and a device or emulator check), BUILT (works in tests and Demo data; field test pending), DEMO (simulated data only, labelled), PARTIAL, NOT BUILT, CHANGED (built differently), DROPPED (deliberately not built), UNVERIFIED (not measured).

**Reason codes:** PANEL (the panel's Major Revision on the cost burden on drivers), TECH (feasibility), SCOPE (pilot scope), RESEARCH (literature or field finding), PRIVACY, TIME.

**Defense risk:** HIGH (a panelist can show the objective is unmet), MEDIUM (a difference that needs a prepared explanation), LOW.

**Evidence base:** 132 automated test suites and 1,801 tests (`npx jest`), lint and a strict typecheck before every commit; device checks on a Samsung Galaxy Note 10+ and the Android emulator, recorded in the build tracker; the driver side tested end to end on phones by the partner (DRG6, DR5, DR7).

## 1. Objectives

| # | Commitment | Status | Evidence | How it differs | Reason | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| O1 | Tracking architecture and a proximity-aware ETA algorithm | BUILT | Commuter relay uploads positions to the `ingest` Edge Function, which checks them and updates the live map through Realtime (`ingest.test`, `liveVehicles.test`); ETA in `shared/tracking/eta.ts` (`eta.test`): distance along the route at the recent speed, hidden under 5 km/h or beyond 10 km; tracking alerts at a chosen ETA | Positions come from commuters on board, not drivers. ETA accuracy has not been measured on real rides yet (field test E1) | PANEL | MEDIUM |
| O2 | Dynamic demand heatmap for the driver module | CHANGED | Commuter check-ins are counted per stop; the SMS worker texts the counts to the driver phone, which lists them per stop with the near-the-route counts (`src/driver/features/heatmap`, `sms.test`, worker tests) | A per-stop list of waiting commuters received by SMS, not a drawn map heatmap; works without mobile data on the driver's phone | PANEL (no data cost for drivers) | LOW |
| O3 | Standardised point-to-point fare with student, senior and PWD discounts | PARTIAL | `fare.test`, `fareType.test`; phone and emulator checks | ₱14.00 for the first 4 km and ₱2.00 per further km, 20 % off for students, seniors and PWD, offline for any two points. The values still need checking against the official fare order | TIME | MEDIUM |
| O4 | Consensus-based moderation and a reputation system (Trust and Merit Points) | BUILT | MOD1a and MOD1b (`moderation.test`, migration `20261102000002`): tagged flags weighted by trust, 3 flags hide a post, strikes from a moderator or automatic evidence, Merit shields, appeals, Trust Level on Profile | Consensus = weighted flags (3 hide a post); a strike needs a moderator or verified evidence; 2 strikes in 30 days give a 7-day suspension (no permanent ban); 1 Merit shield per 100 trust points, at most 3 | SCOPE, PRIVACY | LOW |
| O5 | Software-only implementation using phone GPS | CHANGED | No extra hardware; the commuter's phone sends GPS while relaying; the driver's phone acts as a Bluetooth beacon that proves which multicab the commuter is in | GPS from commuters on board (Relay), not from drivers; drivers need no mobile data | PANEL | MEDIUM |
| O6 | ISO/IEC 25010 evaluation (Likert; 35 commuters, 10 drivers, 5 IT experts) | NOT BUILT | Survey drafted in `docs/TESTER_SURVEY.md` (SUS for all, ISO/IEC 25010 ratings for IT experts); tester guide in `docs/TESTER_GUIDE.md` | Not run yet: the tester APK waits on the EAS build. Drivers now have a driver app to rate | TIME | HIGH |

## 2. Commuter module

| # | Commitment | Status | Evidence | How it differs | Reason | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | ETA viewing | BUILT | Vehicle card and tracking panel; `eta.test`; emulator and phone with Demo data | Live ETA needs a commuter relaying; accuracy unmeasured (O1) | TECH | MEDIUM |
| C2 | Live PUV map, viewport-centric icon priority, Selective Transparency | PARTIAL | Live map of relayed multicabs (Live, Estimated, Stale states); unpicked routes faded; a tracked multicab stays solid while others fade (`routeVisibility.test`, `vehicleMarkers.test`) | Selective Transparency built; viewport-centric icon priority not built; live markers shown to team accounts in this phase (PRD 0.7), others see relays in Crowdsource | SCOPE | MEDIUM |
| C3 | Route Discovery: From-To suggestions, route directory, offline guide | REAL | `routing.test`, `realRoutes.test`, `placeSearch.test`; phone and emulator, offline | From-To trip planner in My Rides with walks along the streets; route list on the Map; Ask Tunie answers trips offline | — | LOW |
| C4 | Fare calculator with automatic discounts, offline | PARTIAL | As O3; the discount follows the fare type set at sign-up or in Profile | Fare values to confirm | TIME | MEDIUM |
| C5 | Station Check-in: hardcoded stops, geofence, prompt at 5 min, purge at 15 min | REAL | `geofence.ts`, `checkinNear.test`, `localCheckin.test`; phone checks | Check in where you stand: within 40 m of a stop it counts there, elsewhere within 40 m of a route line it counts near the nearest stop. Ends when the commuter leaves (70 m) or at 15 min; "Did you board?" when a multicab stands at the stop and at 5 min. Costs 0.3 Energy per route pinged. Reminders stay inside the app | RESEARCH (commuters wait between stops) | LOW |
| C6 | Seat reporting, four tiers (Empty; Few 1-7; Almost Full 8-15; Full 16) | CHANGED | `shared/telemetry/occupancy.ts` | Three tiers by seats taken of 16: 0-6 "Seats available", 7-12 "Filling up", 13-16 "Full" | Simpler choice on a moving vehicle (reason not recorded in the PRD) | MEDIUM |
| C7 | Spatio-Temporal Handshake: 20 m proximity, Verified badge or unverified | CHANGED | V1a and V1b (`verifyWindow.test`, `ingest.test`, migration `20261102000000`); the relay form's Bluetooth check (`relayGate.test`) | Proximity is proven by the multicab's Bluetooth beacon instead of a 20 m GPS match. A relay is then verified on the move: 25 km/h for 20 s (or the phone's in-vehicle activity), within 30 m of the route line, 50 m travelled. Verified relays carry a "Verified ride" mark | TECH (GPS alone cannot tell two vehicles 20 m apart) | MEDIUM |
| C8 | Trust Points, Merit Points (1,000 to 1), strike shield, badges | CHANGED | `trust.test`, `moderation.test`, `badges.test` | Trust Points and Trust Level; Merit shields at 100 trust points each (at most 3), each cancels one strike; seven count badges | SCOPE | LOW |
| C9 | Report cooldowns, weekly limit of 15 | CHANGED | `backendRules.test`, `relayQueue.test` | No weekly limit. The same multicab cannot be relayed again within 3 hours; Energy is capped at 5; daily caps on trust points and flags | SCOPE | LOW |
| C10 | GPS Decay: stop after 10 min idle or when the app closes | CHANGED | `relayLimits.test`; background relay B1 | A relay ends at the destination, after 20 min standing still (30 min at a terminal), or when "Still riding?" gets no answer after 3 hours. It keeps running in the background with a notification only while sharing | TECH (traffic stops last longer than 10 min) | LOW |
| C11 | Profile: commuter type, frequent destinations, avatar or alias, 15-day edit cooldown | PARTIAL | `profileStore.test`, `destinations.test`, `avatarPicker.test` | Fare type, saved places, avatars and a username; no 15-day cooldown; everything but the username stays on the phone | PRIVACY | LOW |
| C12 | Strict Night Mode: only verified reports public in the evening | CHANGED | `is_night`, migrations `20261010000000`, `20261029000002`, `20261103000000`; `nodePassage.test` | 21:00 to 04:59 Manila time: the map shows no multicab at all; it shows the stops each route passed, at least 2 minutes late ("R4 passed CSU 3 min ago"). Relays still run and earn | PRIVACY (anti-stalking) | LOW |
| C13 | Report another commuter (flagging) | REAL | `crowd.test`, `moderation.test`; phone check | Flags a post with a reason (false location, spamming, not a PUV), not a person | — | LOW |
| C14 | Onboarding | REAL | Phone and emulator checks | Adds a location consent screen, an introduction, a tips tour and avatars | PRIVACY | LOW |

## 3. Driver module

| # | Commitment | Status | Evidence | How it differs | Reason | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Live coordinate broadcasting with a visibility toggle | CHANGED | Driver app runs a rotating Bluetooth beacon (`src/driver/features/beacon`); commuters on board relay the position | The driver's phone sends no coordinates and needs no data; position comes from commuters. The commuter chooses whether the relay shows on the live map or only in Crowdsource | PANEL | MEDIUM |
| D2 | Demand heatmap synchronised with check-ins | CHANGED | As O2 | Per-stop waiting counts by SMS, refreshed by the SMS worker | PANEL | LOW |
| D3 | Onboarding with ID upload and administrator approval | REAL | Driver self-registration with the CTTDM ID photo and the multicab photo; admin approves or rejects in the web console; photos deleted at the decision (partner's device tests DRG6) | As proposed, with photo deletion after review | PRIVACY | LOW |
| D4 | Automatic session end after 60 min stationary or when the app closes | CHANGED | The beacon runs while the driver app is on; the commuter relay ends by itself (C10) | The rule applies to the commuter's relay; the driver app has no session to end | PANEL | LOW |
| D5 | Profile edit with 15-day cooldown | DROPPED | — | The driver phone is set up once by registration; no editable driver profile | SCOPE | LOW |

## 4. Administrator

| # | Commitment | Status | Evidence | How it differs | Reason | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Moderation: 10 unique flags for a strike; two strikes for a permanent ban | CHANGED | As O4 | 3 weighted flags hide a post; strikes from a moderator or automatic evidence; 2 strikes in 30 days give a 7-day suspension with appeal; strikes expire after 60 days | Fairness: a temporary suspension with appeal instead of a permanent ban | MEDIUM |
| A2 | Driver credential verification | REAL | Web admin console (`admin/`): registrations queue, Approve and Reject with reason, Retire a driver phone | As proposed | — | LOW |
| A3 | Security audit log (device fingerprint, location snapshots for high-risk hours) | CHANGED | Ingest log for team writers (30 days); risk signals such as impossible speed (RK1); retention jobs | No device fingerprint or Play Integrity (a suspension binds to the account, D7); no location snapshots of commuters; night coordinates deleted after 24 hours | PRIVACY | MEDIUM |
| A4 | System analytics | NOT BUILT | — | The console covers registrations, drivers and settings only | TIME | MEDIUM |

## 5. Non-functional and technical

| # | Commitment | Status | Evidence | How it differs | Reason | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| N1 | Position synchronisation under 5 s | UNVERIFIED | Realtime push from the server; Primary and Secondary relay riders keep one position stream per multicab (BT1) | Not measured end to end yet (field test) | TECH | HIGH |
| N2 | TLS and Data Privacy Act compliance | PARTIAL | HTTPS to the backend; consent before location (version 3, with the background relay); Withdraw; Delete account; Row Level Security on every table; retention jobs; `privacy.test` (no avatar, gender or classification leaves the phone) | The consent text awaits the Data Protection Officer's review | PRIVACY | MEDIUM |
| N3 | Auto-TTL of check-ins and seat reports after 15 min | CHANGED | Check-ins end at 15 min; Crowdsource posts at 60 min (`FEED_LIFETIME_MIN`) | Seat reports live 60 min | Reason not recorded | LOW |
| N4 | Minimal bento UI, five-anchor bottom navigation | REAL | Bottom bar: Map, Check-in, Relay, My Rides, Crowdsource | Five tabs as proposed, with Relay in the middle; Profile from the avatar, Settings from the menu | — | LOW |
| N5 | React Native for Android and iOS; Node.js; Firebase or Firestore; Google Maps Platform; Google Cloud | CHANGED | `package.json`, `app.config.js`, `supabase/`, `services/sms-worker`, `render.yaml` | Expo (React Native) **Android only**; Supabase (PostgreSQL, Row Level Security, Edge Functions, Realtime); MapLibre with bundled offline OpenStreetMap tiles; the SMS worker runs on Node.js on Render; an Android gateway phone sends the SMS. No Firebase, Google Maps or Google Cloud | TECH, SCOPE (no paid map service; works offline) | MEDIUM |
| N6 | Offline caching of routes and fares | REAL | Route data, map, planner, fares and Tunie on the phone; Crowdsource keeps the last feed; airplane-mode checks | Bundled with the app rather than cached from a server | — | LOW |
| N7 | Routes 1 to 14 (also "all 7 routes") | CHANGED | Route data: R1, R2, R3, R4, R5, R14 (6 routes) | R14 return leg, six stops and the terminal list still being traced | SCOPE, TIME | MEDIUM |
| N8 | Devices with at least 4 GB RAM and 4G or 5G | PARTIAL | Runs on a Galaxy Note 10+ (development build) and the emulator | Other brands, battery and data use are field tests E3 to E5 | TIME | MEDIUM |

## 6. Additions not in the proposal

| Addition | Reason |
| --- | --- |
| Offline map of Butuan in the app, with offline place search | TECH: no paid map service; works without data |
| Bluetooth beacon on the driver's phone and the Smart Queue (a relay is held until the multicab moves off, so side-by-side multicabs at a terminal are not confused) | TECH: proves which multicab the commuter is in |
| Primary and Secondary relay riders (one position stream per multicab; the next rider takes over after 90 s) | TECH: battery and data on the commuter's phone |
| Background relay with a notification, and "Get ready to get off" 300 m before the commuter's stop | UX: the commuter can use other apps while relaying |
| SMS to drivers through a gateway phone and a worker on Render | PANEL: drivers need no mobile data |
| Energy (relays earn, tracking and check-ins spend; cap 5) | Fairness: those who share data get live data in return |
| Detours (known alternative lines, turned on by an admin, drawn dashed) | RESEARCH: bridge closures force detours |
| Ask Tunie: an offline assistant for trips, fares, the nearest stop and a commuter guide with Bisaya phrases | UX: visitors and first-time riders; no AI model, so the app stays small |
| Location consent screen, Withdraw, Delete account, another account on the same phone starts clean | PRIVACY (Data Privacy Act) |
| Night stop view | PRIVACY (anti-stalking) |
| Demo data mode, clearly labelled | TECH: every screen can be shown before real riders exist |
| Field test log and protocol (`docs/FIELD_TESTS.md`) | Evaluation: battery, data, background survival, Bluetooth in a multicab |

## 7. Defense risks

| # | Item | What a panelist could challenge | Evidence today |
| --- | --- | --- | --- |
| 1 | O6 (HIGH) | "Where are the evaluation results?" | Survey and tester guide ready; needs the tester APK and the test round |
| 2 | N1 (HIGH) | "Is synchronisation under 5 s?" | Realtime design; not measured; plan it in the field tests |
| 3 | O1, C1 (MEDIUM) | "How accurate is the ETA?" | `eta.test`; Demo data; field test E1 needed |
| 4 | O5, D1 (MEDIUM) | "Live data needs commuters to relay. What if nobody does?" | Energy rewards relays; Stale and Estimated states; "No data from riders right now" instead of a wrong marker; coverage nudge |
| 5 | C7 (MEDIUM) | "Why not the 20 m handshake?" | Bluetooth beacon plus the verification window; GPS error near 20 m cannot separate two multicabs |
| 6 | O3, C4 (MEDIUM) | "Is the fare official?" | Formula and discount tested; values to confirm |
| 7 | A1 (MEDIUM) | "Why no permanent ban?" | Suspensions with appeals; the account, not the device, is suspended (D7) |
| 8 | N5 (MEDIUM) | The proposal describes iOS, Firebase, Google Maps and Google Cloud | Section 8 lists every sentence to change; the offline map is the main reason |

## 8. Proposal text to change in the manuscript

Exact section numbers of the proposal could not be checked (the proposal is not in the repository); find each sentence by the commitment it states.

### Chapter 1

| Topic | What the proposal says | What to write now |
| --- | --- | --- |
| Objective 2 (O2) | Dynamic demand heatmap for the driver module | Per-stop waiting counts from commuter check-ins, sent to the driver's phone by SMS |
| Objective 4 (O4) | Trust and Merit Points | Trust Points and Trust Level, weighted flags, strikes, 7-day suspensions with appeals, Merit shields |
| Objective 5 (O5) | Phone GPS of drivers | GPS from commuters on board (Relay); the driver's phone is a Bluetooth beacon and receives SMS, with no mobile data |
| Scope: platform | React Native for Android and iOS | Android only (Expo, React Native) |
| Scope: routes | Routes 1 to 14; "all 7 routes" | Six routes: R1, R2, R3, R4, R5 and R14 |
| Limitations | — | Live data depends on commuters relaying; fare values to confirm; route data partly provisional; notifications inside the app only (except the relay notice); live markers for team accounts in this phase |

### Chapter 3: system design

| Topic | What the proposal says | What to write now |
| --- | --- | --- |
| Driver module (D1, D4) | Driver broadcasts coordinates; 60-min stationary end | Driver app runs a Bluetooth beacon; commuters relay the position; the relay ends at the destination, after 20 min still (30 at a terminal) or at the 3-hour check |
| Driver onboarding (D3) | ID upload and admin approval | As proposed: CTTDM ID and multicab photos, approved in the web console; photos deleted at the decision |
| Driver profile (D5) | 15-day edit cooldown | Dropped: the phone is set up once by registration |
| Seat reporting (C6) | Four tiers | Three tiers: 0-6, 7-12, 13-16 seats taken of 16 |
| Verification (C7) | 20 m Spatio-Temporal Handshake | Bluetooth beacon check, then the verification window (25 km/h for 20 s or in-vehicle activity, 30 m of the route, 50 m travelled); "Verified ride" mark |
| Merit and strikes (C8, A1) | Merit 1,000 to 1; 10 flags a strike; 2 strikes a permanent ban | Merit shield per 100 trust points (at most 3); 3 weighted flags hide a post; 2 strikes in 30 days give a 7-day suspension; appeals |
| Report limits (C9) | Cooldowns, 15 updates a week | Same multicab once in 3 hours; Energy cap 5; daily caps on trust points and flags |
| GPS decay (C10) | Stop after 10 min idle | Relay ends after 20 min still (30 at a terminal), at the destination, or at the 3-hour check; background sharing with a notification |
| Profile (C11) | 15-day edit cooldown | Not built; profile data stays on the phone |
| Night Mode (C12) | Only verified reports at night | 21:00 to 04:59: no multicab on the map; stops passed, at least 2 minutes late |
| Check-in (C5) | Hardcoded stops, geofence | Check in at a stop (40 m) or near the route line (40 m); costs 0.3 Energy per route; ends on leaving or at 15 min |
| Map (C2) | Viewport-centric icon priority | Not built; Selective Transparency built |
| Seat report lifetime (N3) | 15 min | 60 min in Crowdsource; check-ins 15 min |
| Navigation (N4) | Five-anchor bottom navigation | Five tabs: Map, Check-in, Relay, My Rides, Crowdsource |
| Technology (N5) | Node.js, Firebase or Firestore, Google Maps Platform, Google Cloud | Supabase (PostgreSQL, Row Level Security, Edge Functions, Realtime); MapLibre with offline OpenStreetMap tiles; SMS worker on Node.js (Render); Android gateway phone for SMS |
| Administrator (A3) | Device fingerprint, location snapshots | Not collected (privacy); suspensions bind to the account; night coordinates deleted after 24 hours |
| Administrator (A4) | System analytics | Not built |
| Fare (O3) | Standardised fare | ₱14.00 for the first 4 km, ₱2.00 per further km, 20 % discount; to confirm against the official fare order |
| New subsystems | — | Describe Energy, the Smart Queue, Primary and Secondary riders, detours, Ask Tunie, Demo data and the offline map |

### Chapter 3: methodology and evaluation

| Topic | What the proposal says | What to write now |
| --- | --- | --- |
| Evaluation (O6) | ISO/IEC 25010 Likert survey; 35 commuters, 10 drivers, 5 IT experts | SUS for all testers; ISO/IEC 25010 ratings for IT experts (`docs/TESTER_SURVEY.md`); drivers rate the driver app. Confirm the respondent counts with the adviser |
| Synchronisation (N1) | Under 5 s | State as a target, measured in the field tests |
| Requirements (N8) | 4 GB RAM and 4G or 5G | Tested on a Galaxy Note 10+ and the emulator; other brands in the field tests; offline features need no data, drivers need no data |
| Field experiments | — | E1 to E9 in `docs/FIELD_TESTS.md`: ETA accuracy, battery, data use, background survival, Bluetooth inside a multicab, beacons side by side at a terminal |
| Software testing | — | 1,801 automated tests in 132 suites, lint and typecheck before every change; device checklists in the build tracker |

### Chapters 4 and 5 (results, conclusions)

Nothing to copy yet. After the test round, report: the SUS score and ISO/IEC 25010 ratings, the field test results (ETA error, battery and data per hour, synchronisation delay, Bluetooth signal and calibration), and the share of checklist steps passed on phones.
