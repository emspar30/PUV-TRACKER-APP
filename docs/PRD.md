# PRD v2.0: Commuter-Centric Crowdsourced PUV Tracker (Android)

Oct 2, 2026 · @buseng

## 0. Build guide for the implementation agent

This section tells a coding agent (or a developer) what to build first, in what order, and how to know each step is done. If it conflicts with a later section, **this section wins for the prototype**. Sections 1 to 18 stay the full product requirements.

### 0.1 Rules for the agent

1. Read the whole document first, then write an implementation plan that follows the build order in 0.2. Do not plan Phase 2 or Phase 3 work.
2. **Scope is Android only and Route 4 (De Oro) only.** Never add iOS code or other routes. The code must still load route data from the database, so adding a route later is a data change.
3. **Every threshold is a config constant**, never a literal in the code. Put them in one shared config module using the names and defaults in 0.3.
4. **Placeholder data is allowed, invented official data is not.** Use the Route 4 placeholders in section 12.5, a mock polyline traced between the placeholder stops, and the v1.0 fare values (₱15.00 for the first 4 km, ₱2.00 per additional km, 20% discount). Mark each placeholder with a `TODO(placeholder)` comment and keep them in one seed file so they can be replaced by bumping `route_data_version`.
5. **Keep logic that can be tested without a phone in a shared TypeScript package** (fare, geometry, SMS parsing and signing, RSSI smoothing, beacon codes, session rules). Native and device code stays thin.
6. Write automated tests for every acceptance criterion in 0.2 that says "unit test". For criteria that need real phones, write a numbered manual test script in `docs/device-tests.md`.
7. Never commit secrets. Vehicle secrets, the device-hash pepper and SMS keys come from environment variables or the Supabase vault.
8. If a needed fact is missing (official fare, real polyline, carrier behavior), stop and list it as a question instead of guessing.
9. Before each step, state the files you will create or change. After each step, run the tests and report what passed.

### 0.2 Prototype build order and acceptance criteria

Build in this order. Each step must meet its acceptance criteria before the next begins.

| Step | Build | Acceptance criteria | Verified on |
| --- | --- | --- | --- |
| S0 | Monorepo, Expo dev client build with Kotlin native module support, Supabase project, lint and test scripts | App installs and opens on a physical Android 8.0+ phone; the test command passes | Phone |
| S1 | Shared core package: config, fare, Haversine and progress-along-line helpers, SMS parser and signer, RSSI smoothing, beacon code generator and validator | Unit tests below | Automated |
| S2 | Offline map with MapLibre tiles for the Butuan bounding box and the blue dot | In airplane mode the map renders and the dot follows the phone; no crash over a 10 minute session | Phone |
| S3 | Local SQLite schema (12.1) seeded with Route 4 placeholders; offline routing with direction check; fare screen with classification | Routing plus fare returns in 250 ms or less at p95 on a 3 GB phone; a destination behind the origin along the route direction is rejected; works in airplane mode; discount applies only when a discounted classification is set | Automated and phone |
| S4 | Supabase migrations for the tables needed here (profiles, vehicles, relay\_sessions, telemetry\_latest, node\_events, checkins, sms\_outbox), row-level security and an ingest Edge Function | A signed-in client can send telemetry; a direct insert into telemetry\_latest is denied by security rules; checkin counts exclude rows whose expires\_at has passed even before cleanup runs | Automated against Supabase |
| S5 | Live map: viewport-culled markers, occupancy halo, coverage states, stationary bubble | A simulated vehicle shows a marker; with no packet for 90 s it shows Stale; speed under 2 km/h across 45 s shows the stopped bubble; with no data the route shows "No data", never "no vehicles" | Phone and simulator script |
| S6 | Driver app: BLE advertiser as a Kotlin module in a foreground service, rotating signed code | A second phone running a BLE scanner app sees the service UUID, and the payload changes every 60 s | Two phones |
| S7 | Commuter boarding detection: armed scan with service UUID filter, smoothed RSSI, 3 s presence rule, boarding prompt, server-side code validation | A code from two or more slots ago is rejected by the server; a valid code is accepted; the boarding prompt appears within 10 s of entering range in a bench test | Two phones |
| S8 | Verification window and relay: activity recognition, 30 m route snap, 50 m displacement, mock-location rejection, 100 m or 30 s send rule, 60-point offline buffer, Primary and Secondary baton | A simulated ride passes verification; a stationary rider fails; a mock-location fix is discarded and flagged; the buffer flushes in order after reconnect; if the Primary sends nothing for 90 s the next Secondary is promoted | Automated simulation, then a real ride |
| S9 | Check-in, SMS worker, gateway app and driver heatmap | Check-in is refused outside the station radius or when accuracy is worse than 25 m; the worker emits a correctly signed message; the driver app drops messages with a bad signature, an old sequence number or a wrong sender; the heatmap greys out after 15 minutes without a valid message | Automated, then phones with SIMs |
| S10 | Hardening: battery, data usage, vendor background tests, field experiments E1 to E9 (section 17) | Targets in section 3.3 are measured and recorded, even if missed | Real rides |

**Unit tests required in S1**

- **Fare (regular):** 4.0 km gives ₱15.00; 4.1 km gives ₱17.00; 6.3 km gives ₱21.00; 10.0 km gives ₱27.00.
- **Fare (discounted):** 6.3 km gives ₱16.80 before rounding, and ₱16.75 with the assumed nearest ₱0.25 rounding.
- These S1 vectors test the formula with the v1.0 parameters (₱15.00 for 4 km). The app's default since 2026-10-22 is ₱14.00 (0.3); with it, 4.0 km gives ₱14.00, 4.1 km ₱16.00, 6.3 km ₱20.00, 10.0 km ₱26.00, and 6.3 km discounted ₱16.00.
- **RSSI smoothing:** with alpha 0.3, a first reading of -60 followed by -70 gives -63.0.
- **Distance:** the Haversine distance between placeholder stops RCA and JCA is about 61 m (within 2 m). A check-in made at JCA for the RCA station with a 60 m radius is therefore refused.
- **SMS parser:** the example message in section 12.3 returns all three stations (not only the last); a message with a changed character in the signature is rejected; a sequence number that is not newer is rejected; a timestamp more than 30 minutes off is rejected.
- **Beacon code:** a code is valid in its own time slot and one slot either side, and invalid two or more slots away.

### 0.3 Config constants

All values are starting hypotheses (section 17). The agent exposes them from one config module, and the server-side ones come from a config table.

