# Implementation plan: the PRD features not yet built

- **Date:** 2026-10-22.
- **Base:** `main` at `0db8f16`.
- **Source of the gap list:** a comparison of `docs/PRD.md` (sections 8, 10 and 11) with the code, using a graphify code graph (`graphify-out/`) and searches for each rule's constant and function.
- **Scope:**
  - In: the relay engine (8.1, 8.3, 8.4, 8.5), verification (10.1, 10.2, 10.3, 10.5), Night Mode's stop view (10.4), trust and moderation (11.2, 11.3), and hardening (S10).
  - Out: the web admin console, Cebuano strings, Play Integrity and the Play Store (PRD 0.6). Each keeps its plug-in point.
- **Rules (unchanged):**
  - Pure logic goes in `src/shared`, with fixture tests.
  - Every threshold goes in `src/shared/config`. Server values also go in `app_config`.
  - Strings go only in `src/strings/en.ts`.
  - One local commit per approved step. Push only when you ask.
  - Ask before any new dependency, native build or Supabase command, and get approval of the exact command.
  - Android only.
- **Test labels:**
  - **U:** unit or flow test (jest).
  - **L:** live Supabase test.
  - **E:** emulator.
  - **P:** one phone.
  - **PP:** two or more phones.
  - **X:** a multicab or a field ride.
- **Size:** S is under a day, M is 1 to 3 days, L is more than 3 days of agent work, not counting device tests.

## 1. What is missing

| PRD | Feature | What exists now | Step |
| --- | --- | --- | --- |
| 8.1, 8.4 | Relay session limits | The relay ends at 100 m from the destination or after 90 min (`broadcastEnd`). It has no idle stop, no 3-hour cap with a prompt to continue, and no 50 m / 60 s arrival countdown. | RL1 |
| 10.4 | Night Mode stop view ("Route 4 passed CSU 3 minutes ago") | The night window works on the server, and moving markers are hidden at night. There is no `node_events` table and no stop view. | NM1 |
| 10.3 | Mock-location risk signal, impossible movement, risk score | The phone discards mock fixes (`acceptFix`). The server never hears of them and does not check jumps. | RK1 |
| 10.2, S8 | Verification window (motion, 30 m route snap, 50 m displacement, BLE) | `verifyReport` always returns `unverified` (`verification_disabled`). Only BLE exists (`verify_beacon`, DR8). | V1a, V1b |
| 8.5 | Relay in the background (foreground service, Doze guide, health check) | The relay works only while the app is open (T1). | B1 |
| 8.3, S8 | Primary and Secondary relay roles (the "baton"), promotion after 90 s | Nothing. There is no `relay_sessions` table. Every team relay with GPS moves the marker. | BT1 |
| 10.1 | Smart Queue (two beacons too close in signal, multicab stationary) | `pickBeacon` returns `ambiguous` and the rider picks. There is no queue, escrow or lock. | SQ1 |
| 10.5 | Detour detection (alternative lines, Active Detour Mode) | Nothing. | DT1 |
| 11.2, 11.3 | Trust Level, Merit shields, strikes, suspensions, appeals | Trust points and flags exist (`trust_points`, `flag_post`, `feed_review_queue`). | MOD1a, MOD1b |
| S10, 17 | Hardening and field experiments E1 to E9 | Not done. A real-phone T1 ride is pending. | S10 |

## 2. Decisions needed before starting

Each decision has a recommendation. The step waits only on its own decision.

| # | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| D1 | **Arrival rule.** PRD 8.1: within 50 m, a 60 s countdown, then stop. Now: stop at once at 100 m. | Use the PRD rule. 100 m was a stand-in until verification existed. | RL1 |
| D2 | **Session length.** PRD 8.4: a 3-hour cap with a prompt to continue. Now: 90 minutes, no prompt. | Use the PRD rule. A 90-minute cap ends long cross-city rides. | RL1 |
| D3 | **Which stops are terminals** (the idle stop allows 30 min inside a terminal and 20 min outside) | For now, the first and last stop of each route. A real list is a data change later (`is_terminal` on stops, `ROUTE_DATA_VERSION` bump). | RL1 |
| D4 | **Moderation in the prototype.** PRD 0.6 says strikes and appeals are not built yet. | Build MOD1 only after V1a. Strikes need verified evidence, and before V1 every report is unverified. | MOD1a |
| D5 | **New dependency `expo-task-manager`**, needed for background location through `expo-location`, plus `ACCESS_BACKGROUND_LOCATION` and a native rebuild | Approve when B1 starts. The app is sideloaded for the pilot, so Play's background-location review does not apply yet. | B1 |
| D6 | **Activity recognition** (`IN_VEHICLE`): a Kotlin module using Google Play services location (`play-services-location`, a Gradle dependency) | Build V1a on the speed fallback alone (25 km/h for 20 s, no new dependency). Add activity recognition in V1b only if field rides show the fallback fails in stop-and-go traffic. | V1b |
| D7 | **Device fingerprint** (PRD 10.3: Android ID with a server HMAC) needs the Android ID (`expo-application`, a new dependency) | Defer it with Play Integrity. Bind suspensions to the account only for now. | MOD1a |
| D8 | **Alternative lines for detours** (for example the Macapagal Bridge bypass) | DT1 waits for a traced alternative line from the partner. | DT1 |

**Decided (Emjay, 2026-10-22):**

