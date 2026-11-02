# Proposal traceability

How each commitment of the thesis proposal (Chapters 1 to 3, April 2026) maps to the Android prototype as of commit `ba52745` (checked 2026-11-03 against the code, `docs/PRD.md` and the git history). Use it to update the final manuscript: sections 1 to 6 give the status of each commitment, section 7 the risks to prepare for the defense, and section 8 the manuscript text to change, by section and page. `docs/SCOPE_AND_LIMITS.md` describes the prototype for evaluators; `docs/PRD.md` holds every rule and its change history.

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
| O6 | ISO/IEC 25010 evaluation: functional suitability, performance efficiency, usability (Likert; 35 commuters, 10 drivers, 5 IT experts, section 3.7.2) | NOT BUILT | Survey drafted in `docs/TESTER_SURVEY.md` (SUS for all, ISO/IEC 25010 ratings for IT experts); tester guide in `docs/TESTER_GUIDE.md` | Not run yet: the tester APK waits on the EAS build. Drivers now have a driver app to rate | TIME | HIGH |

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

## 8. Manuscript text to change

Checked against the manuscript PDF "A Mobile-Based Real-time Public Utility Tracker and Crowdsource Commuter Assistance Application" (82 pages; Chapters 1 to 3). Page numbers are the printed page numbers. Each row gives what the manuscript says now and what to write instead; the reason for each change is in sections 1 to 6.

### Chapter 1. Introduction

| Section (page) | What the manuscript says | What to write now |
| --- | --- | --- |
| 1.1 Background (3) | A verification framework with "proximity-based validation" and "automated signal expiration" | Keep the idea; the proximity proof is the multicab's Bluetooth beacon plus the verification window on the move (C7), and check-ins and posts still expire |
| 1.3 Objective 2 (6) | A dynamic demand heatmap for the driver module "to visualize passenger clusters" | A demand view for drivers: waiting commuters per stop, from check-ins, sent to the driver's phone by SMS (no mobile data needed) |
| 1.3 Objective 4 (6) | Moderation engine and reputation system (Trust and Merit Points) | Keep; add that flags are weighted by trust and strikes lead to temporary suspensions with appeals |
| 1.3 Objective 5 (6) | Uses "the existing GPS sensors of mobile devices" | Keep; name the source: the phones of commuters on board, with the driver's phone as a Bluetooth beacon |
| 1.3 Objective 6 (7) | ISO/IEC 25010: functional suitability, performance efficiency, usability | Keep. If the tester survey's SUS is used, add it here |
| 1.5.1 Scope (9) | Routes 1 through 14; multicabs, standard jeepneys and modernized e-jeeps | Six multicab routes: R1, R2, R3, R4, R5 and R14 |
| 1.5.1 Commuter (9) | "Station Finterface" (typo) with geofence validation | "Station Check-in": at a stop (within 40 m) or near the route line (within 40 m), with an Energy cost of 0.3 per route |
| 1.5.1 Commuter (9) | Spatio-Temporal Handshake, 20 m proximity | Bluetooth beacon check in the Relay form, then the verification window: 25 km/h for 20 s (or in-vehicle activity), within 30 m of the route line, 50 m travelled; a "Verified ride" mark |
| 1.5.1 Commuter (9) | Badges and hidden Merit Points as a strike shield against "automated banning" | Trust Points, Trust Level and badges; one Merit shield per 100 trust points (at most 3) cancels a strike; no automated permanent ban |
| 1.5.1 Commuter (9) | Dynamic cooldowns; GPS Decay stops polling after 10 min idle or when the app closes | The same multicab cannot be relayed again within 3 hours. A relay ends at the destination, after 20 min standing still (30 at a terminal), or at the 3-hour "Still riding?" check; it may keep sharing in the background, with a notification, only while the commuter relays |
| 1.5.1 Driver (9 to 10) | Background location broadcasting, a heatmap, ID approval, session end after 60 min stationary | The driver app sends no location: it runs a Bluetooth beacon and shows waiting counts received by SMS. Registration with the CTTDM ID and multicab photos, approved by an admin; photos deleted at the decision |
| 1.5.1 Administrator (10) | A strike after 10 unique flags | 3 weighted flags hide a post for review; a strike comes from a moderator or automatic evidence; 2 strikes in 30 days give a 7-day suspension; strikes expire after 60 days |
| 1.5.1 Technology (10) | React Native for Android and iOS; cloud backend | Expo (React Native), Android only (Android 8.0 or newer); Supabase backend |
| 1.5.1 Data (10) | Collects full name, email and contact number of users | Commuters: email and a username only; avatar, fare type and saved places stay on the phone. Drivers: phone number and registration photos (photos deleted after review) |
| 1.5.1 Privacy (11) | Strict Night Mode: only verified reports at night | 21:00 to 04:59: no multicab on the map; only the stops each route passed, at least 2 minutes late |
| 1.5.1 Audit (11) | A security audit log | Ingest log for team writers, risk signals and strikes; no device fingerprint (suspensions bind to the account) |
| 1.5.2 Network (11) | Live features need 3G, 4G or 5G | Keep; add that the map, planner, fares, Ask Tunie and the last Crowdsource feed work offline, and that drivers need no mobile data |
| 1.5.2 Data integrity (11 to 12) | Spatio-Temporal Handshake and consensus moderation | Bluetooth check, verification window and weighted flags |
| 1.5.2 Moderation (12) | Weekly limit of 15 updates; 10 reports for a strike | Energy cap of 5, same multicab once in 3 hours, daily caps on trust points and flags; strike rules as above |
| 1.5.2 Static mapping (12) | Routes 1 through 14; no temporary closures or detours | Six routes; known detours are supported (turned on by an admin, drawn dashed); unknown detours are reported to the admin |
| 1.5.2 Privacy (12) | GPS Decay ends location requests when the app closes; no continuous history | Location is used only while checking in or relaying; a relay may continue in the background with a notification and the commuter's consent. Raw positions are deleted on a schedule (night coordinates after 24 hours); the rider's identity never reaches the map |
| New limitation | — | Live data depends on commuters relaying; live markers are limited to team accounts in this phase; fare values are provisional; notifications stay inside the app except the relay notice |