| Constant | Default | Section |
| --- | --- | --- |
| RSSI presence threshold | -65 dBm | 10.1 |
| RSSI margin between two beacons | 8 dB | 10.1 |
| RSSI smoothing alpha | 0.3 | 12.4 |
| Beacon presence time | 3 s | 10.1 |
| Beacon time slot and tolerance | 60 s, plus or minus 1 slot | 8.2 |
| Armed scan duration | 15 minutes | 8.1 |
| Route snap distance | 30 m | 10.2 |
| Minimum displacement | 50 m | 10.2 |
| Speed fallback for motion check | 25 km/h for 20 s | 10.2 |
| GPS accuracy gate for relay | 30 m | 8.4 |
| GPS accuracy gate for check-in | 25 m | 7.5 |
| Check-in radius (default) | 60 m | 7.5 |
| Check-in lifetime | 15 minutes, reminder at 5 | 7.5 |
| Boarding prompt (CA1.1) | a Live multicab of a pinged route standing (under 2 km/h) within 60 m of the stop for 10 s | 7.5 |
| Check-in cost (CA1.1) | 0.3 Energy per route pinged | 11.1 |
| Welcome Energy (CA1.1) | 5 (the wallet), once per account | 11.1 |
| Tracked multicab near, Map tab dot (CA1.1) | 1 km | 7.3 |
| Position send rule | 100 m or 30 s | 8.4 |
| Stationary speed and duration | under 2 km/h for 45 s | 7.3 |
| Liveness timeout | 90 s | 8.4 |
| Offline buffer size | 60 points | 8.4 |
| Idle stop | 30 m radius for 20 minutes (30 inside a terminal: for now the route's first and last stop, 100 m) | 8.4 |
| High-traffic zones (RL1, Emjay 2026-10-22) | 150 m around 3 all-day intersections, and at rush hour (16:00 to 18:59 Asia/Manila) around 1 intersection and along the whole Magsaysay Bridge; inside an active zone the idle clock is held | 8.4 |
| Session hard cap | 3 hours, then "Still riding?"; no answer in 5 minutes ends it | 8.4 |
| Arrival radius and countdown | 50 m, 60 s | 8.1 |
| Relay gate (RL2a, Emjay 2026-10-23): beacon wait, route check | no verified beacon after 15 s means none is near; the rider within 30 m of the multicab's line or 60 m of one of its stops | 8.1 |
| Relay post renewal (RL2a) | a "still riding" signal every 5 minutes; the post lapses 15 minutes after the last one, and one lapsed under 30 minutes ago comes back | 8.1 |
| Primary eligibility | battery 30% or more | 8.3 |
| Live view free in prototype | yes (pioneer period) | 11.1 |
| Night Mode window | 21:00 to 04:59 Asia/Manila | 10.4 |
| Vehicle capacity | 16 seats | 7.3 |
| Occupancy bands (seats taken) | 0 to 6, 7 to 12, 13 or more | 7.3 |
| Coverage states | Live under 90 s, Stale to 10 minutes, then No data | 7.3 |
| Estimated markers (CF1) | 90 s to 5 minutes of silence; median recent speed capped at 40 km/h; at most 2 km along the line; redrawn every 1 s | 7.3 |
| Alternative route nearby (CF1) | Shares a stop; Live vehicle within 2 km of the commuter | 7.3 |
| Fare | ₱14.00 for 4 km, ₱2.00 per km, multiplier 0.8 (the traditional jeepney rate, Emjay 2026-10-22; was ₱15.00) | 12.4 |
| Fare rounding | nearest ₱0.25 (assumed) | 7.2 |
| SMS maximum age and stale heatmap | 30 minutes, 15 minutes | 12.3 |
| SMS sequence wrap-around window | a number is newer if it is 1 to 5,000 ahead of the last one, modulo 10,000 | 12.3 |
| Telemetry timestamp limits | reject packets older than 120 s or more than 30 s in the future | 8.4 |
| Store-and-forward batch (T1) | at most 60 positions and 4 KB per request; positions up to 30 minutes old kept as history; retry after 5 s, doubling to 60 s | 8.4 |
| Relay seats sent (T1) | Seats available 3, Filling up 9, Full 14 | 8.4 |
| Map zoom buttons (CA1.1) | 1 zoom level a tap; Locate's second tap zooms out to the farthest zoom (11.5) | 7.3 |
| Relay details (CA1.1) | rider and destination count as on the route line within 100 m | 7.3 |
| Search results (CA1.1) | placeholder rows shimmer 350 ms after each change of the typed text (3 rows), then the results fade in | 7.2 |
| Assistant (CA1, CA1.1) | at most 3 places per name (the best and 2 "Did you mean"); 8 places looked at per name; questions up to 120 characters; trip ends under 50 m apart are the same place; typos: 2 letters off for a word of 6 or more letters, 1 for 4 or 5, none under 4; conversation: the newest 50 questions, none older than 1 hour | 19.5 |

### 0.4 Environment and device testing

- **Real phones are required.** BLE advertising, BLE scanning, SMS receiving and background behavior cannot be tested in an emulator. Plan for at least two Android phones (commuter and driver), a third for baton tests, and a SIM that can send and receive SMS for the driver and gateway phones.
- **Expo Go will not work.** Use an Expo dev client build with custom native modules in Kotlin.
- **Suggested libraries** from this document: React Native with Expo and TypeScript, MapLibre, `expo-location`, `react-native-ble-plx` (scan only), Turf.js, SQLite, Zustand, and the Supabase client.
- **Manual test scripts** go in `docs/device-tests.md`, one per step that is verified on phones.

### 0.5 Suggested repository layout

```text
apps/commuter        React Native app (Android)
apps/driver          Driver app: BLE advertiser, SMS receiver, heatmap
apps/gateway         Gateway app: pulls queue, sends SMS
services/sms-worker  Node.js worker: builds signed messages, queue, retries
supabase/            migrations, Edge Functions, seed data, config table
packages/shared      config, fare, geo, SMS protocol, beacon codes, session rules
docs/                PRD.md, device-tests.md
```

### 0.6 Out of scope for the prototype

These stay in the PRD but must not be built yet:

- Energy spending and earning, Trust Points, Merit shields, flags, strikes and appeals (live view is free in the prototype).
- ETA, the community feed, other routes and the multi-route transfer graph.
- The web admin console. The prototype uses the Supabase dashboard and seed scripts instead, which overrides the admin console line in section 5.1.
- Play Integrity checks, Play Store submission and Cebuano strings. Keep the code ready for them (string files, an integrity check hook), but do not implement them.
  - Exception (CA1, 2026-10-21): the assistant Ask Tunton understands common Bisaya (Cebuano) question words (19.5). Its replies, like every other string, stay in English.
- Night Mode static view. Build the server-side window setting, but the full static node view comes after S9.

### 0.7 Prototype v0: first build slice (verification deferred)

The first build uses placeholder data and delivers the basic features. Verification and anti-spoofing come later, once the real Route 4 data and field measurements are gathered. This subsection overrides the order in 0.2 for now.

**Build now**

| Step | What it delivers in v0 | Notes |
| --- | --- | --- |
| S0 | Repo, dev client build, Supabase project, test scripts | As in 0.2 |
| S1 | Shared package: config, fare, geometry helpers, SMS protocol parser and signer, RSSI smoothing | Beacon codes can wait for S6 |
| S2 | Offline map and blue dot | Use a small placeholder tile set if the full Butuan tiles are not ready |
| S3 | Offline routing and fare with the Route 4 placeholder polylines and stops (section 12.5) | Full acceptance criteria from 0.2 apply |
| S4 | Minimal backend: sign-in, `vehicles`, `telemetry_latest`, row-level security, ingest Edge Function | Other tables wait |
| S5 | Live map with markers, coverage states, occupancy halo and stopped bubble | Fed by a simulator and a dev broadcast screen, below |

**Two ways to get a marker without a real multicab**

- **Vehicle simulator:** a script that walks the placeholder polyline at a chosen speed and sends packets using the position send rule (100 m or 30 s). It must also be able to stop for 60 s and to go silent for 100 s, to test the stopped bubble and the Stale state.
- **Dev broadcast screen:** a screen hidden behind a development flag where a team member's phone broadcasts its real GPS as a test vehicle on Route 4 with a fake plate. This allows real-ride tests before the BLE beacon exists.

**Deferred until the data is gathered**

- BLE advertiser, boarding detection, and the BLE-based rider verification (S6 and S7).
- Verification window, route snap, mock-location rejection, Play Integrity, strikes, and the Primary and Secondary baton (S8).
- Check-in, SMS worker, gateway and driver heatmap (S9).

**Leave plug-in points so verification can be added without rewrites**

1. A single function `verifyReport(report)` that returns a status (`unverified` or `verified`) and a list of reasons. In v0 it always returns `unverified` with the reason `verification_disabled`.
2. A config flag `ENABLE_VERIFICATION`, default `false`, read in one place.
3. Columns `verified` (default false) and `verification_reasons` (JSON) on `telemetry_latest`.
4. Marker and UI badge showing **"Prototype data, unverified"** while the flag is off.
5. A `deviceIntegrity()` hook that returns a placeholder result.

**Safety rule for v0:** with verification off, anyone could publish a fake marker. Keep v0 private: only accounts on a team allowlist can write telemetry, and the build is not released to the public.

**Data needed before the verification phase starts**

- [ ] Real Route 4 outbound and return polylines
- [ ] Confirmed stop list with coordinates
- [ ] Field results for BLE signal strength inside a multicab (experiments E1 and E2 in section 17)
- [ ] At least two Android test phones and one multicab with the driver device mounted
- [ ] Official fare for Route 4

## 1. Document control and what changed

PRD v2.0 is the Android-only revision of the v1.0 draft. It keeps the passenger-relay idea and fixes the contradictions, unverifiable claims and missing scope found in review. All iOS content has been removed.

| Item | Value |
| --- | --- |
| Version | 2.0 (supersedes v1.0 Final Draft) |
| Status | Draft for panel defense |
| Target locale | Butuan City public transit, pilot on Route 4 (De Oro); other routes are added later as data |
| Platform | Android 8.0 (API 26) and newer, one commuter app and one driver app |
| Stack | React Native with Expo dev client (not Expo Go), TypeScript, Kotlin native modules for BLE advertising and SMS |
| Backend | Supabase: Postgres with PostGIS, Realtime, Edge Functions, pg\_cron, plus one small Node.js SMS worker |
| Design system | Dark-mode-first bento grid, 8 pt spatial grid, touch targets of 48 dp or larger |

### Change log from v1.0

| # | v1.0 problem | v2.0 decision | Section |
| --- | --- | --- | --- |
| 1 | Night Mode disabled GPS, which broke evening use and the energy loop | Night Mode now limits what is published, not what is collected. Window moves to 9:00 PM to 4:59 AM by default | 10.4 |
| 2 | 150 m AND 10 s polling gave updates about every 18 s and hid stopped vehicles | Send at 100 m OR 30 s, whichever comes first, with an explicit stationary flag | 8.4 |
| 3 | 30 s heartbeat would mark a PUV in traffic as dead | Server timeout of 90 s on any packet, with a separate 30 s keepalive | 8.4 |
| 4 | BLE beacon called "unfalsifiable" with a static payload | Rotating HMAC code checked by the server; described as cost-raising, not unbreakable | 8.2 |
| 5 | Driver SMS claimed to be silent, but Android shows default-app notifications | Data SMS to a port as primary path, signed payload, whitelisted sender | 9.3 |
| 6 | SMS regex returned only the last station | Validate with a regex, then parse with split | 12.3 |
| 7 | Firebase and Supabase both listed; TTL treated as exact | Supabase only; counts filter on expires\_at and cron does cleanup | 6.3 |
| 8 | Hardware ban "impossible to evade" | Keyed device hash plus Play Integrity; treated as a deterrent | 10.3 |
| 9 | 10-flag strike rule unreachable at small scale | Weighted flags, moderator confirmation, appeals | 11.3 |
| 10 | Classification stored in cloud with a 15-day cooldown | Classification stays on the device; cooldown removed | 7.1 |
| 11 | Public avatars and an undefined community feed vs privacy goals | Avatars are private; feed deferred to Phase 3 | 7.1 |
| 12 | Cold start and driver buy-in not addressed | Pilot scope, coverage states, seeding plan, driver value section | 5, 9.1 |
| 13 | No ETA | Freshness label in MVP, simple ETA in Phase 2 | 7.4 |
| 14 | Absolute claims such as 100% reliability | Measurable targets and a validation plan | 13, 17 |

## 2. Executive summary and problem statement

The product gives Butuan commuters live PUV positions, seat availability and offline routing and fare estimates, using only the phones of commuters who are already riding. Drivers pay nothing: no hardware, no data plan.

### 2.1 Problem

Butuan's public transit runs mostly on franchised multicabs along fixed corridors such as Bancasi, Libertad, Langihan and CSU Ampayon. Drivers commonly wait to fill the vehicle before leaving ("load-full" dispatch), so wait times are unpredictable and some corridors have too many empty vehicles while others have queues. Earlier hardware-based tracking attempts failed because cooperatives could not pay for the devices, their upkeep or monthly data.

### 2.2 Solution

A 100% passenger-relay model:

- **Location and seat data** come from commuters aboard a PUV. One passenger at a time is the Primary Broadcaster, so only one phone per vehicle uses GPS continuously.
- **Boarding is detected** by a Bluetooth Low Energy (BLE) beacon on a low-end Android phone mounted on the PUV dashboard.
- **Demand data reaches drivers** by SMS, which needs no mobile data. A gateway phone sends signed, compressed heatmap messages.
- **Routing and fares run offline** on the commuter's phone from a local database and offline map tiles.

### 2.3 Honest limits of the model

This design has two built-in limits, and the product must say so in its UI and in the defense.

1. **No rider aboard means no marker.** A PUV with no app user is invisible. The app therefore shows "No data" instead of "No vehicles" and reports route coverage (section 7.3).
2. **Value grows with adoption.** The map is only useful above a minimum density. The prototype is scoped to a single route with team-seeded rides before any wider launch (section 5).

### 2.4 Design principles

- **Offline first.** Routing, fares and self-tracking must work with no signal.
- **Verify, don't trust.** Every public marker passes BLE, motion and route-geometry checks.
- **Collect minimally, publish carefully.** Location is collected for a purpose and published only at a safe level of detail (section 10.4).
- **Measure, don't assert.** Every threshold in this document is a starting hypothesis with a test in section 17.

## 3. Goals, non-goals and success metrics

The pilot succeeds if commuters on the pilot route can see a trustworthy live marker most of the time it matters, and the app stays light enough on battery and data that people keep it on.

### 3.1 Goals

1. Show verified live PUV position and seat status on the pilot route(s).
2. Provide offline routing and fare estimates for the pilot route.
3. Give drivers a free, offline demand heatmap that arrives by SMS.
4. Keep commuter battery and data cost low enough for daily use.
5. Protect rider privacy, including at night.

### 3.2 Non-goals

- iOS support, in any phase.
- Fare collection, payment or ticketing.
- Driver tracking or monitoring of driver behavior. Only vehicle position is used.
- Replacing LTFRB or city franchise data; the app consumes the authorized route data.
- Predictive AI. ETAs use simple segment-speed averages.
- Guaranteed coverage. Visibility depends on riders aboard.

### 3.3 Success metrics (proposed targets)

All targets are hypotheses to confirm in the pilot. "Reference device" means a low-end Android phone with 3 GB RAM.

| Metric | Target | How measured |
| --- | --- | --- |
| Position accuracy | Median error of 50 m or less versus a reference GPS logger on the same vehicle | Side-by-side ride logs |
| Marker freshness while a PUV is broadcasting | 90th percentile age of 30 s or less | Server timestamps |
| Boarding detection recall | 90% or more of real boardings detected | Field test with observer log |
| Wrong-vehicle lock rate at crowded terminals | 2% or less | Terminal test at SM City and CSU |
| Primary Broadcaster battery use | 5% per hour or less on the reference device | Controlled 2 hour rides |
| Secondary node battery use | 2% per hour or less | Controlled 2 hour rides |
| Cellular data per hour while broadcasting | 150 KB or less | Android network stats |
| Route coverage on the pilot route | At least one live marker during 60% of operating hours | Server logs |
| Offline route plus fare computation | 250 ms or less at the 95th percentile | On-device benchmark |
| Commuter weekly retention | 30% or more of week-1 users active in week 4 | Analytics |
| Driver heatmap usefulness | Majority of pilot drivers say it changed at least one dispatch decision | Short driver survey |

## 4. Users, stakeholders and device assumptions

Four roles use the system, and each has a different device and permission set.

| Role | Who | Device and access | What they need |
| --- | --- | --- | --- |
| Commuter | Students, workers and seniors riding multicabs | Own Android 8.0+ phone, often low-end, intermittent data | Know where the next PUV is, how full it is, the route and the fare |
| Driver | Multicab driver on a pilot route | Cooperative-provided low-end Android with a SIM that can receive SMS, no data plan | Know where passengers are waiting so dispatch timing improves |
| Cooperative / transport office | Franchise holder, LTFRB or city transport office | Admin console in a browser | Consent to the pilot, accurate route data, aggregate reports |
| Admin (research team) | Project team | Admin console | Manage routes, vehicles, keys, moderation and SMS gateway health |

### 4.1 Device assumptions

- Commuter phones run Android 8.0 or newer, with as little as 3 GB RAM and aggressive vendor battery management.
- Driver devices run Android 8.0 or newer, are plugged into the vehicle charger, and are provisioned once by an admin.
- The SMS gateway is one dedicated Android phone on mains power (section 6.4).

### 4.2 Commuter permissions

The app requests permissions in context, one at a time, with a plain explanation before each system prompt. The app must still work in a reduced mode if the user declines.

| Permission | Used for | If denied |
| --- | --- | --- |
| Fine location (while in use) | Blue dot, check-in, routing from current position | Manual origin pin; no check-in |
| Background location | Relay tracking while the screen is off | Relay only works with the app open; reduced reward |
| Nearby devices (Bluetooth scan) | Detecting the PUV beacon | Manual "I'm on Route X" confirmation |
| Physical activity | Confirming the user is in a vehicle | Relay cannot be verified; no energy reward |
| Notifications | Check-in reminders, boarding prompt, relay status | Prompts shown only in-app |

### 4.3 Driver value and cooperative buy-in

Drivers adopt the heatmap only if it helps them earn. The pilot therefore includes a written agreement with the cooperative, a short in-person onboarding, and a post-pilot survey. The driver app never shows a driver's identity on the public map, and the system tracks vehicles, not drivers.

## 5. MVP scope and phased roadmap

Phase 1 is a functional prototype and pilot on a single route, Android only. Rewards, ETA and community features wait until the core is proven. The bands are not to scale; only the pilot length (4 to 6 weeks) is fixed.

&#91;embedded content: roadmap · 4 phases, 3 gates\]

Each gate is a decision point: expand only if its criteria are met, otherwise tune and repeat the phase.

### 5.1 What is in the pilot

| Area | Phase 1 pilot | Phase 2 and later |
| --- | --- | --- |
| Commuter app | Offline map, routing and fare for the pilot route; live map on the pilot route; BLE boarding and relay; station check-in; free live view | Energy and Trust, flags with appeals, merit shields, ETA, remaining routes |
| Driver | BLE advertiser, signed SMS heatmap, one-time provisioning by an admin | A second gateway device or a licensed SMS provider if volume needs it |
| Cloud and admin | Supabase, SMS worker, admin console for routes, vehicles, keys and manual moderation | Automated strike workflow and analytics |
| Community | None | Pseudonymous community feed (Phase 3) |

Station check-in is in Phase 1 because the driver heatmap has no data without it. Energy charging is not, because live view is free during the pioneer period (section 11.1).

**Why one route is enough.** Every route runs the same code. Only its data differs: the polyline, alternative polylines, stations and the fare order. Proving one route end to end proves the engine, and adding a route later is a data task (section 12.1), not new development.

**Data to collect for the pilot route** (the only data gathering the prototype needs):

- [ ] Outbound and return polylines (R4's return path differs from its outbound path, see section 12.5)
- [ ] Any known alternative polyline, such as a bridge detour
- [ ] Stations and terminals with coordinates and their short codes
- [ ] Official fare from the LGU or LTFRB, with the fare order reference
- [ ] Participating vehicles: plates and driver contact numbers for SMS
- [ ] Vehicle seating capacity

### 5.2 Cold-start plan

A relay-only map is empty until riders join. The pilot handles this directly.

- Choose the pilot route with the cooperative, favoring a busy corridor.
- Team members ride at scheduled peak times so at least one broadcaster is aboard.
- Recruit riders at terminals, through the cooperative and in the university community.
- Show route coverage (Live, Stale, No data) so riders are never told "no vehicles" when the truth is "no data".
- Review coverage weekly and do not expand before Gate B.

## 6. System architecture

The system has six loosely coupled parts, so a failure in one leaves the offline features of the others working.

&#91;embedded content: architecture · 6 parts, 6 links\]

Riders send data up to Supabase; the SMS worker and gateway phone carry demand counts down to drivers, and the driver phone's BLE beacon is what lets a rider's phone recognize the vehicle.

### 6.1 Responsibilities

| Part | Runs on | Responsible for |
| --- | --- | --- |
| Commuter app | Android 8.0+ phone | Offline map, routing and fares; BLE scan; GPS and motion sensing; check-ins; live view |
| Driver device | Low-end Android with a SIM | BLE advertising; receiving SMS; offline heatmap |
| Supabase cloud | Hosted service | Auth, Postgres and PostGIS, Realtime, Edge Functions that enforce the rules, pg\_cron for cleanup |
| Node.js SMS worker | Small server | Turn demand counts into signed SMS, queue and retry, watch gateway health |
| Gateway phone | Android on mains power | Pull queued messages and send them by SMS |
| Admin console | Web browser | Route and detour data, vehicle provisioning and keys, moderation queue, analytics |

### 6.2 Architecture rules

- **Offline first:** routing, fares, offline maps and the blue dot never depend on the cloud.
- **Server is the authority** for time (Night Mode), beacon code validation, Primary assignment, expiry of check-ins and strikes.
- **Liveness is separate from location:** a keepalive and a timeout rule tell the server whether a broadcaster is alive; the location filter does not (section 8.4).
- **One-way driver channel:** drivers receive SMS and advertise BLE. Nothing from the driver device goes to the cloud, so there is no driver data cost.

### 6.3 Backend choice

v1.0 listed both Firebase and Supabase. v2.0 uses **Supabase only**, because the product needs geographic queries (PostGIS), row-level security, scheduled jobs (pg\_cron) and live updates (Realtime) in one place.

Postgres has no built-in time-to-live. Every time-limited row, such as a check-in, has an `expires_at` column. Queries count only rows with `expires_at` in the future, so heatmap numbers stay accurate, and a cron job deletes expired rows every minute as cleanup. Edge Functions enforce rules. A small Node.js worker exists only for the SMS queue, because it needs a long-running process.

### 6.4 SMS path

Check-in counts are turned into a signed message by the worker, pulled by the gateway phone and sent over the carrier network to each driver device. Message format is in section 12.3, gateway details in section 9.6, and risks in section 16.

## 7. Commuter app functional specifications

The commuter app has five modules. Routing, fares and self-tracking work fully offline; live data and relay need a connection.

### 7.1 Onboarding, profile and fare classification

- **Sign-in:** Prototype v0 uses email and password through Supabase Auth, for team accounts created by the team in the Supabase dashboard. Google sign-in or email magic link replaces this after v0. No phone number is collected.
- **An account is needed (AU1, 2026-10-21):** there is no guest mode. The welcome step of the introduction offers only sign-in (or create an account), and after the introduction anyone signed out is sent to the sign-in page, which then has no way back. Tracking Energy, Trust Points, check-ins and relays are therefore always tied to an account, in Demo mode as well. Signing out, deleting the account or resetting the demo leads back to sign-in. When the server answers that a session is gone (signed out elsewhere, account removed), the app asks the user to sign in again.
- **Signed in offline:** the session saved on the phone counts as signed in without a network, including after the one-hour access token expires (the auth library cannot refresh it offline and reports no session, but keeps the saved one). Only signing out, or a refresh token the server refuses, ends it. So a signed-in commuter can always open the offline map, My Rides and Ask Tunton, and the relay buffer keeps queueing (8.4).
- **Builds without backend keys:** a development build carries on without sign-in; a release build shows "Backend not configured" instead of the app.
- **Classification:** the user picks Regular, Student, Senior Citizen or Person with Disability. It is stored **only on the device**. It is self-declared, used only to apply the statutory 20% discount to the fare estimate, and never sent to the cloud.
- **No edit cooldown.** The v1.0 cooldown is removed. Because the fare estimate is informational and the classification never leaves the phone, there is no benefit to gaming it.
- **Avatars:** 12 preset vector avatars, visible only in the user's own profile and wallet screens. Avatars are never shown on the live map. A public community feed is deferred to Phase 3 and would use pseudonymous handles.
- **Consent:** a privacy notice and explicit consent screen is shown before any location permission (section 15).
- **Device binding:** at registration the app sends a keyed hash of the Android ID plus a Play Integrity token (section 10.3).

### 7.2 Offline smart routing and fare engine

**Offline data.**

- Map tiles (MapLibre vector tiles, `.mbtiles`) for the Butuan bounding box are delivered with the Play install through a Play Asset Delivery install-time asset pack. Sideloaded builds use a resumable in-app download that prompts for Wi-Fi.
- A local SQLite database holds route polylines (primary and alternatives), stations and fare parameters, with a `route_data_version` number. The app checks for a newer version whenever it is online and applies deltas.

**Routing.** The engine runs in the JavaScript runtime using Turf.js and is designed for direction-aware results:

1. The user sets an origin (GPS or pin) and a destination.
2. A precomputed spatial grid prefilters routes within 500 m of each point.
3. `pointToLineDistance` finds candidate corridors; `nearestPointOnLine` gives the position along each route.
4. A route is valid only if the destination lies **ahead** of the origin in the route's direction of travel, including loop routes.
5. The prototype has one route, so itineraries are walk, ride, walk, with no transfers and at most 500 m of walking per leg. A small graph linking routes at transfer nodes (stops within 150 m of each other) is added when more routes join.
6. The best itinerary is ranked by ride distance, walking distance and a transfer penalty, then shown as steps such as *Walk 50 m, ride Route 2, walk 100 m*.

**Boarding and alighting.** Riders may board and alight anywhere along the line, not only at listed stops. The origin and the destination are each snapped to the nearest point on the route, and each must be within the walking limit (500 m per leg). The boarding and alighting nodes used for the fare are these two snapped points.

**Fare.** The fare uses the authorized route slice between boarding and alighting nodes, not the physical path, so a detour does not change the fare. Parameters (₱14.00 base for the first 4 km since 2026-10-22, the traditional jeepney rate under LTFRB guidelines, chosen by Emjay for multicabs; it was ₱15.00; ₱2.00 per additional km, 20% discount) come from the v1.0 draft and **must be confirmed against the current fare order** before launch. The formula is in section 12.4. Rounding is a configurable setting, assumed to be nearest ₱0.25 until confirmed. The screen labels the amount as an estimate.

**Display.** The selected route draws at full opacity in its route color; other routes fade to 8% opacity. The blue dot uses passive GPS and works with no data.

### 7.3 Live PUV tracker map

- **Viewport culling:** the client queries only markers inside the visible bounding box and renders those.
- **Marker content:** route color, a heading cone from GPS bearing, and an occupancy halo.
- **Occupancy states** are defined by **seats taken** out of a configurable vehicle capacity (default 16): **Green "Seats available"** 0 to 6 taken, **Amber "Filling up"** 7 to 12 taken, **Red "Full"** 13 or more taken.
- **Stationary bubble:** when the server reports speed under 2 km/h across packets spanning at least 45 s, the marker shows *Stopped: loading or traffic*.
- **Coverage states, per route:** *Live* (at least one broadcaster in the last 90 s), *Stale* (last marker 90 s to 10 min old, shown greyed with age), and *No data* (nothing in 10 min). The app never says "no vehicles"; it says "No data from riders right now".
- **Estimated markers (CF1, 2026-10-17):** for the first part of the Stale state, from 90 s to 5 minutes without a packet, the marker is not left at its last fix. It is moved along its own route line from that fix at its recent speed (dead reckoning: the median of its speeds over the 90 s before its last packet, capped at 40 km/h), at most 2 km and never past the line's end. A vehicle that was stopped is not moved. The marker is drawn fainter than a Stale one and labelled *Estimated*; it shows no ETA, and arrival and distance alerts keep to the last real fix. From 5 to 10 minutes the marker is greyed at its last fix as above. Demo vehicles follow the same rule.
- **Coverage nudge (CF1):** when the picked route has no Live vehicle, a banner says *No live data for R4. Riding this route? Share your seats to help others!* with a button that opens Relay. Not shown in Night Mode, or to accounts that cannot see live vehicles.
- **Alternative route (CF1):** under the nudge, a chip suggests one other route that shares a stop with the picked route, passes within the walking limit of the commuter, and has a Live vehicle within 2 km of them (without a position: within 2 km of a stop of the picked route); the nearest such vehicle wins. Tapping it shows that route.
- **Map controls (CA1.1, 2026-10-22):** a column of round buttons at the right, top to bottom: zoom in (+) and zoom out (-), one level a tap (besides pinching); Locate, which zooms in on the commuter (a simulated stop or a dropped pin directly) and, tapped again before the map is moved, zooms out as far as the map goes, still on the commuter; a GPS position outside the Butuan map shows the whole map with "You are outside the Butuan map"; Relay; Routes (the route list); and Tunie (19.5). There is no card at the bottom while no route is picked; the greeting and "Where are you heading today?" moved to My Rides (19.1).
- **All running multicabs (CA1.1):** while no route is picked (*All routes*), the Map shows the running multicabs (Live or Stale, not No data) of every route, and the Map always opens there; the route list picks one (Settings' Default route was removed, 2026-10-22). A tap on a multicab picks its route and opens its card. A picked route still shows only its own multicabs. The route list starts with *All routes* (the default, marked with a check), which goes back to every route. While one multicab's card is open, or one is tracked, the others fade so it stands out. Live data stays for team accounts (0.7). The route last picked (or All routes) is kept on the phone, so the Map opens on it again after a restart. While the tracked multicab is within 1 km, the Map tab's icon carries a red dot, seen from every tab, like Check-in's during a check-in.
- **Relay details (CA1.1):** while a relay shares the rider's location, a tap on its bar on the Map opens the details: the distance left to the destination (by road along the route line when the rider and the destination are on it, else straight), a bar of how much of the ride is done since sharing started, about how many minutes are left at the current speed (hidden under 5 km/h, as the ETA), the route and stop, the multicab and the seats shared, and how long it has been shared and when it asks *Still riding?* (RL1: 3 hours; it also ends 60 s after reaching the stop, or after standing still, 8.4).
- **Energy:** opening live view costs 1 Energy per 30 minute viewing session. The pilot has a free-viewing period (section 11.1).
- **Night view:** after the night cutoff the map shows only static node updates and is free (section 10.4).

### 7.4 Freshness and ETA

- **MVP:** each marker shows its age and distance along the route, for example *Seen 40 s ago, 1.4 km from you*.
- **Phase 2:** a simple ETA is computed on the server from the vehicle's progress along the polyline and a rolling average of segment speeds by time of day. No machine learning. ETAs are hidden when fewer than 20 samples exist for a segment.

### 7.5 Station check-in (demand signal)

- **Flow:** at a recognized terminal, the user picks a route and taps Check-In.
- **Geofence:** distance to the station must be within the station's configured radius (default 60 m, adjustable per terminal), and GPS accuracy must be 25 m or better. The v1.0 value of 40 m is too tight for large terminals where GPS error is 10 to 20 m.
- **Check in at a stop or near the route (CA3, Emjay 2026-10-30; replaces CA2's fill stops):** multicabs pick people up anywhere on their route, so the Check-in card offers two choices. *At a stop:* within 300 m of the stop. *Near the route:* anywhere within 40 m of the line of a route they ping, counted as **near** the nearest stop of those routes. Only the original PUV stops exist; the fill stops of CA2 are gone. The phone decides; the server receives the stop code and the near flag, never coordinates (section 15). The point where the commuter stood stays on the phone, and the boarding prompt looks for a multicab there. **The check-in ends by itself** when the commuter leaves: a stop check-in once the phone is more than 300 m from the stop, a near check-in once it is more than 70 m from where it was made, each after 2 GPS readings in a row outside (one jumpy reading does not end it). This runs only while the app is open; with the app closed, the check-in runs out at its expiry. Drivers see those near a stop on a line under it (section 12.3, v4). Accepted risk: someone living beside a route can check in from home; Energy, one active check-in and the trust signals keep that to 1 at one stop for at most 15 minutes.
- **Anti-fraud:** one active check-in per user; check-in is refused if activity recognition reports `IN_VEHICLE`.
- **Lifecycle:** each check-in has an `expires_at` of 15 minutes. A local reminder at 5 minutes asks *Have you boarded yet?*. **Boarding prompt (CA1.1, 2026-10-22):** the app asks *Did you board R4 · DEMO 01?* on any tab as soon as a Live multicab of a pinged route stands at the stop (0.3), each multicab once, and the 5-minute reminder asks the same; *Yes, I boarded* ends the check-in as boarded, *Not yet* keeps waiting. In-app only for now. Heatmap counts only include rows where `expires_at` is in the future, so counts are accurate even if cleanup is delayed. A cron job deletes expired rows every minute.
- **Auto-cancel:** when a verified boarding on the same route is detected, the check-in is cancelled immediately and the heatmap count drops.

## 8. Passenger relay engine

The relay engine turns a commuter's ride into a verified live marker with the least possible tapping and battery use. It is "zero-tap" only when the app is armed; otherwise it needs one tap.

### 8.1 Relay session lifecycle

1. **Arm.** The app arms detection when the user checks in at a station, opens the app, or taps *I'm about to ride*. Armed mode runs a low-power BLE scan for a limited time (default 15 minutes).
2. **Detect.** The scan matches the beacon's service UUID. The app reads the vehicle ID and rotating code from the beacon (section 8.2).
3. **Prompt.** A heads-up notification says *Boarded Route 4, plate ABC 123? Confirm*. One tap confirms. If the app is in the foreground, it shows the same prompt in-app.
4. **Hydrate.** If other riders already relay for this vehicle, the app shows the current seat state (for example Amber) and the rider confirms or changes it with one tap.
5. **Declare destination.** The rider picks a destination node on the route. It must lie ahead of the boarding point along the route.
6. **Verify.** The verification window runs (section 10.2). Until it passes, the report is private.
7. **Relay.** The server assigns Primary or Secondary status (section 8.3).
8. **Arrive.** Within 50 m of the destination, a 60 s arrival countdown starts. When it ends, location tracking stops, energy is awarded and the baton passes.

The v1.0 claim of a constant background scan is replaced by armed scanning. On Android, scans registered with a `PendingIntent` can wake the app from the background at low power, which is how the boarding prompt can appear even if the app was swiped away. Vendor battery managers may still block this (section 8.5).

### 8.2 BLE beacon and anti-cloning

The driver phone advertises as a BLE peripheral using a native Kotlin module. `react-native-ble-plx` only scans, so it is used on the commuter side only.

- **Filtering:** the commuter app scans with a service UUID filter, so Android can match in the system Bluetooth stack with minimal CPU.
- **Payload:** version (1 byte), vehicle short ID (2 bytes), time slot (2 bytes) and a truncated HMAC (4 bytes), carried as service data. The HMAC is `HMAC-SHA256(vehicleSecret, vehicleId || timeSlot)` and the time slot rolls every 60 s. This fits the 31-byte legacy advertising limit when placed in the scan response.
- **Validation:** the commuter app forwards the payload with the boarding report. The server holds the vehicle secret and accepts the current slot plus or minus one. When offline, the report is buffered and validated on reconnect.
- **What this protects against:** copying a static beacon with a free BLE tool. A copied beacon expires within about two minutes and must be physically near the rider.
- **What it does not protect against:** a determined attacker who extracts a vehicle's secret. Secrets can be rotated by the admin console, and verification still needs motion and route checks.
- **Clock:** driver phones receive network time from the SIM's carrier. If the clock drifts more than 90 s, the driver app shows a warning.

### 8.3 Baton: Primary and Secondary nodes

Only one phone per vehicle uses continuous GPS.

- **Selection score:** the server ranks riders by distance remaining along the route to their declared destination, measured by progress along the polyline, not straight-line distance.
- **Eligibility:** battery at 30% or higher, location permission granted, and not in battery saver mode. Ineligible riders can still be Secondary.
- **Anti-gaming:** a destination change after boarding drops the rider to the back of the queue. The daily reward caps (section 11.1) limit any gain from over-declaring.
- **Secondary nodes:** GPS stays idle. They can update seat counts and keep a light keepalive.
- **Handoff:** when the Primary arrives or drops out, the server promotes the next rider. Because a sleeping phone cannot be reliably woken, all eligible Secondary nodes keep a **low-rate fused location listener** (about one fix per 60 s, balanced power accuracy). On promotion, the app raises its rate. Handoff is best-effort and can take up to 60 s.
- **Gap handling:** the marker shows as *Stale* during a gap rather than disappearing.

### 8.4 Polling, heartbeat and data budget

The v1.0 "150 m AND 10 s" rule is replaced because it produced updates about every 18 s at 30 km/h and sent nothing for a stopped vehicle.

| Rule | Value | Reason |
| --- | --- | --- |
| Send a position when | 100 m moved **or** 30 s elapsed, whichever is first | Smooth motion in traffic; stopped vehicles still report |
| Stationary flag | Set when speed is under 2 km/h; sent once, then repeated every 30 s | Lets the server compute the 45 s stopped bubble |
| Server liveness timeout | 90 s with no packet from the Primary | Three missed packets; avoids false "phone died" in traffic |
| Packet size | Under 150 bytes (vehicle ID, lat, lon, speed, heading, seats, timestamp) | Keeps data under 150 KB per hour |
| Offline buffer | Ring buffer of 60 points in SQLite, oldest dropped first | Covers about 15 to 30 minutes of coverage loss; flushed in order on reconnect |
| Idle stop | Under 30 m radius movement for 20 minutes outside a terminal geofence, or 30 minutes inside one; held inside a high-traffic zone (0.3) | Avoids GPS-jitter false positives and does not kill sessions during terminal loading or at long traffic lights |
| Hard cap | 3 hours per session, with a prompt to continue | Prevents forgotten sessions |

GPS fixes with accuracy worse than 30 m are discarded before the rules apply. The 150 m / 10 s and 10-minute rules from v1.0 are retired.

**Prototype relay broadcast (T1, 2026-10-21).** Until the Primary Broadcaster and the foreground service (8.5) are built, a team account's relay sent with GPS is the broadcaster:

- **Foreground only.** Positions are made only while the app is open; nothing is sent from the background.
- **Manual vehicle picker.** The rider picks the multicab in the Relay panel (unverified, D5). Without a picked multicab the location moves no marker.
- **Store and forward.** Every position that passes the send rule above goes into the offline buffer first and is sent from there. The whole buffer, oldest first, goes as one request: `{"v":"R4-TEST-01","p":[[ts,lat,lon,kmh,heading,seats],...]}`, about 60 bytes for one position and about 40 bytes for each further one (coordinates to 5 decimals). A request that gets no answer, or a passing error (401, 408, 429, 5xx), keeps the buffer and is tried again later. Any other refusal drops the batch.
- **On the server.** Every position up to 30 minutes old goes into the server's position history once (a batch sent again is not stored twice). The newest position moves the marker only if it is within the 120 s timestamp limit and newer than the marker. The single-packet form stays for the simulator.
- **Team accounts only.** Writers stay on the team allowlist (0.7). Seats are sent as the middle of the band the rider picked.

### 8.5 Android background reliability

Background reliability is the largest real-world risk, because low-end phones from several vendors end background work aggressively.

- **Foreground service** with a visible notification during relay, declared with the `location` foreground service type (required on Android 14 and newer).
- **Doze and battery optimization:** onboarding explains how to exempt the app, with vendor-specific steps for the most common brands in the pilot. Direct battery-optimization exemption requests are used only if Play policy allows.
- **Health check:** the app records when its service was last killed and shows the user a one-time fix guide.
- **Permissions fallback:** the app degrades step by step (section 4.2) instead of failing.
- **Testing:** a device matrix covering at least six vendor skins is part of the validation plan (section 17).

## 9. Driver app and SMS gateway specifications

The driver app runs on a low-end Android phone with no data plan. It advertises the BLE beacon, receives signed demand updates by SMS and draws a static offline heatmap.

### 9.1 Driver value and privacy

- **What drivers get:** a glanceable list of where commuters are waiting, by terminal, so they can time departures and avoid empty trips.
- **What drivers are not subjected to:** no individual driver tracking, scoring or reports. The public map shows vehicles by route and plate only.
- **Cooperative agreement:** pilot participation is voluntary and covered by an agreement signed with the cooperative before provisioning.

### 9.2 BLE advertiser

- Uses Android's `BluetoothLeAdvertiser` through a Kotlin native module, started by a foreground service so it survives screen-off.
- Advertises the service UUID and the rotating signed payload from section 8.2, at a balanced interval (for example 250 to 500 ms) that trades RSSI sampling against battery.
- Restarts automatically after a reboot or if Bluetooth is toggled.
- Battery use is a hypothesis to be measured. The device is on vehicle charge, so the main concern is heat and charger reliability.

### 9.3 SMS receiver (demand heatmap)

On Android, any app with SMS permission can read an incoming text, but only the default messaging app can stop other apps from showing it. The v1.0 claim that the driver "never sees a notification" is therefore replaced with two paths.

| Path | How it works | Trade-offs |
| --- | --- | --- |
| Primary: data SMS | The gateway app sends a binary message to a private port with `sendDataMessage`. The driver app receives it through the `DATA_SMS_RECEIVED` broadcast. These messages do not appear in the inbox. | Needs carrier support for port-addressed SMS; must be tested on the pilot network (tested 2026-10-18: Globe gateway to a TNT phone, all delivered) |
| Fallback: text SMS | Plain text signed message read through `SMS_RECEIVED`. | The default messaging app may still show a notification; the driver device should have notifications disabled for that app |

- **Distribution:** SMS permissions are heavily restricted on Google Play, so the driver app is distributed as a signed APK by the cooperative and the research team, not through the Play Store.
- **Sender whitelist:** the app accepts messages only from the gateway number.
- **Signature and sequence:** every message carries a sequence number and a truncated HMAC. Messages with a bad signature, an old sequence number or a stale timestamp are dropped. This stops anyone from sending a fake heatmap.
- **Stale data rule:** if no valid message arrives for 15 minutes, the heatmap greys out and shows the age of the last update.

### 9.4 Offline UI

- Static map of the assigned route with terminal icons.
- Glowing node over each terminal, sized by waiting count (0, 1 to 4, 5 to 9, 10 or more).
- Large text and 48 dp or larger touch targets, readable in sunlight and in a moving vehicle.
- Status strip showing the beacon (Bluetooth on) and the battery, with "Charging" only while charging (owner decision, 2026-10-18). The time of the last SMS shows above the list and in the stale notice; clock drift shows as a warning only when the clock is off (section 8.2).

### 9.5 Provisioning

An admin provisions each driver device once, in person:

1. Install the signed APK.
2. Scan a one-time provisioning QR from the admin console containing the vehicle ID, route, plate, vehicle secret and gateway number.
3. Grant Bluetooth, SMS and notification permissions and run the self-test (beacon visible, test SMS received).
4. Record the device in the console. Lost or replaced devices have their secret rotated.

### 9.6 SMS gateway

- **Gateway app:** a small custom Kotlin app on a dedicated phone on mains power, with a UPS or power bank for outages. It pulls queued messages from the Node.js worker over HTTPS and sends them by SMS.
- **Dispatch policy:** send only when a terminal's count changes by 2 or more, when a terminal that had nobody waiting gets someone, or every 5 minutes while any count is above zero. This limits volume while a lone commuter at an empty terminal still reaches the driver within a minute (owner decision, 2026-10-15).
- **Minimum gap and daily cap (CA2c, 2026-10-29):** a change, a newly filled stop or a clear waits until 120 s after the route's last message; changes meanwhile go in the next one. Each gateway SIM sends at most a daily cap (100 until the real SIM or promo limit is confirmed): past 80 % a route is texted only on the 5-minute interval, and at the cap nothing more that day, with an ops alert.
- **Operating hours:** all day (owner decision, 2026-10-18, so the app can be tested at any hour; the plan's Q6 was 05:00 to 21:00). Whether the pilot keeps 24/7 is decided before the pilot.
- **Volume planning:** at one message per 5 minutes over 14 operating hours, a vehicle receives about 170 messages a day (more if the pilot runs all day while people wait at night). A 10-vehicle pilot is then about 1,700 messages a day, which the SMS plan must be confirmed to allow.
- **Telco terms:** consumer "unlimited SMS" promos usually have fair-use rules. The project must either confirm written allowance, use several SIMs, or move to a licensed SMS provider before the pilot. This is a key risk (section 16).
- **Health monitoring:** the worker tracks send success, delivery latency and battery of the gateway phone and alerts the admin.

## 10. Verification, anti-spoofing and privacy protocols

No single check is trusted. A report becomes public only when beacon, motion and route-geometry checks all pass. Each threshold below is a starting value to be tuned from field data (section 17).

### 10.1 Terminal beacon collision and the Smart Queue

**Problem:** several multicabs of the same route park side by side at terminals such as SM City, so a commuter can hear more than one beacon.

1. **Smoothing:** raw RSSI is smoothed with an exponential moving average (section 12.4). A beacon counts as present when its smoothed RSSI is stronger than the threshold for at least 3 consecutive seconds.
2. **Threshold:** the starting value is -65 dBm. This is a hypothesis; the metal body, open windows and phone position (pocket, bag, hand) all change RSSI, so the final value comes from the field calibration in section 17.
3. **Margin rule:** when two beacons pass, the stronger one wins only if it leads by at least 8 dB (starting value). Otherwise the case goes to the Smart Queue.
4. **Smart Queue:** if two beacons remain ambiguous and the vehicle is stationary, the app does not ask the rider to choose. It queues the report as *Stopped: loading* and holds the reward in escrow.
5. **Kinematic divergence:** when the vehicle departs, the wrong beacon fades from range within roughly 15 m. The app locks the session to the beacon that stays in range while the rider moves, then releases the reward.
6. **Fallback:** if the ambiguity is not resolved within 10 minutes, the session is dropped and no reward is given.

### 10.2 Verification window

Before a report is published, the first part of the ride must pass all four tests. The window is about 30 s of travel, extended up to 90 s in slow traffic.

| Test | Pass condition | Notes |
| --- | --- | --- |
| BLE presence | Beacon above threshold for 3 s or more and signature valid | Server validates the rotating code |
| Motion | Activity recognition reports `IN_VEHICLE` for at least 60% of samples, **or** GPS speed holds at 25 km/h or more for 20 s | A grace window replaces v1.0's immediate abort, because stop-and-go traffic often looks like `STILL` or `WALKING` |
| Route geometry | Fix is within 30 m of the primary or an active alternative polyline | Uses GPS fixes of 30 m accuracy or better |
| Displacement | At least 50 m travelled along the route | Measured by progress along the polyline |

### 10.3 Device integrity, mock locations and bans

- **Mock location:** the app checks the mock flag on each fix (`isMock()` on newer Android, `isFromMockProvider()` on older). A flagged fix is discarded and counted as a risk signal.
- **Play Integrity:** at registration and before a user's first relay of each day, the app requests a Play Integrity verdict. A failed verdict blocks relay and rewards but not offline features.
- **Device fingerprint:** the Android ID is combined with a server-side secret using HMAC-SHA256 and the result is stored. A plain hash of a stable identifier is still personal data, so the keyed form is used and access is limited.
- **What a ban is:** a suspension is bound to the account and the device fingerprint. It raises the cost of abuse but is **not** impossible to evade: a factory reset changes the Android ID, and rooted or emulated devices can fake it. Integrity checks and the strike rules reduce, but do not remove, this risk.
- **Risk score:** repeated mock-location hits, failed integrity or impossible movement (speed jumps, teleporting) raise a risk score that routes the account to moderator review.

### 10.4 Night Mode (anti-stalking)

The v1.0 rule turned off GPS collection from 6:00 PM, which removed the product during the evening commute and also made night reports impossible to verify. v2.0 changes **what is published**, not **what is collected**.

- **Window:** set on the server in Asia/Manila time, default **9:00 PM to 4:59 AM**. The window is configurable. A 9:00 PM start keeps the whole evening commute fully live. Clients cannot change it by altering their clock.
- **Collection continues.** Verified relays still run, so the system stays accurate and energy can still be earned at night.
- **Publishing changes.** During Night Mode the public map shows no moving markers and no live coordinates. It shows **static node updates** only, for example *Route 4 passed CSU 3 minutes ago*, snapped to a terminal or stop and delayed by at least 2 minutes.
- **Cost:** the static node view is free (0 Energy).
- **Retention:** raw coordinates from night sessions are deleted after 24 hours; only node passage events and counts are kept.
- **All hours:** markers represent vehicles, never riders, and show no rider identity, avatar or account information.

### 10.5 Dynamic detour detection

Bridge closures force detours. A rigid route-snap rule would reject honest riders, so detours are first-class.

- The route database stores the primary polyline and known alternative polylines (for example the Macapagal Bridge bypass).
- If a fix is more than 30 m from the primary line, Turf.js checks the alternatives. If it snaps to an alternative and activity recognition still reports a vehicle, the session enters **Active Detour Mode**. The polyline renders dashed yellow and the session stays valid.
- **Admin advisories:** an admin can mark a detour active for a route from the console. The server then accepts the alternative polyline immediately for all riders, and the data is synced to devices as a route data update.
- **Unknown detours:** if many verified sessions on a route fall outside every stored polyline, the console flags the route so an admin can add or correct an alternative.
- **Fare:** detours do not change the fare, which always uses the authorized route length.

## 11. Tokenomics, trust and moderation

Incentives reward verified contribution and are limited by daily caps so they cannot be farmed. Early users are not charged for a map that is still sparse.

### 11.1 Tracking Energy economy

- **Wallet:** hard cap of 5 Energy per user.
- **Spending:** opening live view costs 1 Energy per 30 minute viewing session. Offline routing, offline maps, the fare calculator and the Night Mode static view are always free.
- **Pioneer period:** on pilot routes, live view is free until route coverage reaches the target in section 3.3 for two consecutive weeks. This avoids charging users for a map with few markers.

| Source | Energy | Cap | Condition |
| --- | --- | --- | --- |
| Passive refill | +1 | 2 per 24 h, one every 12 h | None |
| Verified relay with GPS | +1.0 | 1 per day | Passes verification window and arrival stop |
| Verified relay, seat updates only | +0.5 | 1 per day | Passes BLE and motion checks |
| Station check-in | +0.3 | 1 per day | Geofence and accuracy pass; not cancelled by fraud checks |

**Prototype economy (CA1.1, Emjay, 2026-10-22; overrides the table for the app):** every account starts with 5 Energy (the full wallet). A station check-in **costs** 0.3 Energy for each route pinged (pinging drivers may cost SMS money later), so the commuter picks only the routes they would take; the check-in card shows the cost and no more routes can be ticked than the balance pays for. Energy comes back only by waiting (the passive refill, its 12-hour clock started by the welcome Energy) or by a relay with GPS (+1.0, once a day); a relay without GPS earns nothing. Tracking one multicab still costs 1 Energy per 30 minutes. A subscription may come later. The server enforces it (`20261022000000_checkin_points.sql`).

A commuter who relays on the morning ride earns enough to open live view on the evening ride, so the loop is self-funding. Rewards are held in escrow while a session is in the Smart Queue and released on lock. All caps reset at midnight Asia/Manila time.

### 11.2 Trust and Merit

The v1.0 mix of a 0 to 100 score and 1,000 point conversion is replaced by two clearly separate values.

| Value | Meaning | Range | Visible to user |
| --- | --- | --- | --- |
| Trust Points (TP) | Lifetime total earned from verified activity | 0 and up | Yes |
| Trust Level | Share of the user's last 30 days of reports that were verified and not upheld as flagged, shown only after 10 reports | 0 to 100 | Yes |
| Merit Point | Earned automatically at every 1,000 TP; maximum 3 held | 0 to 3 | Shown only after use |

- **TP earning:** verified relay with GPS +10, verified relay without GPS +5, check-in +2. Daily TP is capped at 25.
- **Merit shield:** when a strike would be applied to an otherwise trusted user, one Merit Point absorbs it. The user is told afterwards that a shield was used. This keeps the shield from being invisible, and lets the user see why a strike did not apply.

### 11.3 Flagging, strikes and appeals

The v1.0 rule of 10 unique flaggers cannot be reached with a small user base and is easy to brigade. It is replaced by a weighted and moderated process.

1. **Who can flag:** only users who viewed the marker in the last 10 minutes and have a Trust Level of 30 or more, or a new account that has been active for 7 days. Flags per user are rate-limited.
2. **Tags:** `FALSE_LOCATION`, `SPAMMING`, `NOT_A_PUV`, plus optional text.
3. **Contested report:** a report is marked contested when at least 3 unique, eligible users flag it within 24 hours. The system also records automatic evidence, such as route-geometry failures or mock-location flags.
4. **Strike decision:** a strike is issued when a moderator confirms the report, or when automatic evidence and at least 3 flags agree. Strikes target the **account that produced the report**. If the Primary role changed hands mid-ride, the strike goes to the user who was Primary at the flagged time.
5. **Suspension:** two strikes within 30 days lead to a 7-day suspension, tied to the account and device fingerprint. Strikes expire after 60 days.
6. **Brigading defense:** flags from accounts that mostly flag the same target, or from accounts created within the last 48 hours, carry no weight.
7. **Appeals:** every strike and suspension shows the reason and offers an in-app appeal. A moderator reviews it within 72 hours, and an upheld appeal removes the strike and restores any shield used.
8. **Transparency:** users can see their own strike history and the reason in plain language.

## 12. Data models, protocols and formulas

### 12.1 Local SQLite schema (offline data)

The local database is read-only except for the telemetry buffer. Route data carries a version so devices can sync updates.

```sql
CREATE TABLE franchise_routes (
  route_id        TEXT PRIMARY KEY,          -- one row per directed line, 'R4-OUT'
  route_code      TEXT NOT NULL,             -- public route code, 'R4'
  direction       TEXT NOT NULL CHECK (direction IN ('outbound','return')),
  route_name      TEXT NOT NULL,
  route_color     TEXT NOT NULL,             -- '#00F5D4'
  direction_mode  TEXT NOT NULL CHECK (direction_mode IN ('one_way','two_way','loop')),
  base_fare       REAL NOT NULL DEFAULT 14.00,
  base_km         REAL NOT NULL DEFAULT 4.0,
  per_km_rate     REAL NOT NULL DEFAULT 2.00,
  primary_geojson TEXT NOT NULL,             -- GeoJSON Feature (LineString)
  data_version    INTEGER NOT NULL
);

CREATE TABLE route_alternatives (
  alt_id    TEXT PRIMARY KEY,
  route_id  TEXT NOT NULL REFERENCES franchise_routes(route_id),
  label     TEXT NOT NULL,                   -- 'Macapagal Bridge bypass'
  geojson   TEXT NOT NULL,
  active    INTEGER NOT NULL DEFAULT 0       -- set by admin advisory
);

CREATE TABLE stations (
  station_id  TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,          -- 'SM', 'CSU'
  name        TEXT NOT NULL,
  lat         REAL NOT NULL,
  lon         REAL NOT NULL,
  geofence_m  INTEGER NOT NULL DEFAULT 60
);

CREATE TABLE route_stations (
  route_id     TEXT NOT NULL REFERENCES franchise_routes(route_id),
  station_id   TEXT NOT NULL REFERENCES stations(station_id),
  seq          INTEGER NOT NULL,
  chainage_km  REAL NOT NULL,                -- distance along the route
  PRIMARY KEY (route_id, station_id)
);

CREATE TABLE telemetry_buffer (              -- ring buffer, 60 rows max
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  payload     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
```

### 12.2 Cloud data model (Supabase Postgres)

Row Level Security is on for every table. Users can read only what their role allows, and writes go through Edge Functions that enforce the rules in this document.

| Table | Main fields | Notes |
| --- | --- | --- |
| `profiles` | user\_id, avatar\_id, trust\_points, merit\_points, energy, created\_at | No classification stored |
| `devices` | user\_id, device\_hash, integrity\_status, last\_seen | Keyed HMAC hash; ban state |
| `vehicles` | vehicle\_id, plate, route\_id, secret\_ref, active | Secrets in a vault, not in plain columns |
| `relay_sessions` | session\_id, user\_id, vehicle\_id, role, dest\_node, verified, started\_at, ended\_at | Raw location links kept 30 days |
| `telemetry_latest` | vehicle\_id, geom, speed, heading, seats, updated\_at | One row per vehicle, used by live view |
| `telemetry_raw` | session\_id, geom, speed, ts | Day mode kept 7 days; night sessions deleted after 24 h |
| `node_events` | route\_id, station\_id, passed\_at | Source of Night Mode static updates |
| `checkins` | user\_id, station\_id, route\_id, created\_at, expires\_at | Counts filter on expires\_at |
| `energy_ledger` | user\_id, delta, reason, created\_at | Append-only, audit trail |
| `flags`, `strikes`, `appeals` | reporter, target, tag, status, decision | Moderation workflow |
| `sms_outbox` | route\_id, seq, payload, status, attempts | Worker queue |
| `route_versions` | version, changed\_routes, published\_at | Drives OTA route sync |

### 12.3 SMS payload protocol v2 (heatmap)

**v3 (CA2-1, 2026-10-29):** the worker sends v3, which lists only the stops with someone waiting: `HM3|R4|0042|1930|F|SM:12,CSU:5|9F2C41AB`. `F` means every stop not listed is 0; a long update continues in `P` messages, which only add. An empty list is `-`. The data-SMS form has format byte `0x03` and one flag byte.

**v4 (CA3, 2026-10-30):** as v3, and a stop may carry the commuters checked in near it, apart from those at it: `HM4|R4|0042|1930|F|SMB:3+1,CSU:0+2|9F2C41AB` (3 at SM Butuan and 1 near it; nobody at CSU, 2 near it). The driver list shows them on a line under the stop, "– Near 1" (at night, bands only: "– Someone near"). The data-SMS form has format byte `0x04` and two more bytes per stop. The worker sends v4 only while someone is near a stop, v3 otherwise, so a driver app that reads only v3 still gets every other update. The driver app reads v2, v3 and v4. The rest of this section describes v2.

The message is ASCII and well under the 160-character single-SMS limit. Each message carries a sequence number, a local time, the demand counts and a truncated HMAC signature.

```text
HM2|<route>|<seq>|<HHMM>|<code>:<count>,<code>:<count>,...|<mac>
HM2|R4|0042|1930|SM:12,CSU:5,RBN:0|9F2C41AB
```

- `mac` is the first 4 bytes (8 hex characters) of `HMAC-SHA256(driverDeviceKey, everything before the last pipe)`.
- The driver app rejects the message if the sender is not the gateway number, the signature fails, the sequence number is not newer (wrap-around aware), or the time is more than 30 minutes off.
- **Parser:** the original regex returned only the last station because JavaScript keeps only the final repetition of a repeated capture group. Validate the whole message with one regex, then split the list.

```javascript
const RE = /^HM2\|(R\d{1,2})\|(\d{4})\|(\d{4})\|([A-Z]{2,4}:\d{1,3}(?:,[A-Z]{2,4}:\d{1,3})*)\|([0-9A-F]{8})$/;

function parseHeatmap(sms) {
  const m = RE.exec(sms.trim());
  if (!m) return null;
  const [, route, seq, hhmm, list, mac] = m;
  const nodes = list.split(',').map(s => {
    const [code, count] = s.split(':');
    return { code, count: Number(count) };
  });
  return { route, seq: Number(seq), hhmm, nodes, mac };
}
```

The primary data-SMS path carries the same fields in a compact binary form, which fits more terminals per message.

### 12.4 Formulas

**Fare.** Let D be the authorized route-slice distance in km between boarding and alighting nodes, F0 the base fare, D0 the base distance, r the per-km rate and M the discount multiplier (0.8 for Student, Senior Citizen and PWD, 1.0 for Regular).

```latex
Fare = \left( F_0 + \max\bigl(0,\ \lceil D - D_0 \rceil\bigr) \times r \right) \times M
```

With the v1.0 values F0 = 15.00, D0 = 4.0 and r = 2.00, a 6.3 km ride is 15 + 3 × 2 = ₱21.00 for a regular fare and ₱16.80 with the discount before rounding. With the app's values since 2026-10-22 (F0 = 14.00, still to be confirmed against the official order for Butuan multicabs) it is 14 + 3 × 2 = ₱20.00, and ₱16.00 with the discount.

**RSSI smoothing.** An exponential moving average with α = 0.3 reduces flicker from signal bounce.

```latex
RSSI_t = \alpha \cdot RSSI_{raw} + (1 - \alpha) \cdot RSSI_{t-1}
```

**Geofence distance.** Check-in and arrival use the Haversine distance between the GPS fix and the station or destination node, together with a GPS accuracy gate.

### 12.5 Pilot route placeholder data (Route 4, De Oro)

These values are placeholders so the prototype can be built now. Replace them with surveyed or official data before the pilot. The route description is read from the Butuan City PUJ (multicab) route map, October 2026 update, which cites City Ordinance No. 7194-2024 (Local Public Transport Route Plan).

**Route as listed on the map:** Jeepney Terminal, Rosales Ave, JAQNO, R. Calo St, T. Sanchez St, M. Calo St, Ampayon, De Oro, JAQNO, R. Calo St, R. Rosales St, North Montilla Blvd, back to Jeepney Terminal.

Unlike routes listed with "vice versa", R4's return path is not the reverse of its outbound path. The prototype therefore stores **two polylines** for R4 (outbound and return), and the routing and fare engines treat them as separate directed lines. The map is marked as not geographically to scale, so it cannot supply the polyline itself. Trace it from a GPS ride on the route or request the city's route plan data.

| Placeholder code | Location | Latitude | Longitude | Status |
| --- | --- | --- | --- | --- |
| RCA | 553 R. Calo, Butuan City (Dunkin Donut) | 8.947459 | 125.541426 | Candidate stop, unconfirmed |
| MCA | 8-318 M. Calo St, Butuan City | 8.947134 | 125.544259 | Candidate stop, unconfirmed |
| JCA | J C Aquino Ave, Butuan City | 8.947506 | 125.541979 | Candidate stop, unconfirmed |
| TSO | Tandang Sora Pob. (Bgy. 12), Butuan City | 8.946096 | 125.533083 | Candidate stop, unconfirmed |
| IMA | Imadejas Pob. (Bgy. 24), Butuan City | 8.947550 | 125.531184 | Candidate stop, unconfirmed |
| DEO | De Oro, near the Free Methodist Church | 8.9165511 | 125.6420476 | Placeholder end-point station, unconfirmed |

Still missing: coordinates for Jeepney Terminal and Ampayon, the real outbound and return polylines, the official fare, and the vehicle list. The placeholder codes follow the letters-only station code format used in the SMS protocol (section 12.3), so a sample message for the pilot reads `HM2|R4|0001|0800|RCA:3,MCA:1,JCA:0|XXXXXXXX`.

#### Placeholder polyline

Until the real route is traced, the prototype uses a **placeholder polyline**: straight segments joining the placeholder stops in travel order, ending at an approximate De Oro point (`DEO`, 8.9165511, 125.6420476, taken from a Google Maps link near the Free Methodist Church in De Oro). The stop order is an assumption.

Coordinates are in GeoJSON order, **longitude first, then latitude**. The return line is the outbound line reversed, because the real return path has not been traced yet. Straight segments cut across blocks, so the 30 m route snap rule will fail on a real ride. That is expected with this data. The unit tests and simulated rides use these lines, and the real polylines replace them by bumping `route_data_version`.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "route_id": "R4", "direction": "outbound", "placeholder": true },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [125.531184, 8.947550],
          [125.533083, 8.946096],
          [125.541426, 8.947459],
          [125.541979, 8.947506],
          [125.544259, 8.947134],
          [125.6420476, 8.9165511]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": { "route_id": "R4", "direction": "return", "placeholder": true },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [125.6420476, 8.9165511],
          [125.544259, 8.947134],
          [125.541979, 8.947506],
          [125.541426, 8.947459],
          [125.533083, 8.946096],
          [125.531184, 8.947550]
        ]
      }
    }
  ]
}
```

Stop order along the outbound line is IMA, TSO, RCA, JCA, MCA, then DEO. The seed script splits this file into the two `primary_geojson` rows for the outbound and return directions (section 12.1).

## 13. Non-functional requirements (ISO/IEC 25010)

Every requirement below is measurable. The v1.0 wording ("100% reliability", "indefinitely") is replaced with targets that a test can pass or fail.

| Quality | Requirement | Target | Test |
| --- | --- | --- | --- |
| Performance efficiency | Live map frame rate with 50 markers in view on the reference device | 55 FPS or higher on average | Profiler run |
| Performance efficiency | Offline route plus fare computation on the pilot route (repeat with all 7 routes before Phase 2) | 250 ms or less at p95 on a 3 GB device | On-device benchmark |
| Performance efficiency | Cold start to usable offline map | 4 s or less | Timed launch |
| Reliability | Offline features in airplane mode | No crashes and no unhandled promise rejections over a 30 minute scripted session | Automated and manual run |
| Reliability | Telemetry delivery after a 10 minute signal loss | 95% of buffered points delivered in order after reconnect | Tunnel simulation |
| Reliability | Marker freshness while broadcasting | p90 age of 30 s or less | Server logs |
| Reliability | SMS gateway delivery latency | p90 of 60 s or less; delivery rate 98% or higher in a 7 day trial | Gateway logs |
| Security | Boarding code cannot be replayed after expiry | Codes older than 2 slots rejected in 100% of tests | Security test |
| Security | Night Mode window enforced by the server | Changing the phone clock has no effect on what is published | Clock manipulation test |
| Security | Sensitive values protected | Device fingerprint is a keyed HMAC; vehicle secrets stored in a vault; all transport over TLS | Code and config review |
| Privacy | Raw night coordinates | Deleted within 24 h in 100% of audits | Retention job audit |
| Operability | Touch targets and readability | All primary controls 48 dp or larger; text contrast meets WCAG AA | UI audit |
| Operability | Language | English and Cebuano UI strings for all user-facing text | Review |
| Resource use | Battery cost for Primary Broadcaster | 5% per hour or less | Controlled ride |
| Resource use | Mobile data while broadcasting | 150 KB per hour or less | Network stats |
| Compatibility | Supported Android range and devices | Android 8.0 and newer, tested on at least six vendor skins | Device matrix |
| Maintainability | Route data update without an app release | Route version change applied on next online launch | Sync test |

## 14. Edge cases and failure recovery

Each row names what the system sees and what it does automatically. Where recovery is best-effort, the table says so.

| Scenario | What the system detects | Automatic recovery |
| --- | --- | --- |
| Driver phone dies or Bluetooth is switched off | Beacon disappears mid-ride | The session continues on GPS if speed stays above 15 km/h and the route snap holds. Reward is still given on arrival. The vehicle is marked "beacon lost" for the admin |
| Primary Broadcaster's phone dies | No packet for 90 s | Server promotes the next eligible Secondary node. Marker shows Stale during the gap, up to about 60 s |
| Phone killed by vendor battery manager | Session service stops without an arrival or user action | App records the event on next open and shows a fix guide; server treats it as a dropout and promotes another node |
| No cellular data on the ride | Upload fails | Points are buffered (60 max, oldest dropped) and flushed in order. Live view and rewards wait for reconnect |
| Complete network outage in the city | Server unreachable | App stays fully usable offline: map, blue dot, routing and fares. Live features pause with a visible banner |
| Supabase outage | API errors | Clients keep offline features; heatmap SMS pauses and resumes from the outbox |
| SMS gateway SIM blocked | Send failures or delivery receipts missing | Worker backs off, switches to a second SIM or provider if configured, and alerts the admin. Driver apps grey out stale heatmaps after 15 minutes |
| Gateway phone loses power | Heartbeat from the gateway stops | Power bank carries it; admin alerted; messages queue |
| Two beacons overlap at a terminal | Margin rule fails | Smart Queue holds the report; resolved on departure or dropped after 10 minutes |
| Rider boards a different vehicle than the beacon they detected | Motion and route checks disagree | Verification fails; no public marker; no strike for a single event |
| Fake GPS app in use | Mock flag or impossible movement | Fix discarded, risk score raised, report goes to moderator review |
| Bridge closure or detour | Fix leaves the primary line within an alternative line | Active Detour Mode; admin advisory can enable it for everyone |
| Poor GPS accuracy near large buildings | Accuracy worse than 30 m | Fix discarded; check-in refused with a message to move into the open |
| Bluetooth or a permission is denied | Permission check fails | Reduced mode per section 4.2; the user can still confirm the route manually, but earns no reward |
| Driver phone clock drift | Beacon time slot differs from server by more than 90 s | Driver app shows a warning; admin notified; reports from that vehicle are marked unverified until fixed |
| Wrong or outdated route data | Many verified rides fall outside all polylines | Console flags the route; admin adds or fixes polyline and publishes a new route version |
| Admin changes the Night Mode window | Server config update | Applies at the next publishing cycle for all clients |

## 15. Privacy, legal and distribution compliance

The app handles location and device identifiers, so privacy is a design requirement, not an afterthought. This section is a requirements list, not legal advice; the project should have it reviewed by the university's Data Protection Officer or counsel before the pilot.

### 15.1 Data Privacy Act (RA 10173)

- **Lawful basis and consent:** explicit, separate consent for location collection, with a plain-language privacy notice in English and Cebuano shown before any permission request.
- **Data minimization:** no photos, no phone number, no classification stored in the cloud, and no driver identities on the public map.
- **Retention:** raw day-mode coordinates 7 days, raw night-mode coordinates 24 hours, session-to-user links 30 days for moderation, then aggregation or deletion. Energy and strike ledgers are kept for the life of the account.
- **Hashed identifiers are still personal data.** The device fingerprint is a keyed HMAC, not a plain hash, and is described that way in the privacy notice.
- **Data subject rights:** in-app account deletion, data export on request, and a contact point for privacy questions.
- **Minors:** students may be under 18. The consent flow and any parental consent need review before launch.
- **Registration and breach process:** the team should check whether registration with the National Privacy Commission applies and prepare a breach response procedure.

### 15.2 Distribution and platform policy

| App | Channel | Reason |
| --- | --- | --- |
| Commuter app | Google Play | Needs a background location declaration, foreground service type declarations, and a complete Data Safety form |
| Driver app | Signed APK, distributed by the cooperative and research team | SMS permissions are restricted on Play |
| Gateway app | Signed APK on one team-managed phone | Sends bulk SMS; Play policy does not suit it |

- **Offline maps size:** the vector tile set is delivered as a Play Asset Delivery pack; sideloaded builds download it on first launch.
- **Release signing:** all builds use a stored release key and signed APK checksums are published for the driver and gateway apps.

### 15.3 Telecom and transport regulation

- **Telco terms:** confirm in writing whether automated, high-volume SMS is permitted on the chosen plan. If not, use a licensed SMS provider.
- **Franchise data:** route polylines and fares are derived from authorized franchise information. Obtain written confirmation of the current route and fare data from LTFRB or the city transport office, and cite the fare order in the app's about page.
- **Fare disclaimer:** the in-app fare is an estimate and does not replace the official fare.
- **Road safety:** the commuter app never prompts the driver, and the driver app has no interactive tasks while the vehicle moves.

## 16. Risk register

The two highest risks are low adoption and Android background reliability. Both can sink the pilot even if every other part works. Owners are to be assigned by the team before the pilot starts.

| # | Risk | Likelihood | Impact | Mitigation | Early signal |
| --- | --- | --- | --- | --- | --- |
| 1 | Too few riders use the app, so most PUVs are invisible | High | High | A single pilot route, team-seeded rides, "No data" state, free viewing during the pioneer period, cooperative partnership | Coverage under 30% of operating hours after week 2 |
| 2 | Vendor battery managers kill relay sessions on low-end phones | High | High | Foreground service, vendor setup guide, health check, six-skin device matrix, handoff to next node | Session dropout rate above 20% |
| 3 | Telco blocks or throttles the gateway SIM | Medium | High | Written confirmation of terms, volume limits, second SIM or licensed provider, outbox with retry | Delivery rate under 95% |
| 4 | Data SMS to a port is filtered by the carrier | Medium | Medium | Test in week 1; use signed text SMS fallback with notifications off | Zero data SMS received in the test |
| 5 | BLE RSSI behaves differently from the assumed -65 dBm | High | Medium | Field calibration, margin rule, Smart Queue | Wrong-vehicle lock above 2% |
| 6 | Drivers do not use or trust the heatmap | Medium | High | Cooperative agreement, in-person onboarding, short feedback loop, no driver tracking | Fewer than half of drivers act on it |
| 7 | Location privacy incident or stalking concern | Low | High | Night Mode, vehicle-only markers, short retention, no rider identity on map | Any report of misuse |
| 8 | Fake or spoofed reports (mock GPS, cloned beacon) | Medium | Medium | Rotating beacon code, integrity checks, risk score, moderation | Rising mock-location hits |
| 9 | Brigading of honest users through flags | Medium | Medium | Eligibility rules, weighting, moderator confirmation, appeals | Many flags from new accounts |
| 10 | Wrong fare data or outdated polylines | Medium | Medium | Written source confirmation, versioned OTA updates, admin console, fare estimate label | Rider complaints, off-route spikes |
| 11 | Play Store rejection for background location or foreground service | Medium | Medium | Complete declarations and video, sideload channel for the pilot | Review rejection notice |
| 12 | Single gateway phone is a point of failure | Medium | Medium | Power bank, health alerts, second gateway device later | Gateway heartbeat gaps |
| 13 | Supabase free tier or cost limits reached | Low | Medium | Usage projections, rate limits, retention jobs | Quota warnings |
| 14 | Data Privacy Act compliance gaps | Medium | High | DPO review, consent flow, retention jobs, data subject tools | Review findings |

## 17. Validation and test plan

Before the pilot, the team runs short field experiments so that thresholds in this document come from measurements, not assumptions. Results feed back into section 10 and section 13.

### 17.1 Pre-pilot field experiments

| # | Experiment | What is varied | Output used for |
| --- | --- | --- | --- |
| E1 | BLE RSSI inside a multicab | Phone in pocket, bag, hand and on seat; windows open and closed; five seat positions; at least 300 samples per setting | RSSI threshold, EMA alpha, margin rule |
| E2 | Terminal collision test | Two to four same-route multicabs parked side by side at SM City and one more terminal | Margin rule, Smart Queue timing |
| E3 | GPS accuracy at terminals | Five terminals, open sky and covered areas, five phones | Geofence radius, accuracy gate |
| E4 | Battery and heat | Primary and Secondary roles on at least three phones, 2 hour rides | Battery targets, polling rules |
| E5 | Background survival | At least six vendor skins, screen-off rides of 60 minutes with and without exemptions | Setup guide, dropout rate |
| E6 | Data usage | One hour of broadcasting with Android network stats | Data budget |
| E7 | SMS path | Data SMS and text SMS on the pilot carrier, 7 days, measuring latency, loss and inbox or notification visibility | Primary path choice, volume plan |
| E8 | Routing benchmark | Pilot route on a 3 GB phone; repeat with all seven routes before Phase 2 | The 250 ms target |
| E9 | Activity recognition | Slow traffic, terminal queues, walking beside a vehicle | Motion rule and grace window |

### 17.2 Pilot protocol

- **Scope:** a single route, about 10 vehicles, 4 to 6 weeks, with team members riding at scheduled times to seed data.
- **Observer log:** an observer logs boardings, vehicle IDs and seat counts on a sample of rides to measure accuracy.
- **Weekly review:** each metric in section 3.3 is checked against target, with decisions to tune, hold or stop.

### 17.3 Acceptance criteria for expanding beyond the pilot

1. Position accuracy, freshness and wrong-vehicle lock targets in section 3.3 are met on the pilot route.
2. Gateway delivery rate is 98% or higher over the last 7 days.
3. Session dropout rate from vendor battery managers is 15% or lower after the setup guide.
4. No unresolved privacy incident.
5. Cooperative and city transport office agree in writing to extend to the next route.

## 18. Assumptions, open questions and glossary

Several values in this PRD are carried over from v1.0 or set as starting hypotheses. The items below need an owner and an answer before the pilot.

### 18.1 Open questions

- [ ] Current Butuan fare order: base fare, base distance, per-km rate, discount rounding rule
- [ ] Night Mode window: 9:00 PM start (proposed), to be confirmed with the cooperative
- [ ] Pilot route: Route 4 (De Oro) is chosen; stop coordinates are placeholders (section 12.5) until surveyed or provided by the city, so confirm the polyline and fare source
- [ ] Does the pilot carrier deliver port-addressed data SMS to the driver phones
- [ ] SMS plan: written confirmation of volume terms, or move to a licensed SMS provider
- [ ] Vehicle capacity: is 16 seats right for every pilot vehicle, or does it vary
- [ ] Cooperative agreement: who signs, and what data the cooperative may see
- [ ] Free viewing during the pioneer period: how long, and the exit rule
- [ ] Cebuano translation: who reviews the wording

### 18.2 Assumptions

- All commuters and drivers in scope use Android phones.
- Driver devices stay on vehicle charge and have a SIM that can receive SMS.
- Authorized route geometry exists in a usable digital form or can be traced by the team.
- The cooperative allows a phone to be mounted on the dashboard.
- Supabase free or low-cost tier is enough for a pilot of about 10 vehicles.

### 18.3 Glossary

| Term | Meaning |
| --- | --- |
| PUV | Public utility vehicle; here, the multicab |
| BLE | Bluetooth Low Energy |
| Primary Broadcaster | The one rider per vehicle whose phone uses continuous GPS |
| Secondary Node | A rider on the same vehicle whose GPS is idle |
| Smart Queue | Holding an ambiguous boarding report until the vehicle moves |
| Verification window | The first stretch of ride in which BLE, motion and route checks must pass |
| Active Detour Mode | Session state when the vehicle follows a known alternative route |
| Tracking Energy | In-app currency that pays for live view |
| Merit Point | Hidden shield that absorbs one strike |
| Pioneer period | Early phase where live view is free because coverage is still sparse |
| Data SMS | A binary SMS addressed to an app port instead of the inbox |

## 19. User flow v2 (2026-10-03)

Added at Emjay's request. **Where this section disagrees with an earlier section, this section wins.** Earlier sections are not rewritten; the table at the end lists what each overrides. The analysis is `docs/FLOW_GAP_ANALYSIS.md` and the build plan is `docs/IMPLEMENTATION_PLAN_FLOW.md`.

### 19.1 The flow

| Area | What the commuter experiences |
| --- | --- |
| Onboarding | A welcome from the app's persona with sign-in (an account is needed, 7.1), then an optional gender question, an automatically assigned avatar, the commuter type (Regular, Student, Senior Citizen, PWD), and frequent destinations, so the app can suggest which route to board. |
| Greeting | Every time the app opens, one short time-based line from the persona, for example "Where are we going right now?". |
| Live map | All broadcasting PUVs, browsed for free, with a little essential information. Tracking one PUV shows its position, a guide line and an ETA, and fades the other vehicles. |
| Station check-in | The commuter picks a route; its stations show as dots in the route colour, other routes fade; they check in at the station where they wait. |
| My Ride | Origin and destination, the route to board, and the estimated fare. CA1.1: until a destination is being picked, it opens with Tunton's greeting and "Where are you heading today?" (moved from the Map), which starts typing the destination. |
| Crowdsourcing (passenger relay) | The commuter reports the PUV they ride and its seat availability. Bluetooth identifies the vehicle (later); GPS is optional. A report with GPS is broadcast on the live map and earns 1 Energy; without GPS it is posted to the newsfeed and earns 0.5. Reports can be flagged as fake or spam. |
| Profile | Change the username, delete the account, see badges, change the avatar, settings and preferences. |

### 19.2 Decisions

| # | Decision |
| --- | --- |
| D1 | Browsing vehicles on the live map is free. **Tracking one PUV** (ETA, guide line, other vehicles faded) costs 1 Energy per 30-minute session. Tracking is free for the whole prototype and pilot; a config switch turns Energy on for demonstrations. The end rule of 11.1 stays for later. |
| D2 | Newsfeed posts show the pseudonymous username with a **neutral generated badge** (a colour and an initial derived from the username), **never the preset avatar**, and **never on the live map**. Content is fixed fields only, no free text: route, nearby stop, seats (three tiers) and one preset phrase. Posts last 60 minutes; a post with 3 unique flags is hidden and queued for review (both config constants). Only team accounts read and post in v0. |
| D3 | The gender question is optional (Male, Female, Prefer not to say). A stated gender picks at random from its 6 avatars; "Prefer not to say" picks from all 12. The pick happens **once**, is stored on the device and is never re-rolled except by "Shuffle" in Profile; changing the gender answer does not re-roll. The 12 avatars are vector drawings in code, no photos. **The gender answer, the commuter type, the avatar and the frequent destinations stay on the device** and appear only on the user's own Profile. |
| D4 | Frequent destinations come from a local seed file of landmarks (first the placeholder stops; real names and coordinates later), or a point tapped on the map. Names come from the file; the map has no text. |
| D5 | In the prototype a report uses a manual vehicle picker behind a development flag, and is marked unverified. Bluetooth boarding detection replaces it later (real phone and driver beacon). |
| D6 | Email and password accounts for now. An account is needed to use the app (AU1, 2026-10-21; 7.1): sign-in comes on the welcome step, and a saved session keeps working offline. The production sign-in method is decided later. |
| D7 | The username is generated automatically, can be regenerated or edited, is 3 to 20 characters of letters, numbers and underscore, passes a blocklist (a small English list and reserved names in one file now; Emjay supplies the English and Cebuano lists before any public release), and later must be unique in the cloud. |
| D8 | Badges are derived from simple counts (for example first report, 5 reports, first check-in). **No leaderboard and no ranking anywhere**, and no badge that compares users. |
| D9 | ETA is brought forward from Phase 2 in a simple form: distance along the route to the user's boarding point divided by the vehicle's recent speed. Shown only when the vehicle is approaching and the data is good enough; hidden otherwise. |
| D10 | Deleting the account wipes local data now; cloud deletion comes with the backend. |
| D11 | The greeting is one short, time-based line from a small set of variants in the strings file. |
| D12 | (2026-10-26, Emjay: Relay is the middle button of the bottom bar and no longer on the Map; the form works as it did on the Map; see change 20.) A floating Report button on the Live tab; the newsfeed lives in the expanded Live sheet. No fourth tab. |
| D13 | Check-in tab: route chips; the chosen route's stations as dots in its colour; other routes faded. Built generally, though only Route 4 exists. Check-in is a cloud table for team accounts. |
| D14 | (CA1.1, 2026-10-22: check-ins cost 0.3 per route pinged, a report without GPS earns nothing, and every account starts with 5; see 11.1.) Energy is a server-side ledger, built after the backend is live. Numbers as in 11.1: wallet cap 5; passive +1 every 12 hours (at most 2 a day); GPS report +1.0; report without GPS +0.5; check-in +0.3; each earning at most once a day; caps reset at midnight Asia/Manila. |

### 19.3 What this section overrides

| Earlier section | What changes |
| --- | --- |
| 0.6 Out of scope | Energy, the community feed, badges and ETA are now in the prototype scope, in the simple forms above. Trust Points, Merit shields, strikes and appeals stay out. |
| 3.1 Goals | Adds: personalised onboarding and route suggestions from frequent destinations, and a crowdsourced newsfeed for reports without GPS. |
| 3.3 Success metrics | Adds an ETA accuracy measure for D9 (to be defined with field data); the existing targets are unchanged. |
| 5.1 What is in the pilot | The pseudonymous community feed moves from Phase 3 into the pilot (D2, D12). |
| 6.1 Responsibilities | The commuter app also holds onboarding, landmarks, badges and the feed view; Supabase also holds the Energy ledger, feed posts and flags. |
| 7.1 Onboarding and profile | Avatars are assigned automatically from the optional gender answer (D3); a username (D7), badges (D8) and account deletion (D10) are added. The avatar stays visible only in the user's own profile; feed posts use a neutral badge instead (D2). |
| 7.3 Live tracker map | Viewing is free; only tracking one PUV costs Energy (D1). Tracking adds a guide line, an ETA and faded other vehicles. CF1 (2026-10-17): a Stale marker is moved along its line by dead reckoning from 90 s to 5 minutes and labelled Estimated; a route with no Live vehicle shows the coverage nudge and, when one fits, an alternative route. |
| 7.4 Freshness and ETA | A simple ETA moves from Phase 2 into the prototype (D9). |
| 7.5 Station check-in | Route-first selection with route-coloured station dots (D13). |
| 8.1 Relay session lifecycle | Reports can be sent without GPS (newsfeed, +0.5 Energy); the prototype uses a manual vehicle picker (D5). |
| 11.1 Tracking Energy | Spending changes from "opening live view" to "tracking one PUV" (D1). Earning numbers are unchanged (D14). |
| 11.3 Flagging | Feed posts can be flagged; the full strike and appeal process stays deferred. |
| 12.2 Cloud data model | Adds a username to `profiles`, and new `feed_posts`, `feed_flags` and `energy_ledger` details (see the flow plan). |

Sections 3.4 and 5.5, named in the request, do not exist in this document; the nearest sections are listed above (mapping confirmed by Emjay).

### 19.4 Further answers (2026-10-03)

| Topic | Answer |
| --- | --- |
| Persona | Named **Tunton**, short and friendly, English first; 6 to 8 time-based greeting variants in the strings file; Cebuano later from a team member. |
| Frequent destinations | At most 3. |
| Profile | The avatar button opens Profile, which also holds the settings rows (fare type, theme, About, Replay intro). |
| ETA limits | Hidden below 5 km/h, after 90 s without data, with fewer than 2 samples, or beyond 10 km. Config constants; starting hypotheses. |
| Relay broadcast (T1, 2026-10-21) | Approved by Emjay: foreground only, manual vehicle picker (unverified), store and forward with a batch form of ingest, team accounts only. See 8.4. |
| Relay gate (RL2a, 2026-10-23) | Approved by Emjay (D9 to D11): every relay needs the phone's location, a multicab beacon the server verifies, and the rider within 30 m of that multicab's line or 60 m of one of its stops; otherwise the Relay form is greyed out with the reason ("No registered multicab detected"). Bluetooth fills in the route and plate (never the beacon's id); the manual pickers are gone (demo data picks a made-up multicab by hand). One switch, "Show me on the live map", off by default and remembered: off, the relay is a Crowdsource post naming the stop where it was sent, with no coordinates; on, the location moves the multicab on the live map (team accounts only for now). The destination is required and both end by RL1's rules. A Crowdsource post is kept up by a "still riding" signal every 5 minutes and lapses 15 minutes after the last one, so a dead battery takes it down. The server refuses a relay without a valid code, and builds from before RL2a can no longer relay (`20261023000000_relay_gate.sql`). Energy is unchanged until RL2b. |
| Estimated markers (2026-10-17) | Approved by Emjay: 90 s to 5 minutes, along the route line, faint, labelled Estimated, no ETA; also on demo data. The coverage nudge's button opens Relay. See 7.3. |

### 19.5 Assistant: Ask Tunie (CA1, 2026-10-21; CA1.1, 2026-10-22)

Approved by Emjay. A chat that answers commuter questions from the data already on the phone. CA1.1: the assistant is Tunie (the app stays Tunton), with Emjay's avatar (`assets/chatbot avatar`).

- **Deterministic, online only (CA1.1).** No language model. A question is parsed by fixed word rules (`src/shared/assistant/`) into one intent; the same words always give the same answer, and nothing typed is sent anywhere. Ask Tunton can be used only while the server can be reached: it checks on opening, every 30 s and on return to the app. Offline, sending and the chips that ask are locked with "Ask Tunton needs an internet connection"; the chips that open My Rides or the Map still work. (Changed from CA1, which worked offline.) A development build without a backend stays usable.
- **Kept for an hour (CA1.1).** The questions are kept on the phone (the newest 50, none older than 1 hour), so closing Ask Tunton, going to My Rides and back, or restarting the app keeps the conversation; the answers are worked out again from the current data. There is no manual delete; Reset app and Delete account remove it. (Changed from CA1, which kept nothing.)
- **A sheet over the Map (CA1.1).** It opens in the same draggable sheet as My Rides, over the Map: it slides up fully open, so the first message shows whole, and can be dragged by its handle to half; it slides away when closed (Close, a tap above the sheet, or dragged to the bottom). Open, it stops below the Map's top bar. It reads like a chat: the newest message last, the message box at the bottom of the visible sheet (above the keyboard while typing, which opens the sheet fully), the conversation scrolling at every height.
- **Intents, tried in order.** Route status ("Is R4 running?", "naa bay R4?"); nearest stop ("nearest stop", "asa ang pinakaduol nga sakayan?", "nearest stop to SM City"); trip and fare ("from X to Y", "to Y", "pila plete gikan X paingon Y", "unsay sakyan paingon Y"); help. Any other text is taken as a destination.
- **Plain English (CA1.1).** "for" marks the destination when no other to-word is used ("what route should I board for Robinsons?"; "the fare for SM to Ampayon" still ends at Ampayon), as do "towards" and "toward"; route, multicab, jeep, should, I, we, board, take, ride, get and on are taken off the ends of a place name.
- **Bisaya.** Common question words are understood, including Butuan contractions: gikan (from); paingon, padulong, padung, ngadto, adto, muadto, hangtod (to), and a short "pa" only at the start or after a ride or fare word, since "pa" also means "still"; pila, pilay, pila'y, plete, pasahe, pamasahe (fare); unsay sakyan, masakyan, kasakyan, sakay (what to ride); naa bay, naa pa bay, naay, gadagan, nagdagan, byahe, gabyahe (is it running); asa (where); sakayan, hulatanan, hunonganan, nauganan, paradahan (stop); pinakaduol, duol (nearest); diri (here). Replies are in English (0.6 exception).
- **Places.** Names are found with My Rides' search over the stops, the user's saved places and the offline map's named places. CA1.1: the best match is always answered at once, never only asked about. A name typed in part ("robinson", "robinso") starts the reply with "Showing results for Robinsons Transport Terminal:"; places that fit as well (up to 2) follow as "Did you mean …?" chips that ask again with that place. When no name starts with what was typed, a few typing mistakes are allowed (edit distance: 2 letters for a word of 6 or more letters, 1 for 4 or 5, none for shorter words; "robinsons" and "robinson" count as the same word), and the reply starts "Did you mean Ampayon? Showing results for it ("ampayun" not found):". With no start named, the trip starts from the commuter's position (GPS, simulated stop or pin); without one, the assistant asks for it.
- **Answers.** Trip: the best route by the offline planner (7.2), the walks, the ride distance and the fare for the commuter's fare type, other routes that serve the trip, and chips to open the trip in My Rides or the route on the Map. Status: Live, Estimated and Stale counts (7.3), Night Mode, and the CF1 alternative route when the route has no Live vehicle; live data only for team accounts (0.7), the demo for everyone. Nearest stop: its name, code, distance and routes.
- **Where it is.** The last button of the Map's column, Tunie's avatar, larger than the others: "Ask Tunie" with the avatar while no card or bar is shown under the buttons (a multicab, a stop, tracking, a relay, a location notice), the round avatar alone while one is, sliding between the two. Also a Menu row (it opens over the Map) and a bubble in the tips tour. Starter chips let a question be tapped instead of typed. For any signed-in account, while online.

## Changes after audit

Oct 2, 2026. Edits made after the project audit (`docs/AUDIT.md`) and plan approval. Nothing else in this document was changed.

1. **Section 12.1:** added `route_code` and `direction` columns to `franchise_routes`. `route_id` now identifies one directed line (for example `R4-OUT`), so Route 4 is stored as two rows.
2. **Section 12.5:** added `DEO` as a sixth placeholder station in the stop table.
3. **Section 7.2:** added a "Boarding and alighting" paragraph. Riders may board and alight anywhere along the line, snapped to the route within the walking limit.
4. **Section 0.3:** added two config constants: the SMS sequence wrap-around window (1 to 5,000 ahead, modulo 10,000) and the telemetry timestamp limits (older than 120 s, or more than 30 s in the future, is rejected).
5. **Section 7.1:** sign-in for Prototype v0 changed to email and password for team accounts. Google sign-in or email magic link follows after v0.
6. **Section 19 (Oct 3, 2026):** added "User flow v2": the new onboarding, greeting, tracking with Energy and ETA, newsfeed, reports and Profile, with decisions D1 to D14 and the earlier sections they override.
7. **Section 19 (Oct 3, 2026, flow decisions):** D1, D2, D3, D7 and D8 updated with Emjay's answers (neutral feed badge, fixed-field feed, 60-minute posts, avatar pick once, no ranking); added 19.4.
8. **Sections 0.3, 7.3 and 19 (Oct 17, 2026, CF1):** Estimated markers (dead reckoning along the line from 90 s to 5 minutes of silence, no ETA), the coverage nudge and the alternative route chip added to 7.3, with their constants in 0.3 and the override in 19.3 and 19.4 (Emjay approved).
9. **Sections 0.3, 8.4 and 19 (Oct 21, 2026, T1):** the prototype relay broadcast added to 8.4 (foreground only, manual vehicle picker, store and forward with a batch form of the ingest endpoint), with its constants in 0.3 and the answer in 19.4 (Emjay approved).
10. **Sections 0.3, 0.6 and 19 (Oct 21, 2026, CA1):** the offline assistant Ask Tunton added as 19.5 (rule-based, no network, English and Bisaya questions with English replies, trip and fare, route status, nearest stop, starter chips); its constants in 0.3; the Bisaya question words as a scoped exception to the Cebuano strings item in 0.6.
11. **Sections 7.1, 7.3 and 19 (Oct 21, 2026, AU1):** guest mode removed. An account is needed after the introduction (the welcome offers only sign-in; a signed-out user is sent to sign-in with no way back), so Energy, Trust Points, check-ins and relays always belong to an account, Demo mode included; the ST2-D guest locks are gone. A saved session counts as signed in offline, after the access token expires too. A release build without backend keys shows "Backend not configured"; a development build carries on. D6, 19.1, the CF1 nudge in 7.3 and 19.5 amended (Emjay approved).
12. **Sections 0.3, 0.6 and 19.5 (Oct 22, 2026, CA1.1):** after Emjay's emulator test. Ask Tunton now answers the best match at once ("Showing results for …", with "Did you mean" chips for places that fit as well) instead of stopping at "Did you mean"; understands "for", "towards" and plain-English filler round a place ("what route should I board for Robinsons?"); corrects typos by edit distance ("ampayun", "robnson"); opens in My Rides' draggable sheet over the Map (collapsed, half or open by its handle; remembered) as a chat with the message box at the bottom and only a Close button; keeps the conversation on the phone for an hour (50 questions, no manual delete); and works only while online (it no longer says it works offline). Constants in 0.3 (Emjay approved).
13. **Sections 0.3, 7.3, 19.1 and 19.5 (Oct 22, 2026, after Emjay's emulator check):** the assistant is Tunie, with its avatar as the last Map button ("Ask Tunie" until first used); its sheet closes when dragged to the bottom and stops below the top bar. Map controls: zoom in and out buttons, Locate's second tap zooms out, the order zoom, Locate, Relay, Tunie; a slim route bar replaces the Explore card, whose greeting and "Where are you heading today?" moved to My Rides. Relay details from the relay bar: distance left, ride done, minutes left, time shared (Emjay approved).
14. **Sections 0.3, 7.2, 7.3 and 19.5 (Oct 22, 2026, after Emjay's second emulator check):** Tunie's sheet slides up fully open and slides away when closed; its button is the avatar that slides open to "Ask Tunie" at each start; the route bar became a Routes button in the column (zoom, Locate, Relay, Routes, Tunie); the Map shows every route's running multicabs while no route is picked, filtered by a Settings choice; My Rides' "Where are you going?" hint removed (the heading card asks it); search results shimmer briefly before they fade in; smooth fades and resizes for minimizing, expanding, opening and sliding (Emjay approved).
15. **Sections 7.3 and 19.5 (Oct 22, 2026, after Emjay's third emulator check):** "Ask Tunie" only while no card is under the Map's buttons; the other multicabs fade while one is picked; All routes first in the route list (the default); Locate centres a simulated stop or pin directly and says when a GPS position is outside the map; My Rides' heading card no longer resizes in an animation (the greeting fades, the field stays put) (Emjay approved).
16. **Sections 0.2, 0.3, 7.2, 7.3 and 12.4 (Oct 22, 2026):** the multicab fare is the traditional jeepney rate, ₱14.00 for the first 4 km (was ₱15.00), ₱2.00 per km and the 20% discount unchanged, route data version 8 (Emjay chose it from the LTFRB guidelines; still to be confirmed against the official order). Settings' *Multicabs on the map* and *Default route* removed (the Map opens on All routes; its route list picks one). Demo & simulation: the simulated spot can be pinned anywhere on the map. The in-app logo follows the theme (dark tile on the light theme, light tile on the dark one) and the native splash follows the phone's dark mode (Emjay approved).
17. **Sections 0.3, 7.3, 7.5, 11.1 and D14 (Oct 22, 2026, CA1.1):** check-ins cost 0.3 Energy per route pinged instead of earning 0.3; Energy comes back by waiting or a relay with GPS (+1.0), a relay without GPS earns nothing (was +0.5), and every account starts with 5. During a check-in the app asks *Did you board?* when a multicab of a pinged route stands at the stop, and at 5 minutes. The Map remembers the route last picked, and its tab shows a red dot while the tracked multicab is within 1 km (Emjay approved).
18. **Sections 0.3, 8.1 and 8.4 (Oct 22, 2026, RL1):** a relay with GPS ends 60 s after the rider comes within 50 m of the destination (leaving cancels the countdown; was at once at 100 m), after the idle stop, or when *Still riding?* gets no answer 3 hours in (was 90 minutes, no prompt). High-traffic zones hold the idle clock at long traffic lights and on the Magsaysay Bridge at rush hour. The route's first and last stop count as terminals until a real list exists (Emjay's decisions D1 to D3).
19. **Sections 0.3 and 19.4 (Oct 23, 2026, RL2a):** a relay needs location, a verified beacon and the route check, or the form is greyed out; one remembered "Show me on the live map" switch replaces "Share with GPS"; a relay without GPS (60 minutes in the feed) is gone, and a Crowdsource relay lasts until the rider's stop, kept up by a "still riding" signal (Emjay's decisions D9 to D11).
20. **Sections 7.3 and D12 (Oct 26, 2026, Emjay's draft):** Relay is the middle button of the bottom bar (Map, Check-in, Relay, My Rides, Crowdsource; icons only, with new icons; a floating card like the top bar, the active tab on a light blue pill, the map running under it), and opens the Relay form over the current tab, reachable with one thumb. The form, its checks (location, beacon, route) and the "Show me on the live map" switch work as before; a relay kept off the live map shows in Crowdsource. The Map loses its Relay button: the Routes button sits at the right under the top bar while no route is picked; once one is, it opens out into the route's card, which opens the route list; the card's chevron (no Hide X) folds it back into the button and shows All routes. The column is zoom, the tracked multicab, Locate, Tunie. *Not enough Energy* on Track and the coverage nudge's share button open the form. The relay bar of a running relay stays on the Map. The tips tour points at Routes first, then zoom, Locate, Tunie, and at Relay in the bottom bar.
21. **Sections 7.5 and 12.3 (Oct 30, 2026, CA3, Emjay):** the fill stops are gone; the Check-in card offers *At a stop* (within 300 m) or *Near the route* (within 40 m of the line, counted near the nearest stop). A check-in ends by itself when the commuter leaves the stop's 300 m or the near spot's 70 m (2 readings in a row, app open). SMS v4 carries the near counts; drivers see "SM Butuan 3, – Near 1".