- **D1:** 50 m arrival with the 60 s countdown, approved. Change: the idle stop must not end a relay at long traffic lights. **High-traffic zones** (geofences of `HIGH_TRAFFIC_ZONE_RADIUS_M`, 150 m, around each point) hold the idle clock while the rider is inside an active zone:
  - all day: 8.947640, 125.540652; 8.947401, 125.536297; 8.945686, 125.531917;
  - rush hour, 16:00 to 18:59 Asia/Manila: 8.961681, 125.602418; and the whole Magsaysay Bridge, the straight stretch from 8.951828, 125.553233 to 8.947254, 125.544264 (about 1.1 km; Emjay, 2026-10-22).
  - A zone is a point, or a stretch of road between two points; the radius applies along the whole stretch.
- **D2 to D8:** as recommended in the table above. D5's `expo-task-manager` is approved for when B1 starts.

**Decided later (Emjay, 2026-10-22 and 2026-10-23), for RL2:**

These decisions replace the "Share with GPS" switch with the relay flow in section 4, "RL2 The relay flow". Earlier drafts (a "Use my GPS" switch, relays without a beacon, a speed test before release) were dropped on 2026-10-23.

- **D9 Location and the live map switch:**
  - Every relay needs the phone's location, to check that the rider is at the multicab's route. When Relay opens without it, the app asks: the consent screen (G0) if needed, then Android's "Turn on location" dialog.
  - The form has one switch, "Show me on the live map". It is off by default, and the rider's last choice is remembered.
- **D10 Beacon required, and Energy:**
  - A relay needs a verified multicab beacon. With none heard, the form is greyed out and says no registered multicab was detected.
  - The rider must also be near that multicab's route line or one of its stops.
  - The form shows the multicab's route and plate, never the beacon's id.
  - Copying a beacon does not work: renaming a phone's Bluetooth or copying a beacon's id fails, because the code changes every `BEACON_SLOT_S` (60 s) and the server checks it with a secret. A recorded code passes for about 2 minutes (`BEACON_SLOT_TOLERANCE`); the route check stops it being used away from the route. The route check runs on the phone, so a modified app could skip it; Play Integrity (out of scope, PRD 0.6) is the later answer.
  - Earning: on the live map +1.0, in Crowdsource +0.5. No daily limit; the wallet cap (`ENERGY_WALLET_CAP`, 5) stays.
  - A multicab the rider relayed in the last `RELAY_SAME_VEHICLE_GAP_H` (3 h) is refused with "You already relayed this multicab.", even with other multicabs in between. Different multicabs always earn, however close together (for example two rides to school).
- **D11 "Near" stop:** the stop nearest the rider when the relay is released. It does not follow the rider; readers judge from the stop and the post's age.
- **D12 Queued relay:**
  - Every relay is queued on the phone first. At a stop a multicab is expected to be loading, and hearing several beacons there is normal.
  - It is released (posted, or shown on the live map) when exactly one beacon is heard and the rider has moved 50 m along the route line. That beacon's multicab is the one relayed, so a rider who moved to another parked multicab relays that one.
  - In a multicab already moving between stops, release takes a few seconds.
  - The queue waits up to `RELAY_QUEUE_MAX_MIN` (30 min) while the multicab stays and the rider stays near it with location on.
  - It ends, with nothing posted or earned, when:
    - the rider walks away (no beacon for 30 s);
    - location is turned off;
    - 30 minutes pass;
    - the phone's battery runs out, or the phone switches off.
  - If the battery runs out after release, the relay stops by itself: the phone sends a small "still riding" signal every `RELAY_HEARTBEAT_MIN` (5 min), with no coordinates, and the post is removed `RELAY_POST_GRACE_MIN` (15 min) after the last one.
  - Switching to another app (for example social media) does not end it: the queue keeps running in the background (B1, moved up).
  - This is how the PRD's Smart Queue (10.1 steps 4 to 6) is built, without the Energy escrow: nothing is posted or earned before release.
- **Testing (Emjay, 2026-10-23):**
  - In demo data only, a multicab picked by hand counts as a beacon heard, because the emulator has no Bluetooth.
  - Team accounts get no such exception.
  - The field test uses real accounts on the live project: Emjay's phone runs the driver app (`APP_VARIANT=driver`, provisioned with `scripts/provision-driver.ts` as a vehicle on the route ridden) and is the beacon. The partner's phone runs the commuter app and relays from the same multicab.
  - **First test phase:** only the multicab carrying Emjay's driver phone can be relayed; relays without a beacon stay refused (Emjay, 2026-10-23).
    - The partner and friends make their own commuter accounts and use the app normally. The test checks the beacon, the relay, GPS and Bluetooth, and the checks and limits above.
    - Usability testing is on commuters only. Drivers see a demo and answer questions and the SUS survey.
    - The driver app has no sign-in. A phone becomes a multicab's beacon once, by a setup QR from `scripts/provision-driver.ts` (for example `--vehicle R4-TEST-02 --plate "TEST 002" --route R4`).

## 3. Order

