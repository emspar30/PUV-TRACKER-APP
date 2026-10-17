# Proposal traceability

How each commitment of the thesis proposal (Chapters 1 to 3, April 2026) maps to the Android prototype as of commit `900f3c8` (checked 2026-10-17 against the code, the tests and the git history). Companion to `APP_CAPABILITIES.md`, which describes every screen and the test evidence in more detail.

**Status:** REAL (works, with a test or device record), DEMO (simulated data only, labelled), PARTIAL, NOT BUILT, CHANGED (built differently), DROPPED (deliberately not built), UNVERIFIED (not measured).

**Reason codes:** PANEL (the panel's Major Revision on the cost burden on drivers), TECH (feasibility), SCOPE (pilot scope), RESEARCH (literature or field finding), PRIVACY, TIME.

**Defense risk:** HIGH (a panelist can show the objective is unmet), MEDIUM (a difference that needs a prepared explanation), LOW.

Where this file says "reason not recorded", the change is in the project's requirements document but its rationale was not re-checked for this file.

## 1. Objectives

| # | Commitment | Status | Evidence | How it differs | Reason | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| O1 | Tracking architecture and a proximity-aware ETA algorithm | PARTIAL | Server pipeline (`ingest` function, live vehicle table, Realtime) with `ingest.test`, `liveVehicles.test` and 17 live tests; ETA in `shared/tracking/eta.ts` with `eta.test` (distance along the route, recent speed, hidden under 5 km/h or beyond 10 km, counted down by the age of the last position) | The architecture and the ETA exist, but **no real vehicle sends positions**: ETA runs only on demo vehicles and on two simulated test vehicles. ETA accuracy has never been measured | TECH, PANEL | HIGH |
| O2 | Dynamic demand heatmap for the driver module | NOT BUILT | Waiting counts per station from check-ins are shown to commuters (`shared/checkin/waiting.ts`); an SMS heatmap message format exists (`sms.test`) but nothing sends or draws it | No driver module, no heatmap screen | PANEL, SCOPE | HIGH |
| O3 | Standardised point-to-point fare with student, senior and PWD discounts | PARTIAL | `fare.test`, `fareType.test`; emulator S3-M2; partner's phone (earlier code) | Formula and 20 % discount work offline for any two points; the fare values (₱15 for 4 km, ₱2 per km after) are **placeholders**, not an official fare matrix | TIME (official fare not obtained) | MEDIUM |
| O4 | Consensus-based moderation and a reputation system (Trust and Merit Points) | CHANGED | `flag_post` (3 unique flags hide a post and queue it for review), `trust.test`, live tests for capped points | Consensus = 3 unique flags; reputation = Trust Points only (1 per check-in or relay, at most 3 a day, Trusted badge at 5, a flag removes an earned point). No Merit Points, no strikes, no bans | SCOPE | MEDIUM |
| O5 | Software-only implementation using phone GPS | CHANGED | No hardware in the code; Bluetooth and SMS are function stubs only | Still software-only, but the GPS source moved from drivers' phones to **commuters on board** (Relay with GPS sharing); the position upload itself is **not built** (step T1) | PANEL | HIGH |
| O6 | ISO/IEC 25010 evaluation (Likert; 35 commuters, 10 drivers, 5 IT experts) | NOT BUILT | No evaluation record in the repository (unverified whether it has started) | Without a driver module, the 10 driver respondents have no driver features to rate | TIME, PANEL | HIGH |

## 2. Commuter module

| # | Commitment | Status | Evidence | How it differs | Reason | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | ETA viewing | DEMO | Vehicle card and tracking panel; `eta.test`; emulator | Works on demo and simulated vehicles only (see O1) | TECH | MEDIUM |
| C2 | Live PUV map, viewport-centric icon priority, Selective Transparency | PARTIAL | Live map with demo vehicles; unselected routes at 8 % opacity, tracked vehicle keeps full opacity while others fade to 35 % (`routeVisibility.test`, `vehicleMarkers.test`) | Selective Transparency built; **viewport-centric icon priority not built**; live map readable by team accounts only | SCOPE | MEDIUM |
| C3 | Route Discovery: From-To suggestions, route directory, offline guide | REAL | `routing.test`, `realRoutes.test`, `placeSearch.test`, `suggest.test`; emulator | From-To works offline with 1,683 place and street names; routes are chosen from chips on the Map tab (a separate directory list is unverified after the 2026-10-09 redesign) | — | LOW |
| C4 | Fare calculator with automatic discounts, offline | PARTIAL | As O3; the discount follows the fare type set in onboarding or Profile | Placeholder fare values | TIME | MEDIUM |
| C5 | Station Check-in: hardcoded stops, geofence, prompt at 5 min, purge at 15 min | REAL | 39 stations in the route seed; `geofence.ts` (60 m, 25 m GPS accuracy); reminder at 5 min, expiry 15 min, server deletion every minute; `localCheckin.test`, `crowd.test`, live tests | Reminder is an in-app message (no system notification); the 5-minute reminder was not seen live on a device | — | LOW |
| C6 | Seat reporting, four tiers (Empty; Few 1-7; Almost Full 8-15; Full 16) | CHANGED | `shared/telemetry/occupancy.ts`: seats taken of 16 | **Three tiers**: 0-6 "Seats available", 7-12 "Filling up", 13-16 "Full" | Reason not recorded | MEDIUM |
| C7 | Spatio-Temporal Handshake: 20 m proximity, Verified badge or unverified | NOT BUILT | Verification hook always returns "unverified" | No proximity check against a vehicle (there are no real vehicle positions to compare with); GPS relays only need 30 m accuracy | TECH | HIGH |
| C8 | Trust Points, Merit Points (1,000 to 1), strike shield, badges | CHANGED | `trust.test`, `badges.test` | Trust Points as in O4; no Merit Points or strike shield; seven count badges kept on the phone, no ranking | SCOPE | MEDIUM |
| C9 | Report cooldowns, weekly limit of 15 | NOT BUILT | — | Only a daily cap of 3 trust points and Energy earning caps per day; repeated requests are made harmless by request keys | SCOPE | MEDIUM |
| C10 | GPS Decay: stop after 10 min idle or when the app closes | PARTIAL | Foreground location only (no background permission requested); Relay GPS sharing ends at the destination or after 90 min (`relayBroadcast.test`) | No 10-minute idle rule; stopping when the app leaves the foreground is expected from the foreground-only setup but not tested on a phone | TECH | LOW |
| C11 | Profile: commuter type, frequent destinations, avatar or alias, 15-day edit cooldown | PARTIAL | `profileStore.test`, `destinations.test`, `avatarPicker.test` | Fare type, up to 3 places, 16 avatars and a username exist; **no 15-day cooldown**; these stay on the phone (only the username is sent) | PRIVACY | LOW |
| C12 | Strict Night Mode: only verified reports public in the evening | CHANGED | `is_night` in the core migration; night feed delay migration; live tests | 21:00 to 04:59 Manila: the server hides **moving** vehicles; relays that name a stop are held from others for 2 minutes. No "verified only" rule (verification is not built) | PRIVACY, TECH | MEDIUM |
| C13 | Report another commuter (flagging) | REAL | `flag_post`; `crowd.test`; live tests | Flags a post, not a person; 3 unique flags hide it | — | LOW |
| C14 | Onboarding | REAL | `destinations`, `avatarPick`, `usernameSuggest` tests; emulator F1-M1 to M4 | Adds a mascot, a location consent screen and a tips tour | — | LOW |

## 3. Driver module

| # | Commitment | Status | Evidence | How it differs | Reason | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Live coordinate broadcasting with a visibility toggle | CHANGED | No driver app. Commuter Relay with "Share with GPS" has a session, a Stop button and an auto-end, but **does not upload positions yet** | Broadcasting moved from drivers to commuters on board | PANEL | HIGH |
| D2 | Demand heatmap synchronised with check-ins | DROPPED | Check-ins exist; no driver screen | Waiting counts shown to commuters instead | PANEL | HIGH |
| D3 | Onboarding with ID upload and administrator approval | DROPPED | — | No driver accounts; no ID documents collected | PANEL, PRIVACY | MEDIUM |
| D4 | Automatic session end after 60 min stationary or when the app closes | CHANGED | Relay sharing ends within 100 m of the destination or after 90 min | Applies to the commuter's relay, not a driver session; no stationary rule | PANEL | LOW |
| D5 | Profile edit with 15-day cooldown | DROPPED | — | No driver profile | PANEL | LOW |

## 4. Administrator

| # | Commitment | Status | Evidence | How it differs | Reason | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Moderation: 10 unique flags for a strike; two strikes for a permanent ban | CHANGED | `flag_post`; review table `feed_review_queue` | 3 unique flags hide a post and queue it; a flag takes back the author's earned trust point. No strikes or bans | SCOPE | MEDIUM |
| A2 | Driver credential verification | DROPPED | — | No driver accounts | PANEL | LOW |
| A3 | Security audit log (device fingerprint, location snapshots for high-risk hours) | CHANGED | Ingest log kept 30 days for team test writers; device integrity is a stub | No device fingerprint, no location snapshots of commuters; night positions kept only 24 hours | PRIVACY | MEDIUM |
| A4 | System analytics | NOT BUILT | Only the hosting provider's database console | No analytics screen | TIME | MEDIUM |

## 5. Non-functional and technical

| # | Commitment | Status | Evidence | How it differs | Reason | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| N1 | Position synchronisation under 5 s | UNVERIFIED | Realtime push plus a 30 s reload; the simulator sends every 5 s; positions age shown every 5 s | Never measured end to end; no real broadcaster | TECH | HIGH |
| N2 | TLS and Data Privacy Act compliance | PARTIAL | HTTPS to the backend; consent before location; Withdraw; Delete account (`account.test`); data request by email; retention jobs; `privacy.test` | Consent text awaits a data protection officer's review; no privacy impact assessment in the repository (unverified) | PRIVACY | MEDIUM |
| N3 | Auto-TTL of check-ins and seat reports after 15 min | CHANGED | Check-ins expire at 15 min; feed posts at 60 min (`FEED_LIFETIME_MIN`); scheduled deletion script | Seat reports live 60 min, not 15 | Reason not recorded | LOW |
| N4 | Minimal bento UI, five-anchor bottom navigation | CHANGED | `tabs.test` | Four tabs (Map, Check-in, My Rides, Crowdsource); Profile from the avatar, Settings from the menu; floating cards and sheets | SCOPE | LOW |
| N5 | React Native for Android and iOS; Node.js; Firebase or Firestore; Google Maps Platform; Google Cloud | CHANGED | `package.json`, `app.json` (platform `android` only), `supabase/` | Expo (React Native) **Android only**; Supabase (PostgreSQL, Row Level Security, Edge Functions); MapLibre with **bundled offline OpenStreetMap tiles**; no Node.js server, Firebase, Google Maps or Google Cloud | TECH, SCOPE | MEDIUM |
| N6 | Offline caching of routes and fares | REAL | Route database on the phone; offline map; emulator S2-M1 and S3-M1 in airplane mode | Bundled with the app rather than cached from a server | — | LOW |
| N7 | Routes 1 to 14 (also "all 7 routes") | CHANGED | Route seed: **R1, R2, R3, R4, R5, R14** (6 routes) | R14 has one direction only (Draft); R4 and R5 outbound legs derived from the traced return | SCOPE, TIME | MEDIUM |
| N8 | Devices with at least 4 GB RAM and 4G or 5G | UNVERIFIED | No current-app run on any phone; emulator memory reached 908 MB before touches failed (EQ-2) | The offline features need no data connection; memory and battery on a real phone unknown | TIME | HIGH |

## 6. Additions not in the proposal

| Addition | Reason |
| --- | --- |
| Offline map of Butuan bundled in the app (with offline labels and place search) | TECH: no paid map service; works without data |
| Demo mode, on by default and labelled "Demo" | TECH: every screen can be shown before real vehicles exist |
| Tracking Energy (tracking costs 1 per 30 min; earned by check-ins and relays) | Project requirements (PRD 11.1); rationale not re-checked here |
| Location consent screen, Withdraw, Delete account, data request | PRIVACY (Data Privacy Act) |
| Relay with optional GPS sharing that ends by itself | PANEL: shifts position sharing from drivers to commuters |
| Night feed delay (stop-naming relays held 2 min) | PRIVACY (safety at night) |
| Tunton mascot greeting, avatars, tips tour | RESEARCH/UX: onboarding and engagement (rationale not recorded) |
| Guest locks (sign in for check-in, feed, relay, tracking) | Accountability for crowd data |
| Offline banner, skeleton screens, Light and Dark themes, Licences screen | TECH and licence compliance (OpenStreetMap, Noto Sans) |
| Check-in at shared stops for several routes at once | SCOPE: stops shared by up to four routes |

## 7. Top 10 defense risks

The nine HIGH items (grouped into seven rows, most serious first), then the three most serious MEDIUM items.

| # | Item | What a panelist could challenge | Evidence today |
| --- | --- | --- | --- |
| 1 | O5, D1 (HIGH) | "Where does live position data come from?" No real vehicle or commuter uploads positions | Pipeline proven with two simulated vehicles through the real server; Relay sharing session with Stop and auto-end (no upload); demo vehicles |
| 2 | O1 (HIGH), C1 | "How accurate is your ETA?" Never measured on real traffic | `eta.test`; emulator runs on demo and parked test vehicles |
| 3 | N8 (HIGH) | "Has the app run on a phone?" The current app has not; the emulator showed a memory failure after about 14 minutes | Emulator records only; the partner's phone ran the earlier, replaced code |
| 4 | O2, D2 (HIGH) | "Objective 2 promised a driver heatmap" | Waiting counts per station for commuters; SMS format functions with tests |
| 5 | O6 (HIGH) | "Who evaluates the driver module, and when?" | No evaluation record; no driver module |
| 6 | C7 (HIGH) | "How is a report verified?" Every report is unverified | Accuracy gates (25 m, 30 m), geofence, mock-location refusal, flags, daily caps, sign-in required |
| 7 | N1 (HIGH) | "Is synchronisation under 5 s?" | Not measured |
| 8 | O3, C4 (MEDIUM) | "Is the fare official?" Values are placeholders | Formula and discount tested; Estimate label and disclaimer in the app |
| 9 | N5 (MEDIUM) | The proposal still describes iOS, Firebase, Google Maps and Google Cloud | Section 8 lists every outdated sentence; the offline map is a strong reason for the change |
| 10 | O4, A1, C8 (MEDIUM) | "Where are Merit Points, strikes and bans?" | 3-flag hiding, review queue and capped Trust Points with live tests |

## 8. Proposal text that should change

Section numbers are given where the commitment list names them; exact proposal section numbers could not be checked (the proposal is not in the repository) and are marked "section unverified".

| Chapter and section | What it says | What is true now |
| --- | --- | --- |
| Ch. 1, Objectives (O2) | Dynamic demand heatmap for the driver module | No driver module; commuters see waiting counts per station |
| Ch. 1, Objectives (O4) | Trust and Merit Points | Trust Points only; Trusted badge at 5; no Merit Points |
| Ch. 1, Objectives (O5) | Phone GPS of drivers | GPS from commuters on board (Relay); upload not built yet |
| Ch. 1, Scope (section unverified) | React Native for Android and iOS | Android only |
| Ch. 1, Scope (N7) | Routes 1 to 14; "all 7 routes" | Six routes: R1, R2, R3, R4, R5, R14 |
| Ch. 1 or 3, Driver module (D1 to D5) | Driver broadcasting, heatmap, ID upload and approval, 60-min session end, 15-day cooldown | Not built; replaced by the commuter Relay |
| Ch. 3, Administrator (A1) | 10 unique flags for a strike, two strikes for a ban | 3 unique flags hide a post and queue it for review; no strikes or bans |
| Ch. 3, Administrator (A2) | Driver credential verification | Dropped (no driver accounts) |
| Ch. 3, Administrator (A3) | Device fingerprint, location snapshots in high-risk hours | Not collected (privacy); writer log 30 days; night positions kept 24 hours |
| Ch. 3, Administrator (A4) | System analytics | Not built |
| Ch. 3, Commuter (C6) | Four seat tiers (Empty, Few 1-7, Almost Full 8-15, Full 16) | Three tiers: 0-6, 7-12, 13-16 seats taken |
| Ch. 3, Commuter (C7) | 20 m Spatio-Temporal Handshake, Verified badge | Not built; all reports unverified |
| Ch. 3, Commuter (C8) | Merit Points 1,000 to 1, strike shield | Not built; Trust Points and seven count badges |
| Ch. 3, Commuter (C9) | Report cooldowns, 15 updates a week | Not built; daily cap of 3 trust points |
| Ch. 3, Commuter (C10) | Stop GPS after 10 min idle | Foreground-only location; no idle rule |
| Ch. 3, Commuter (C11) | 15-day profile edit cooldown | Not built |
| Ch. 3, Commuter (C12) | Night Mode: only verified reports public in the evening | 21:00 to 04:59 Manila: moving vehicles hidden; stop-naming relays held 2 minutes |
| Ch. 3, Commuter (C2) | Viewport-centric icon priority | Not built (Selective Transparency is built) |
| Ch. 3, Non-functional (N3) | Seat reports expire after 15 min | Feed posts expire after 60 min; check-ins after 15 min |
| Ch. 3, Design (N4) | Five-anchor bottom navigation | Four tabs plus avatar and menu |
| Ch. 3, Technical (N5) | Node.js, Firebase or Firestore, Google Maps Platform, Google Cloud | Supabase (PostgreSQL, Edge Functions); MapLibre with offline OpenStreetMap tiles |
| Ch. 3, Non-functional (N1) | Synchronisation under 5 s | Unmeasured |
| Ch. 3, Requirements (N8) | 4 GB RAM and 4G or 5G | Offline features need no data; untested on a phone |
| Ch. 3, Evaluation (O6) | 10 driver respondents | Needs revising: there is no driver module to evaluate |
| Ch. 3, Fare (O3) | Standardised fare | Placeholder values until the official fare is obtained |
| Ch. 1 to 3 (new) | — | Tracking Energy, Demo mode, offline map and consent flow should be described |