### Chapter 2. Review of Related Literature

| Section (page) | What the manuscript says | What to write now |
| --- | --- | --- |
| 2.1 and 2.1.1 (13 to 16) | System quality through the React Native front end, a cloud database and the GPS Decay Algorithm; information quality through the Spatio-Temporal Handshake | Keep the D&M framing; replace "GPS Decay Algorithm" with the relay's automatic end rules, and "Spatio-Temporal Handshake" with the Bluetooth check and verification window |
| 2.2.3 and 2.3 (25 to 37) | The driver module's dynamic demand heatmap | Keep the literature; say the prototype delivers the demand view as per-stop counts by SMS, which suits drivers without mobile data |

### Chapter 3. Methodology

| Section (page) | What the manuscript says | What to write now |
| --- | --- | --- |
| 3.3.1 Phase III (40) | React Native with the Cloud Database and Google Maps SDK | Expo (React Native) with Supabase and MapLibre (offline OpenStreetMap tiles) |
| 3.3.2.1 Commuter (41) | Viewport-centric map interaction | Not built; describe Selective Transparency and the Live, Estimated and Stale marker states |
| 3.3.2.1 Commuter (41) | Four seat tiers: Empty, Few 1-7, Almost Full 8-15, Full 16 | Three tiers by seats taken of 16: 0-6 "Seats available", 7-12 "Filling up", 13-16 "Full" |
| 3.3.2.1 Commuter (42) | 20 m background proximity check, Verified Badge | As in 1.5.1: Bluetooth beacon, then the verification window; "Verified ride" mark |
| 3.3.2.1 Commuter (42) | Check-in: prompt at 5 min, purge at 15 min | Keep; add check-in near the route, "Did you board?" when a multicab stands at the stop, and the end when the commuter walks away (70 m) |
| 3.3.2.1 Commuter (42) | Fare lookups for "the 14 urban routes" | Six routes; ₱14.00 for the first 4 km, ₱2.00 per further km, 20 % discount; provisional until the official fare order is confirmed |
| 3.3.2.1 Commuter (42) | Directory of "all 7 Butuan City routes" | Six routes (R1 to R5, R14); From-To planner in My Rides with walking legs |
| 3.3.2.1 Commuter (43) | Profile edit, 15-day cooldown | Not built; profile data stays on the phone |
| 3.3.2.1 New commuter features | — | Relay (share the multicab's position and seats, live map or Crowdsource only), Energy, Ask Tunie, tracking with arrival alerts, "Get ready to get off" on a relay |
| 3.3.2.1 Driver (43) | Live coordinate broadcasting with a status toggle | Bluetooth beacon; position comes from commuters relaying |
| 3.3.2.1 Driver (43) | Dynamic demand heatmap | Waiting counts per stop by SMS, including commuters waiting near the route |
| 3.3.2.1 Driver (43) | Administrative onboarding | Keep: self-registration with ID and multicab photos, the phone number verified by SMS, admin approval |
| 3.3.2.1 Driver (43) | Driver profile edit, 15-day cooldown | Dropped: the phone is set up once by registration; an admin can retire it |
| 3.3.2.1 Administrator (43) | 10 flags a strike; 2 strikes (20 reports) a permanent auto-ban | As in 1.5.1, with appeals reviewed by the admin |
| 3.3.2.1 Administrator (44) | Fingerprint audit trail and location snapshots | Not collected (privacy); ingest log, risk signals and strikes instead |
| 3.3.2.2 Performance (44) | Synchronisation under 5 s | Keep as the target; report the measured value from the field tests |
| 3.3.2.2 Security (44) | Strict Night Mode, momentary GPS polling, anonymous avatars | Night Mode as in 1.5.1; avatars stay on the phone; Row Level Security on every table |
| 3.3.2.2 Reliability (44) | Auto-TTL for seat reports and check-ins | Check-ins end at 15 min; Crowdsource posts at 60 min |
| 3.3.2.3 Business rules (45) | Merit at 1,000 Trust Points to 1; a strike after 10 flags; drivers not peer-reported | Merit shield per 100 trust points (at most 3); strike and suspension rules as above; drivers are still managed by the admin |
| 3.4 Use Case, Figure 3.2 (46 to 47) | "Broadcast Live Trip Status" for drivers; "Execute Automated Banning"; ETA from the driver's GPS | Redraw: commuter use cases Relay, Track a multicab, Check in, Plan a trip, Ask Tunie, Flag; driver use cases Register, Run beacon, View waiting counts; admin use cases Approve drivers, Retire a phone, Review flags and appeals, Turn on detours. ETA from the relaying commuter's GPS |
| 3.4 ERD, Figure 3.3 (48 to 49) | Twelve entities, with merit_points, Seat_Report_Log, device_fingerprint and user_location_snapshot | Redraw from the Supabase tables. Main ones: profiles, vehicles, vehicle_beacons, telemetry_latest, telemetry_raw, relay_sessions, checkins, feed_posts, feed_flags, strikes, appeals, energy_ledger, node_events, driver_registrations, driver_devices, sms_outbox, route_alternatives. No device fingerprint or location snapshot |
| 3.5 Figure 3.4, commuter flow (50 to 52) | Permanent auto-ban above 2 strikes; GPS Decay at 10 min idle or app close | Suspension with appeal; relay end rules as in 1.5.1 |
| 3.5 Figure 3.5, driver flow (53 to 54) | Heatmap only online; 15-day edit cooldown; GPS broadcast ends after 60 min idle | Registration, admin approval, beacon running, waiting counts by SMS (works offline); no profile edit; no driver GPS |
| 3.5 Figure 3.6, context diagram (55 to 56) | Google Maps API and Firebase; admin gets system analytics | External entities: Supabase, Render (SMS worker), the SMS gateway phone, OpenStreetMap data; no analytics screen in the admin console |
| 3.5 Figure 3.7, architecture (57 to 59) | Google Maps API calls; backend computes ETA from driver and commuter coordinates (v = d / t); local sync loop | Phone: Expo app with MapLibre and offline tiles; the ETA is computed on the phone from the distance along the route at the recent speed. Server: Supabase (PostgreSQL, Row Level Security, the `ingest` Edge Function, Realtime). SMS: worker on Render and an Android gateway phone. Route data and the map ship inside the app |
| 3.5 Figure 3.8, commuter wireframes (60 to 61) | Five anchors: Home, Route Discovery, Station Check-in, Crowdsourced Reports, Menu; fare calculator in the menu | Replace with screenshots of the built app: Map, Check-in, Relay, My Rides (planner and fare), Crowdsource; Profile from the avatar; Settings and Ask Tunie from the top bar and menu |
| 3.5 Figure 3.9, driver wireframes (62 to 63) | Heatmap with an Online/Offline broadcast toggle; driver profile with cooperative and statistics | Replace with the driver app's screens: Register, waiting for approval, the beacon status and the waiting counts per stop |
| 3.6.1 Software (64) | React Native for Android and iOS; Node.js; Firebase/Firestore; Google Maps Platform; Android 10 or higher | Expo SDK 57 (React Native, TypeScript), Android only, Android 8.0 or newer; Supabase (PostgreSQL, Edge Functions, Realtime); MapLibre with offline OpenStreetMap tiles; the SMS worker in Node.js on Render; a web admin console (React, Vite) |
| 3.6.1 Hardware (64) | 4 GB RAM; 4G or 5G; Google Cloud hosting | A phone with GPS and Bluetooth LE, Android 8.0 or newer (tested on a Galaxy Note 10+); data needed only for live features; Supabase and Render hosting; one Android phone with a SIM as the SMS gateway |
| 3.6.2 Testing (65 to 66) | Spatio-Temporal Handshake review; under 5 s; 15-minute seat report lifecycle | Add the automated tests (1,801 tests in 132 suites, lint and typecheck before every change) and the device checklists; seat reports in Crowdsource last 60 min; field tests E1 to E9 (`docs/FIELD_TESTS.md`) |
| 3.7.1 Locale (66) | Routes 1 through 14; multicabs, jeepneys and e-jeeps | Routes R1 to R5 and R14; multicabs |
| 3.7.2 Participants (66 to 67) | 50: 35 commuters, 10 drivers, 5 IT experts; drivers test GPS broadcasting and heatmaps | Keep the counts if the adviser agrees; drivers now test the beacon and the waiting counts by SMS |
| 3.7.3 Instrument (67 to 69) | ISO/IEC 25010 Likert instrument | Keep; if the SUS from `docs/TESTER_SURVEY.md` is used, add it with its scoring |
| 3.7.4 Data collection (70) | Walkthrough of the Spatio-Temporal Handshake and the heatmap; field testing of coordinate broadcasting | Walkthrough of Relay (Bluetooth check), check-in and the drivers' waiting counts; field testing of relaying and ETA |

### Chapters 4 and 5

Not in the manuscript yet. After the test round, report: the weighted means per ISO/IEC 25010 characteristic (and the SUS score if used), the field test results (ETA error, battery and data per hour, synchronisation delay, Bluetooth signal), and the share of checklist steps passed on phones.