| # | Step | Size | Waits for | Why here |
| --- | --- | --- | --- | --- |
| 1 | RL1 relay session limits | S | D1 to D3 | Pure logic, no server change; every later relay step uses it. |
| 1a | RL2a relay gate and form (location, beacon, route check, live map switch) | M | RL1, D9 to D11, approval of a migration | Uses RL1's end rules for Crowdsource relays. |
| 1b | RL2b Energy for relays | S | RL2a, D10, approval of a migration | Changes the earning rule RL2a's form shows. |
| 1c | RL2c queued relay | M | RL2b, D12 | Closes the terminal and roadside farming holes; this is SQ1. |
| 1d | B1 background relay (moved up from 5) | M | RL2c, D5, native rebuild, P | The queue and the relay keep running while the rider uses other apps (D12). |
| 2 | NM1 Night Mode stop view | M | Approval of a migration and the `ingest` deploy | Independent. The PRD's precondition (after S9) is met. |
| 3 | RK1 risk signals | S | Approval of a migration and the `ingest` deploy | V1a and MOD1 read its events. |
| 4 | V1a verification window (speed, route, displacement, BLE) | L | RL1, RK1 | The core of S8. The traced lines (ST2-C2) are good enough to build and test on; field values come in S10. |
| 5 | B1 background relay | — | — | Moved up to 1d (D12). |
| 6 | BT1 Primary and Secondary | L | V1a, B1 | Completes S8's acceptance criteria. |
| 7 | SQ1 Smart Queue | — | — | Folded into RL2c (D12). |
| 8 | MOD1a, MOD1b moderation | L | D4, V1a | Needs verified evidence. |
| 9 | DT1 detours | M | D8, V1a | Needs data. |
| 10 | V1b activity recognition | M | D6, field rides | Only if needed. |
| 11 | S10 hardening and field experiments | L | Everything above | Measures 3.3's targets. |

**Can run in parallel:** NM1 and RK1 have no shared files with RL1, so they can be built while D1 to D3 are open.

## 4. Steps

### RL1 Relay session limits (PRD 8.1 step 8, 8.4)

- **Build:**
  - `src/shared/relay/broadcast.ts` gains the rules below, all in `broadcastEnd` or beside it:
    - **Arrival:** within `RELAY_ARRIVAL_RADIUS_M` (50 m) of the destination, a `RELAY_ARRIVAL_COUNTDOWN_S` (60 s) countdown starts. Leaving the radius cancels it. When it ends, sharing stops.
    - **Idle stop:** the rider stays inside a `RELAY_IDLE_RADIUS_M` (30 m) circle for `RELAY_IDLE_MIN` (20 min), or `RELAY_IDLE_TERMINAL_MIN` (30 min) inside a terminal geofence. Then sharing stops.
    - **High-traffic zones (D1):** inside an active zone the idle clock is held, so a long red light never ends a relay. The 3-hour cap still applies.
    - **Hard cap:** `RELAY_SESSION_CAP_H` (3 h), with a "Keep sharing?" prompt. With no answer within a set time, sharing stops.
    - `BroadcastEnd` becomes `'arrived' | 'idle' | 'capped'`.
  - Config: replace `RELAY_DESTINATION_ARRIVED_M` (100) and `RELAY_BROADCAST_MAX_MIN` (90) with the constants above.
  - `src/features/report/useRelayBroadcast.ts`:
    - the countdown in `RelayBar` ("Arriving · 0:42");
    - the cap prompt through `showDialog`;
    - a toast for each way the relay ends.
  - Strings: the arrival countdown, idle end, cap prompt and capped end.
- **Accept:**
  - **U:** at 49 m the countdown starts. Leaving to 60 m cancels it. After 60 s inside, the relay ends as `arrived`.
  - **U:** 20 min within 30 m away from a terminal ends it as `idle`; 25 min at a terminal does not.
  - **U:** 40 min inside an all-day zone does not end it; a rush-hour zone holds the clock at 17:00 and not at 10:00.
  - **U:** at 3 h the prompt shows; Keep restarts the clock; no answer ends it as `capped`.
  - **U:** `flows.test.ts` covers a simulated ride to its destination.
  - **E:** a pinned simulated position walked to the destination shows the countdown.

### RL2 The relay flow (D9 to D12)

This is the whole flow. It is built in four steps, each its own commit:

- **RL2a, the Relay form's checks:** location, beacon, route check, the live map switch, and the server change that refuses relays without a beacon.
- **RL2b, the Energy rules:** +1 / +0.5, and the same-multicab refusal.
- **RL2c, the waiting queue:** a relay is posted only once the multicab moves.
- **B1, the background relay:** the queue and the relay keep running in other apps.

1. **Open.** The rider taps the Relay round button on the Live map.
2. **Location.**
   - With no location permission, the consent screen (G0) shows. With the phone's location off, Android's "Turn on location" dialog shows.
   - If the rider declines, the form stays greyed out with "Relay needs your location."
   - Until a fix of 30 m accuracy or better comes, the form shows "Waiting for your location…".
3. **Beacon.**
   - Bluetooth scans, as in DR8, and the server checks each beacon's code (`verify_beacon`). While scanning, the card reads "Looking for the multicab…".
   - With nothing verified after `RELAY_BEACON_WAIT_S` (15 s), the form is greyed out with "No registered multicab detected. This multicab may not be registered with Tunton."
   - The scan keeps going, so the form opens up when a beacon is verified.
4. **Route check.**
   - The rider's fix must be within `ROUTE_SNAP_DISTANCE_M` (30 m) of a heard multicab's route line, or within `RELAY_STOP_AREA_M` (60 m) of one of its stops.
   - Otherwise the form is greyed out with "You are not on Route <code>'s route."
5. **Form.**
   - The card shows the route and plate of the one multicab heard, or "2 multicabs here · R4" when several are heard. It never shows a beacon id.
   - The route and vehicle pickers go: the beacon decides.
   - The form asks for:
     - seats;
     - what's happening (optional);
     - the destination, which is required because reaching it ends the relay;
     - "Show me on the live map", which is remembered from the rider's last relay.
6. **Send:** the relay is **queued**. Nothing goes to the server yet.
7. **Queued.**
   - The Relay bar reads "Queued · waiting for the multicab to move", with Cancel.
   - **Release:** exactly one beacon is present and the rider has moved `MIN_DISPLACEMENT_M` (50 m) along the route line from where they queued, for two fixes in a row. The phone then sends the relay with that beacon's newest code.
   - **Ends, with nothing posted or earned** (a notification says why):
     - no beacon heard for `RELAY_QUEUE_BEACON_LOST_S` (30 s): "You left the multicab. Your relay was cancelled.";
     - location turned off or lost: "Location is off. Your relay was cancelled.";
     - still queued after `RELAY_QUEUE_MAX_MIN` (30 min): "The multicab did not leave in time. Your relay was cancelled.";
     - the multicab at release is on another route than the destination's: "You boarded a multicab on another route. Relay again.";
     - the multicab at release was relayed in the last 3 h: "You already relayed this multicab.";
     - Cancel;
     - the battery runs out or the phone switches off: nothing was sent, so nothing is left behind.
   - Switching to another app does not end the queue (B1).
8. **Posted.**
   - The server checks again: the beacon code is valid and names the multicab, and the same multicab was not relayed by this rider in the last 3 h. It refuses a relay with no valid beacon.
   - The server then books the Energy (D10).
   - On the live map: positions are sent, as now.
   - In Crowdsource: the post names the stop nearest the release point (D11) and sends no coordinates.
   - Both end by RL1's rules: arrival, idle, or the 3-hour cap.
   - **Battery runs out after release:** a Crowdsource post is kept alive by a "still riding" signal every 5 min (no coordinates) and is removed 15 min after the last one. A live map marker already turns "Estimated" and then disappears when positions stop (CF1).

### RL2a Relay gate and form (D9, D10 without Energy, D11)

- **Build:**
  - `src/shared/relay/gate.ts` (pure): steps 2 to 4 of the flow. Its input is the location state, the beacons heard (verified), the fix, and the routes' lines and stops. It answers `ok` with the multicabs, `no_location`, `waiting_fix`, `searching`, `no_beacon` or `off_route`.
  - `ReportSheet.tsx`:
    - the greyed-out states and their messages;
    - the card with route and plate;
    - the route and vehicle pickers removed;
    - the destination required;
    - one switch, "Show me on the live map", persisted in `settingsStore` (`relayLiveMap`, default off).
  - Location prompts: G0 consent, then Android's "Turn on location" dialog (the `expo-location` call is checked in the SDK 57 docs before building).
  - The relay session (`relayStore`) gains `mode: 'live' | 'feed'` and the post's id. `useGpsBroadcast` sends positions only in `live`. RL1's watch runs in both modes. The Relay bar shows the Crowdsource mode ("In Crowdsource · ends at your stop").
  - Until RL2c, Send posts at once (the queue comes in RL2c).
  - **Server** (one migration):
    - `feed_posts.live_map boolean not null default false`, set to `with_gps` for existing rows;
    - a 9-argument `post_report` adds `live_map` and refuses a relay without a valid beacon. The older versions lose their grant, so builds from before RL2a cannot relay;
    - `expires_at`: now plus `RELAY_POST_GRACE_MIN` (15 min). The phone calls `renew_report(post bigint)` every `RELAY_HEARTBEAT_MIN` (5 min) while the relay runs, which moves it to now plus 15 min. If the battery runs out, the post is gone within 15 min;
    - a post that lapsed during a dead zone comes back on the next `renew_report`, if it lapsed less than 30 min ago and the relay is still running;
    - `end_report(post bigint)` sets `expires_at` to now. Both calls are for the post's author only;
    - the feed reads `live_map = false` instead of `with_gps = false` (`services/crowd.ts`, `crowdsource.tsx:93`).
  - When RL1 ends a Crowdsource relay, the phone calls `end_report`, retried through the outbox when offline. Stop on the Relay bar also calls it.
  - Demo data only: a hand-picked multicab counts as heard (D12, Testing).
- **Accept:**
  - **U:** `gate.ts`: no permission gives `no_location`; no verified beacon after 15 s gives `no_beacon`; a beacon with the rider 100 m from its line and stops gives `off_route`; 20 m from the line gives `ok`; 50 m from a stop and off the line gives `ok`.
  - **U:** the live map switch is remembered after the app restarts.
  - **U:** a `feed` session sends no positions; its RL1 end calls `end_report` once, also when the end comes offline.
  - **U:** a `feed` session calls `renew_report` every 5 min; with the app stopped (battery out), no call comes and the post lapses after 15 min.
  - **L:** `post_report` without a valid beacon is refused; with one, `live_map` is stored and `expires_at` is 15 min ahead; `renew_report` moves it on and brings back a post lapsed less than 30 min ago; `end_report` by the author expires it; another user's calls are refused.
  - **L:** the feed shows a Crowdsource relay and hides a live map relay.
  - **E:** demo data: Relay opens with the card's route and plate; the live map switch starts off; Send posts.
  - **E:** phone location off: Android's dialog shows; declining keeps the form greyed out.
  - **P:** live data, no driver phone nearby: the form is greyed out with "No registered multicab detected".

### RL2b Energy for relays (D10)

- **Now:** a relay with GPS earns +1.0, once per Manila day; without GPS it earns nothing (CA1.1).
- **Build:**
  - Energy kinds `live_report` +1.0 (`ENERGY_LIVE_REPORT`) and `feed_report` +0.5 (`ENERGY_FEED_REPORT`), with no daily limit; the wallet cap stays. The old kinds stay for the history of earlier relays.
  - **Same multicab:** `post_report` refuses a relay on a multicab the same rider relayed (with a valid beacon) in the last `RELAY_SAME_VEHICLE_GAP_H` (3 h), with "You already relayed this multicab.", even with other multicabs in between. `relayStore` keeps the phone's recent relays, so the form can say so before Send; the server's answer decides.
  - `src/shared/backend/rules.ts` gains the same rules as pure functions, tested against the same cases as the SQL.
  - **Server** (one migration): the `app_config` amounts, `energy_earn`'s new kinds, and the same-multicab check in `post_report`.
  - Strings: the earning hint by the live map switch, the same-multicab message, and the history names "Relay on the live map" and "Relay in Crowdsource".
  - PRD 19 (Energy) and 0.3 are updated.
- **Accept:**
  - **U:** the live map earns 1.0 and Crowdsource 0.5; three relays on three multicabs in one day earn three times; the cap of 5 holds.
  - **U:** multicab A, then A 2 h later: refused; A, then A 3 h later: allowed; A, B, then A within minutes: the second A is refused; A then B (two rides to school): both earn.
  - **L:** the same cases against `post_report` on the live project.
  - **E:** demo data: two relays on the same demo multicab; the second is refused with the message.
  - **P, X:** on a multicab with the driver phone's beacon: the relay earns; a second relay on it is refused.

### RL2c Queued relay (D12; PRD 10.1 steps 4 to 6)

- **Build:**
  - `src/shared/relay/queue.ts` (pure): step 7 of the flow. Its input is the queue (where and when it started, the route), the beacons present, the fix and the time. It answers `waiting`, `release` with the multicab, or `ended` with a reason. Two beacons present keep it waiting; it releases on the one left (PRD 10.1 step 5).
  - `relayStore` gains the state `queued`. Send starts it; release calls `sendReport` with the beacon's newest code, then starts the RL1 watch.
  - Bluetooth keeps scanning while a relay is queued, not only while the panel is open (today's `ARMED_SCAN_MIN`).
  - The Relay bar: "Queued · waiting for the multicab to move", with Cancel. Each end shows a toast and a vibration.
  - Until B1, leaving the app pauses the queue; it does not end it. It carries on when the rider comes back.
  - DR8's "pick one of two multicabs" goes: the queue resolves it.
  - Demo data: the hand-picked demo multicab is present while the rider is within `RELAY_STOP_AREA_M` of where they queued or moving along the line. The emulator's route playback (Extended controls, Location, Routes) drives a release.
- **Accept:**
  - **U:** one beacon and 60 m along R4: released. Two beacons until one fades at departure: released on the one still heard. Parked 10 min, moved to another multicab, then it departs: released on the second.
  - **U:** 100 m off the line with a beacon: still waiting.
  - **U:** ends: no beacon for 30 s; location off; 30 min; another route at release; the same multicab within 3 h; Cancel.
  - **U:** nothing reaches `sendReport` before release (spied in `flows.test.ts`).
  - **E:** demo data, emulator route playback along R4 from a stop: "Queued", then posted after 50 m.
  - **PP, X:** two driver phones side by side at a terminal; board one; it is the one relayed when it leaves.

### NM1 Night Mode stop view (PRD 10.4)

- **Build:**
  - Migration `node_events`:
    - Columns: `vehicle_id`, `route_id`, `stop_code`, `passed_at`; server-only writes.
    - Retention 7 days. The PRD keeps passage events and counts, and raw night positions still go after 24 h.
    - Function `night_stop_updates(route text)`, readable by signed-in users. It returns the newest passage per stop, only if older than `night_feed_delay_min` (2), during the night window only. It shows no vehicle id or plate, only route and stop.
  - `supabase/functions/_shared/ingestCore.ts`: when an accepted position passes within `NODE_PASS_RADIUS_M` (new, 50 m, `app_config`) of a stop of its route, record one passage per vehicle, stop and `NODE_PASS_GAP_MIN` (10 min). The rule is a pure function in `_shared/nodePassage.ts`, shared with `src/shared` as `verifyReport` is.
  - App:
    - A `NightStopsRepository`, demo and live, behind the Demo switch.
    - At night, the Map shows a chip on each stop with a recent passage ("R4 passed CSU · 3 min ago") instead of moving markers.
    - It is free: no Energy.
    - The existing "night" notice links to it.
- **Accept:**
  - **U:** `nodePassage.test.ts`: a line of positions passing a stop gives one passage; a second pass within 10 min gives none; a position 60 m away gives none.
  - **U:** the migration test (grants, the function hides rows younger than 2 min and all rows by day).
  - **L:** `sim-ingest` at night produces a passage that `night_stop_updates` returns 2 min later, not before.
  - **E:** demo night view.
- **Commands to approve:** `npx supabase db push` and `npx supabase functions deploy ingest`.

### RK1 Risk signals (PRD 10.3, without integrity or fingerprint)

- **Build:**
  - Migration `risk_events`:
    - Columns: `user_id`, `kind` (`mock_location`, `impossible_speed`), `detail` jsonb, `at`. Server-only.
    - Function `report_risk(kind text)`, rate-limited to 1 a minute per kind.
    - `risk_score(uid)` is the count of events in 30 days, weighted per kind in `app_config`.
    - At `RISK_REVIEW_SCORE` the user goes to a new `account_review_queue` for the dashboard.
  - Phone: `acceptFix` already rejects `mocked`. The relay and check-in callers send `report_risk('mock_location')` once per session, as best effort.
  - Ingest: two consecutive positions of one vehicle implying more than `IMPOSSIBLE_SPEED_KMH` (new, 120 km/h) are rejected, and an `impossible_speed` event is booked against the sender. The rule is a pure function in `_shared/`.
- **Accept:**
  - **U:** the speed jump rule (fixtures: 80 km/h passes, 300 km/h fails, a GPS jitter of 40 m in 1 s at a stop passes thanks to an accuracy allowance).
  - **U:** the migration test.
  - **L:** a mock event recorded; the 3rd event queues the account.
  - **E:** fake GPS with "mocked" on shows the existing refusal and books one event.

### V1a Verification window (PRD 10.2, 0.2 S8), without activity recognition

**Since D12 (2026-10-23):** RL2 checks the beacon and the route on the phone before a relay is posted, and RL2c's queue checks 50 m of displacement along the line. V1a keeps the rest: the motion test, `verifyReport`, the stored result, the marker badge, and the same checks in `ingest`.

- **Build:**
  - `src/shared/verification/window.ts` (pure; also used by `_shared/verifyReport.ts`). Its input is the session's positions, their accuracy, the route line, and the beacon result. It runs 4 tests:
    1. **BLE:** `beacon_ok` true (DR8) for a relay that has a beacon. A relay without a beacon cannot become verified, only stay "unverified".
    2. **Motion:** speed ≥ `MOTION_SPEED_FALLBACK_KMH` (25) held for `MOTION_SPEED_FALLBACK_S` (20 s) within the window.
    3. **Route:** every fix within `ROUTE_SNAP_DISTANCE_M` (30 m) of the line, using fixes of 30 m accuracy or better.
    4. **Displacement:** progress along the line ≥ `MIN_DISPLACEMENT_M` (50 m). Use `projectOntoLine`, as the relay details do.
  - The window is `VERIFY_WINDOW_S` (30 s), extended to `VERIFY_WINDOW_MAX_S` (90 s) while speed is low.
  - It returns `verified`, `failed` with reasons, or `pending`.
  - `ENABLE_VERIFICATION` on, read only in `verifyReport`, as now. The server stores `verified` and `verification_reasons` (the columns exist since v0).
  - App:
    - The relay is "Checking your ride…" until verified, and private until then (PRD 8.1 step 6).
    - The marker badge changes from "Prototype data, unverified" to no badge once verified.
    - The GPS relay Energy (+1.0) is earned only on verified and arrived. This ties RL1 to the economy.
  - Simulator: `scripts/sim-ingest.ts` gains a "stationary rider" and an "off-route" mode.
- **Accept (S8):**
  - **U:** a simulated ride along R4 passes.
  - **U:** a stationary rider fails on motion and displacement.
  - **U:** a walk at 5 km/h fails on motion.
  - **U:** a ride 100 m off the line fails on route.
  - **U:** a mock fix is discarded and booked (RK1).
  - **U:** the buffer still flushes in order (T1 test unchanged).
  - **L:** a verified relay sets `telemetry_latest.verified`.
  - **X:** one real ride.

### B1 Relay in the background (PRD 8.5)

**Since D12 (2026-10-23):** B1 also keeps a queued relay (RL2c) running, with its Bluetooth scan, while the rider uses other apps. The scan already filters on the beacon service UUID (`BeaconScanner.kt`), which Android keeps delivering with the screen off while the process lives; this is checked on a phone.

- **Dependency (D5):** `npx expo install expo-task-manager`, and `app.json` plugin options for `expo-location`: background location, a foreground service, `isAndroidForegroundServiceEnabled`.
- **Build:**
  - `src/features/report/backgroundRelay.ts`: a task defined at module scope.
    - It is started by the relay with the `location` type foreground service and a visible notification ("Sharing your ride on R4").
    - Positions go through `acceptFix`, the send rule and the SQLite outbox, unchanged.
    - It is stopped by every `BroadcastEnd`.
  - Permission flow: background permission is asked only when a relay with GPS starts, after the foreground permission, with an explainer. Without it, the relay stays foreground-only, as now (PRD 4.2 degrade).
  - Health check: record when the task last ran. If the gap is longer than 2 minutes during a relay, show a one-time "Your phone stopped Tunton" guide with vendor steps (Xiaomi, Oppo, Vivo, Samsung, Realme, Infinix).
  - Consent text: add background sharing during a relay. This needs the DPO review.
- **Accept:**
  - **U:** the task's handler runs the same send rule (flow test).
  - **P:** with the screen off for 10 min, positions keep arriving (`telemetry_raw`).
  - **P:** a force stop shows the guide on return.
  - S10 covers six vendor skins.
- **Commands to approve:** the dependency install and a native rebuild (`npx expo run:android` or an EAS development build).

### BT1 Primary and Secondary (PRD 8.3, 0.2 S8)

- **Build:**
  - Migration `relay_sessions`, one row per rider per vehicle:
    - columns: `user_id`, `vehicle_id`, `destination_progress_m`, `eligible`, `role` (`primary`, `secondary`), `joined_at`, `last_seen`, `destination_changed_at`;
    - `relay_join(vehicle, destination, eligible)`, `relay_heartbeat(...)`, `relay_leave()`.
  - Ranking:
    - by distance left along the line to the destination;
    - ineligible riders (battery under `PRIMARY_MIN_BATTERY_PCT` 30, battery saver, no location) are Secondary only;
    - a destination change sends the rider to the back.
  - Promotion: on each heartbeat and from a `pg_cron` job every 30 s. A Primary silent for `LIVENESS_TIMEOUT_S` (90) is replaced by the next eligible rider.
  - Ingest moves the marker only from the Primary's positions. Secondaries' positions are kept in history.
  - App:
    - `expo-battery` (already installed) supplies the eligibility fields.
    - A Secondary runs the background task at `SECONDARY_FIX_INTERVAL_S` (60 s) with balanced accuracy, and only heartbeats.
    - On promotion, the next heartbeat answer raises the rate to the send rule.
    - The rider sees "You're sharing for this multicab" or "Another rider is sharing; you're backup".
  - The marker shows Stale during a gap (it already does after 90 s).
- **Accept (S8):**
  - **U:** the ranking rule (pure, `shared/relay/baton.ts`).
  - **L:** two test accounts join; the one with more distance left is Primary; the Primary stops heartbeating, and within 90 s plus one cron tick the other is Primary.
  - **L:** a destination change drops the rider to the back.
  - **PP:** a two-phone ride with a handoff.

### SQ1 Smart Queue (PRD 10.1 steps 4 to 6)

**Folded into RL2c (D12, 2026-10-23).** The text below is the original plan, kept for the record; RL2c replaces the escrow with holding the relay on the phone.

- **Build:**
  - `shared/beacon/smartQueue.ts`: two beacons are present within the 8 dB margin while the vehicle is stationary.
    - The session is "Stopped: loading", and its Energy is held in escrow (`energy_ledger` kind `escrow`, released or voided).
    - When riding starts, the beacon still in range, with the other gone (`BEACON_LOST_S`), locks the session and releases the escrow.
    - After `SMART_QUEUE_MAX_MIN` (10) unresolved, the session is dropped and nothing is earned.
  - The rider no longer picks between ambiguous beacons. This replaces DR8's pick.
- **Accept:**
  - **U:** recorded fixtures of two beacons: one fades as the vehicle departs → lock; neither fades in 10 min → dropped.
  - **L:** escrow rows are released or voided.
  - **PP:** two driver phones side by side.

### MOD1a Moderation, server (PRD 11.2, 11.3)

- **Build:** one migration.
  - **Trust Level:**
    - the share of the last 30 days of reports verified and not upheld as flagged;
    - shown after 10 reports;
    - kept in `trust_level(uid)`.
  - **Flag eligibility:**
    - the flagger viewed the marker in the last 10 min, which needs a `marker_views` row written on vehicle card open;
    - and has Trust Level ≥ 30 or an account at least 7 days old;
    - one flag per post;
    - a daily flag limit.
  - **Flag tags:** `FALSE_LOCATION`, `SPAMMING`, `NOT_A_PUV`, plus optional text (an extension of `flag_post`).
  - **Contested:** 3 eligible unique flags within 24 h. Flags from accounts under 48 h old, or from accounts that mostly flag the same target, carry no weight.
  - **Strikes:**
    - `strikes` table: a moderator confirms (`admin_confirm_report`, run in the dashboard), or automatic evidence (RK1 events, a V1a route failure) plus 3 flags;
    - the strike goes to the Primary at the flagged time (BT1's history);
    - strikes expire after 60 days.
  - **Suspension:** 2 strikes within 30 days give 7 days. `may_participate()` refuses during a suspension. Account only (D7).
  - **Merit:**
    - 1 point per 1,000 TP, at most 3;
    - a Merit point absorbs a strike on a trusted user, and the user is told afterwards;
    - an upheld appeal restores it.
  - **TP earning (11.2):** verified relay with GPS +10, without GPS +5, check-in +2, capped at 25 a day. The rules that apply only after V1a wait for V1a.
  - **Appeals:** an `appeals` table and `appeal_strike(strike, text)`. A moderator decides with `admin_decide_appeal`.
- **Accept:**
  - **U:** the migration tests.
  - **U:** `rules.ts` mirrors the rules (Trust Level, contested, suspension, Merit).
  - **L:** two strikes in 30 days suspend the account; an upheld appeal lifts the strike and returns a used shield.

### MOD1b Moderation, app

- **Build:**
  - Flag sheet with the three tags.
  - Profile:
    - Trust Level (after 10 reports);
    - "Your strikes" with plain-language reasons;
    - an Appeal button;
    - the suspension end date.
  - A "Shield used" notice once.
  - A suspended account is told why when it relays, checks in or flags.
- **Accept:**
  - **U:** a flow test for flag, strike, appeal and lift (demo repositories).
  - **E:** the screens.

### DT1 Detours (PRD 10.5)

- **Build:**
  - Local SQLite `route_alternatives` (route, polyline, active flag), seeded from data, with a `ROUTE_DATA_VERSION` bump.
  - The same table on the server, with `admin_set_detour(route, alternative, active)`.
  - V1a's route test also accepts an active alternative. The session enters Active Detour Mode, and the line is drawn dashed yellow.
  - Unknown detours: when 3 verified sessions in a day fall outside every line, `ops_alerts` gets a row.
  - Fares always use the authorized line.
- **Accept:**
  - **U:** a ride on the alternative passes only while it is active.
  - **U:** the fare is unchanged.
  - **E:** the dashed line.

### V1b Activity recognition (only if field rides need it)

- **Dependency (D6):**
  - a Kotlin `ActivityRecognitionClient` in `modules/tunton-motion`;
  - Gradle `com.google.android.gms:play-services-location`;
  - the `ACTIVITY_RECOGNITION` permission.
- **Build:** the motion test passes on `IN_VEHICLE` for at least 60% of samples (`MOTION_IN_VEHICLE_SHARE`), or on the speed fallback.
- **Accept:**
  - **U:** sample fixtures.
  - **X:** a stop-and-go ride that V1a failed now passes.

### S10 Hardening and field experiments (PRD 0.2 S10, 3.3, 17)

- **Measure and record** in `docs/device-tests.md`, even when a target is missed:
  - battery per hour of relay (Primary and Secondary);
  - data per hour (target under 150 KB);
  - time to first boarding prompt;
  - verification pass rate on honest rides;
  - handoff time;
  - background survival on six vendor skins;
  - E1 and E2 BLE signal inside a multicab, which sets `RSSI_PRESENCE_THRESHOLD_DBM` and `RSSI_MARGIN_DB`;
  - E3 to E9 as listed in PRD 17.1.
- **Then:** tune the constants in `src/shared/config` and `app_config`. There are no code changes beyond that.

## 5. Data and people needed

| Item | From | Needed by |
| --- | --- | --- |
| Terminal list per route (D3) | Partner | RL1 (first and last stop until then) |
| R14's return leg and the six left-out stops | Partner | V1a on those routes |
| Traced detour alternatives (D8) | Partner | DT1 |
| Two phones and one multicab with the driver phone mounted | Emjay and the partner | BT1, SQ1, S10 |
| DPO review of the consent text with background sharing | Emjay | B1 release |
| Apply `20261022000000_checkin_points.sql` | Emjay | Before any live test of the economy |

## 6. Constants to add

All of them go in `src/shared/config`; the server ones also go in `app_config`.

| Constant | Default | Step |
| --- | --- | --- |
| `RELAY_ARRIVAL_RADIUS_M` | 50 | RL1 |
| `RELAY_ARRIVAL_COUNTDOWN_S` | 60 | RL1 |
| `RELAY_IDLE_RADIUS_M` | 30 | RL1 |
| `RELAY_IDLE_MIN`, `RELAY_IDLE_TERMINAL_MIN` | 20, 30 | RL1 |
| `RELAY_SESSION_CAP_H` | 3 | RL1 |
| `RELAY_TERMINAL_RADIUS_M` | 100 | RL1 |
| `RELAY_CAP_ANSWER_MIN` | 5 | RL1 |
| `HIGH_TRAFFIC_ZONE_RADIUS_M` | 150 | RL1 (D1) |
| `HIGH_TRAFFIC_ZONES` | 3 all-day points; at rush hour 1 point and the Magsaysay Bridge (D1) | RL1 (D1) |
| `ENERGY_LIVE_REPORT`, `ENERGY_FEED_REPORT` | 1.0, 0.5 (replacing `ENERGY_GPS_REPORT` and `ENERGY_NO_GPS_REPORT`) | RL2b (D10) |
| `RELAY_SAME_VEHICLE_GAP_H` | 3 | RL2b (D10) |
| `RELAY_BEACON_WAIT_S` | 15 | RL2a (D10) |
| `RELAY_HEARTBEAT_MIN`, `RELAY_POST_GRACE_MIN` | 5, 15 | RL2a (D12) |
| `RELAY_STOP_AREA_M` | 60 (as `CHECKIN_RADIUS_M`) | RL2a (D10) |
| `RELAY_QUEUE_BEACON_LOST_S` | 30 | RL2c (D12) |
| `RELAY_QUEUE_MAX_MIN` | 30 (Emjay, 2026-10-23; PRD 10.1 says 10) | RL2c (D12) |
| `NODE_PASS_RADIUS_M`, `NODE_PASS_GAP_MIN` | 50, 10 | NM1 |
| `IMPOSSIBLE_SPEED_KMH` | 120 | RK1 |
| `RISK_REVIEW_SCORE` | 3 | RK1 |
| `MOTION_SPEED_FALLBACK_KMH`, `MOTION_SPEED_FALLBACK_S` | 25, 20 | V1a |
| `VERIFY_WINDOW_S`, `VERIFY_WINDOW_MAX_S` | 30, 90 | V1a |
| `PRIMARY_MIN_BATTERY_PCT` | 30 | BT1 |
| `SECONDARY_FIX_INTERVAL_S` | 60 | BT1 |
| `SMART_QUEUE_MAX_MIN` | 10 | SQ1 |
| `TRUST_LEVEL_MIN_REPORTS`, `FLAG_MIN_TRUST_LEVEL`, `FLAG_NEW_ACCOUNT_DAYS` | 10, 30, 7 | MOD1a |
| `CONTEST_FLAGS`, `CONTEST_WINDOW_H` | 3, 24 | MOD1a |
| `STRIKES_TO_SUSPEND`, `STRIKE_WINDOW_D`, `SUSPENSION_D`, `STRIKE_EXPIRY_D` | 2, 30, 7, 60 | MOD1a |
| `MERIT_PER_TP`, `MERIT_MAX` | 1000, 3 | MOD1a |
| `MOTION_IN_VEHICLE_SHARE` | 0.6 | V1b |

`RELAY_TERMINAL_RADIUS_M`, `RELAY_CAP_ANSWER_MIN`, `HIGH_TRAFFIC_ZONE_RADIUS_M`, `NODE_PASS_RADIUS_M`, `IMPOSSIBLE_SPEED_KMH`, `RISK_REVIEW_SCORE` and the `VERIFY_WINDOW` pair are new starting values not set by the PRD; the field data in S10 tunes them.
