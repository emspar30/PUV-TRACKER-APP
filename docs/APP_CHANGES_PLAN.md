# App changes for the defense: audit and plan

Task: `docs/ALL_APP_CHANGES_PROMPT.md`. Audit date: 2026-11-22. Phase 0 only: no code changed.
Earlier audit of the driver side: `docs/DRIVER_CHANGES_PLAN.md` (2026-11-19). Its findings still hold
and are only summarised here.

Status key: DONE, PARTIAL, NOT BUILT, NOT FOUND.

## 1. Phase 0 findings

### 1.1 Relay end and pause rules today

A relay has two stages: queued on the phone, then released (posted, or on the live map).

**Queued** (`src/shared/relay/queue.ts:70-81`). It ends with nothing posted when:

| Rule | Constant |
|---|---|
| No beacon heard | `RELAY_QUEUE_BEACON_GONE_S = 30` |
| Location off | none |
| Too long queued | `RELAY_QUEUE_MAX_MIN = 30` |
| Other route, or same multicab relayed recently | `RELAY_SAME_VEHICLE_GAP_H = 3` |

**Released** (`src/shared/relay/limits.ts:114`, called from
`src/features/report/useRelayBroadcast.ts:119`). It ends when:

| Rule | Constants |
|---|---|
| Destination reached | within `RELAY_ARRIVAL_RADIUS_M = 50` for `RELAY_ARRIVAL_COUNTDOWN_S = 60` |
| Idle | within `RELAY_IDLE_RADIUS_M = 30` for `RELAY_IDLE_MIN = 20` (30 at a terminal, `RELAY_TERMINAL_RADIUS_M = 100`) |
| Cap | "Still riding?" after `RELAY_SESSION_CAP_H = 3`; ends with no answer in `RELAY_CAP_ANSWER_MIN = 5` |
| Manual stop | Stop button |
| Crowdsource post lapses | no heartbeat for `RELAY_POST_GRACE_MIN = 15` |

- **Pause:** the idle clock is held inside hand-mapped `HIGH_TRAFFIC_ZONES` (5 zones,
  `src/shared/config/index.ts:559-583`, radius 150 m). Nothing else pauses a relay.
- **Speed** does not end a relay. **Distance from the route** does not end a released relay; it only
  affects verification (`src/shared/relay/verification.ts`).
- **Beacon loss does not end a released relay.** The commuter phone scans only while the Relay panel
  is open (`src/features/report/bleSession.ts`, `ARMED_SCAN_MIN = 15`). Once the relay is released,
  nothing listens for the beacon.

### 1.2 ETA

- `etaTo` (`src/shared/tracking/eta.ts:43-65`):
  - ETA = distance along the line to the boarding point / mean speed of samples in the last
    `ETA_SAMPLE_WINDOW_S = 90`.
  - It needs `ETA_MIN_SAMPLES = 2` and stays within `ETA_MAX_KM = 10`.
- **Hidden under 5 km/h:** line 62. If the mean speed is under `ETA_MIN_SPEED_KMH = 5`, the result is
  `unknown/slow`. This is PRD 19.4. Stopped samples count in the mean, so one stop drags the speed
  down and hides the ETA.
- `etaNow` counts down between packets. The ETA hides after `COVERAGE_LIVE_MAX_AGE_S = 90`.
- **Callers:**
  - `src/app/(tabs)/index.tsx:83` (Track view);
  - `src/shared/routing/rankOptions.ts:9` (route ranking);
  - `src/shared/relay/limits.ts:31` (it only uses `crossesAlert`).
- **Alerts:** the distance alerts (1000/500/250/100 m), arrival and "Get ready to get off" use the
  distance, not the ETA. They keep working when the ETA is hidden.

### 1.3 One driver per plate

There is no unique constraint on the plate column. One driver per multicab is enforced through the
vehicle, for the reasons below. Full detail is in DRIVER_CHANGES_PLAN 1.1-1.2.

- `vehicle_id = route-PLATE` (`20261027000000_driver_registration.sql:304`).
- `driver_devices_one_active_per_vehicle`, a unique index (`20261013000000_driver_side.sql:52`).
- `admin_provision_driver` refuses a vehicle that already has an active phone (lines 420-423).
- `registration_collect` retires every phone on the plate (`20261027000000_driver_registration.sql:364-371`).
- `console_registrations` (line 420) and `console_decide` (line 451) pick the newest phone on the plate.
- **Plate normalisation exists already:** `normalizePlate` (`supabase/functions/_shared/registrationRules.ts:40`),
  shared by the app and the Edge Function. The database check repeats it.

### 1.4 Beacon identity and relay matching

- The beacon belongs to the **vehicle** (`vehicle_beacons`: one `short_id` and one Vault secret per
  `vehicle_id`). It is not the plate itself and not the phone.
- The rotating code is HMAC(secret, slot) (`src/shared/beacon/code.ts`). `beacon_verify` answers with
  the vehicle.
- Relays and map markers are keyed by `vehicle_id` (ingest upserts `telemetry_latest` on it).
- Each provisioning and each retire **replaces** the vehicle's secret.
- **Stop condition check:** the identity is the vehicle, not the plate. Sharing it between abang
  drivers does not change relays in the field. Replacing the secret on setup or retire does break
  the other driver's beacon. Decision Q1 of 2026-11-19 covers this.

### 1.5 Fares and discounts

- **Constants:** `src/shared/config/index.ts:190-208`.
  - Base ₱14.00 for 4 km, ₱2.00 per km after.
  - Discount ×0.8 for student, senior and PWD. Rounding to ₱0.25.
  - The comment names the source: "traditional jeepney rate (LTFRB)", Emjay, 2026-10-22.
- The seed copies them into each `franchise_routes` row, and the fare engine reads that row
  (`src/shared/fare/fare.ts`).
- **Status: DONE** (one config place, with source and date). It needs only a "replace with the PUJ
  General Fare Guide" note.

### 1.6 Beacon advertising

- **Settings:**
  - `BEACON_ADVERTISE_MODE = 'balanced'` and `BEACON_TX_POWER = 'medium'` (`src/shared/config/index.ts:701-702`).
  - They are passed to `modules/tunton-beacon` (`BeaconAdvertiserService.kt:171-178`).
  - The service uses Android `AdvertisingSet`: legacy mode, not connectable, scannable.
  - The code goes in the scan response.
- **Interval:** `balanced` gives `INTERVAL_MEDIUM`, about 250 ms. `low_power` gives `INTERVAL_HIGH`,
  about 1 s.
- **Power:** `medium` gives `TX_POWER_MEDIUM`, about −7 dBm. `low` is about −15 dBm, and `ultra_low`
  about −21 dBm.
- **The native code already accepts `low_power`, `low` and `ultra_low`.** Changing the constants
  needs a new driver APK build, but no native code change.

### 1.7 Item status

**Phase 1 (selfie):**

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | CTTMD/CTTDM wording | PARTIAL | serverConfig comment done (ac95502); `src/strings/en.ts` 1636, 1655, 1656, 1928, 1930, 1949, `admin/README.md:5`, docs left |
| 2 | Full name field | PARTIAL | DB, Edge Function, rules done (ac95502); driver screen not built |
| 3 | Document choice | PARTIAL | same as 2 |
| 4 | Selfie, front camera, capture time | PARTIAL | server accepts `selfieAtMs` (ac95502); screen still `facing="back"` (`register.tsx:447`) |
| 5 | Multicab photo | DONE | unchanged |
| - | Consent text | NOT BUILT | |
| 6 | Admin Pass/Fail/N/A | PARTIAL | `console_registrations_ltfrb`, rules `canApprove` done; admin UI not built |
| 7 | Approve/Reject rule | PARTIAL | enforced in DB `console_decide` overload (ac95502); UI not built |
| 8 | Decision record | DONE in DB | status, `checks`, `document_type`, `decided_by` (reviewer), `decided_at`; no image or list fields |
| 9 | Photos deleted after decision | PARTIAL | `admin/src/api.ts:51-62` + `console_photos_deleted`; no test (admin has no test setup) |
| 10 | DRV-00xx system-assigned | DONE | `20261013000000_driver_side.sql:42,438` |

**Phase 2 (stops and detours):**

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Stopped with beacon continues | NOT BUILT | idle rule ends after 20 min whatever the beacon; no scan during relay (1.1) |
| 2 | Detour 300 m / 10 min, icon held, ETA paused | NOT BUILT | no off-route rule on a released relay |
| 3 | End only on beacon lost / destination / manual / detour | PARTIAL | destination and manual done; beacon-lost and detour not; idle and cap exist |
| 4 | Status only in the Track view | PARTIAL | the Track panel shows ETA and "Updated"; markers show the relay status (`VEHICLE_STATUS_RELAY_MAX_MIN`, VS1), which goes against "map icon simple" |
| 5 | ETA from moving time plus stop allowance | NOT BUILT | 1.2 |
| 6 | Alerts while stopped | DONE | distance-based (1.2) |
| 7 | Field test logging | DONE | S10 field log (`src/shared/fieldtest`): ETA against arrival and relay-to-map delay, behind the Record switch |

**Phase 3 (abang):** all NOT BUILT. See the plan in DRIVER_CHANGES_PLAN Part A. Item 2 (plate
helper) is DONE.

**Phase 4 (fares and feedback):**

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Fares in one config file | DONE | 1.5 |
| 2 | Feedback link | DONE | `FEEDBACK_FORM_URL` (`config/index.ts:673`, empty hides it), Menu row (`src/app/menu.tsx:50`) |

**Phase 5 (beacon battery):**

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Report the current settings | DONE | 1.6 |
| 2 | Lower-power settings as constants | NOT BUILT | |
| 3 | Battery test procedure | NOT BUILT | |

## 2. Stop conditions hit

1. **Phase 2 needs beacon scanning for the whole relay, with the screen off.**
   - Today the scan runs only while the Relay panel is open, and for at most 15 min.
   - "Relay continues while the beacon is heard" and "ends when the beacon is lost" both need a
     background scan.
   - I cannot confirm that `tunton-beacon`'s scan keeps running with the screen off. Android may
     need the scan moved into the relay's foreground service. That is a **native change and a new
     commuter APK**.
2. **Phase 2 contradicts the PRD.**
   - PRD 19.4: no ETA under 5 km/h.
   - PRD 8.4: the idle stop.
   - The hand-mapped `HIGH_TRAFFIC_ZONES` were your decision D1 of 2026-10-22. The prompt says no
     hand-mapped zones.
3. **Phase 3 contradicts your 2026-11-19 answers.**
   - Q2: skip the takeover dialog. The prompt asks for it when online.
   - Q3: send counts to all drivers. The prompt says keep the current rule only if the server
     cannot know the active driver. It cannot (DRIVER_CHANGES_PLAN 1.4), so the current rule stays.
     This one agrees.
   - The takeover remains: the driver app has no internet link after setup.
4. **Branch names.** The selfie work is on `feat/abang-selfie-registration` (ac95502). The prompt
   wants `feat/selfie-ltfrb`. `feat/selfie-ltfrb-wording` does not exist.

### Owner decisions (2026-11-22)

| Question | Decision |
|---|---|
| Phase 2 background scan | No native change. Build the ETA, detour and Track view parts. The idle rule stays in place of a beacon-lost rule; this is recorded as a limitation. |
| ETA rule and zones | Replace "hidden under 5 km/h" with the moving-time ETA plus a stop allowance, and update PRD 19.4. Keep the high-traffic zones. |
| Takeover dialog | Keep skipping it (the Nov 19 decision), recorded as a limitation |
| Branches | Rename `feat/abang-selfie-registration` to `feat/selfie-ltfrb`, use the prompt's branch names, and stop for approval after each phase |

### Phase 2 as built (2026-11-22, branch `feat/relay-stops-detours`)

- Constants (`src/shared/config/index.ts`): `ETA_MOVING_WINDOW_S = 300`, `ETA_STOP_ALLOWANCE_S_PER_KM = 30`,
  `SHORT_DETOUR_FROM_M = 60`, `SHORT_DETOUR_MAX_M = 300`, `SHORT_DETOUR_MAX_MIN = 10`, `LIVE_SPEED_HISTORY_S = 300`.
- **ETA** (`src/shared/tracking/eta.ts`): moving speeds only, plus 30 s per km; it holds while the multicab
  stands and is paused on a short detour. The "hidden under 5 km/h" rule is gone. Per km rather than per
  stop: lights and traffic are spread along the road, not only at stops, and the field log can tune one
  number.
- **Detour on the map** (`src/shared/telemetry/liveRow.ts`): a live position farther than 60 m from the route
  keeps the marker at its last on-route position, marked off route; the next on-route position moves it.
- **Detour in a relay** (`src/shared/relay/limits.ts`): the relay ends past 300 m or 10 minutes off the route.
- **Track view** (`src/shared/tracking/status.ts`, `TrackingPanel.tsx`): Moving, Stopped · N min, Off route ·
  temporary, ETA paused, and the Last updated box. The map marker no longer shows the VS1 status marks.
- **Not built (owner decision):** ending a relay on beacon loss, and keeping it while the beacon is heard
  past the idle limit. The idle stop and the high-traffic zones stay.
- **Alerts while stopped:** unchanged, they use the distance (tests in `eta.test.ts`).
- **Field test logging:** already built (S10); unchanged.

### Phase 3 as built (2026-11-22, branch `feat/abang`)

- Migration `supabase/migrations/20261122000000_abang_shared_plate.sql`: one active phone per number
  (replacing one per vehicle; the old index is dropped, no row changes); `admin_provision_driver`,
  `registration_collect` and `admin_retire_device` replaced in place as in DRIVER_CHANGES_PLAN Part A.
- One marker per multicab: the drivers share the vehicle (route and plate) and its beacon secret, and
  markers and relays are keyed by vehicle, so two phones on at once still read as one multicab.
- Plate normalisation: `normalizePlate` (`supabase/functions/_shared/registrationRules.ts`), already
  shared by the app and the Edge Function; the database keeps its check and compares without spaces.
- Same phone and same plate twice: the number is unique among active phones; Set up again retires
  the old one first.
- Admin: "Also on this plate" in Drivers (`platePartners`); the registration warning and the retire
  confirmation say the other drivers keep working.
- Not built (owner): the takeover step. SMS keeps going to every active phone on the route.

### Phase 4 (2026-11-22): nothing to build

- Fares: already in one config place with source and date (1.5). Left as they are until the LTFRB
  PUJ General Fare Guide arrives (owner, 2026-11-22).
- Feedback link: already built (`FEEDBACK_FORM_URL`, Menu, Give feedback); it shows once the form link
  is set.

### Phase 5 as built (2026-11-22, branch `feat/beacon-battery`)

- Current: `balanced` (about 250 ms) at `medium` (about -7 dBm), unchanged.
- Proposed, behind `BEACON_LOW_POWER = false`: `low_power` (about 1 s) at `low` (about -15 dBm)
  (`src/shared/config/index.ts`, `src/shared/beacon/advertise.ts`). The native module already maps both,
  so turning it on needs a new driver APK only.

**Battery test procedure (driver phone):**

1. One driver phone, charged to 100 %, SIM in, screen off, not charging. Brightness, Wi-Fi, mobile data
   and other apps the same for every run. Note the phone model and Android version.
2. Run A, beacon off: 2 hours (at least 1). Note the battery % at the start, every 30 minutes and at the end.
3. Run B, beacon on with the current settings: the same length and readings.
4. Run C, beacon on with the low-power settings (a driver APK built with `BEACON_LOW_POWER = true`): the
   same, and every 10 minutes check from a commuter phone in the multicab that Relay finds it
   (Found by Bluetooth within 15 s).
5. Report % per hour for each run (start % minus end %, divided by the hours). B minus A is what the
   beacon costs today; C minus A with the low-power settings. Note any missed detection in run C.
6. Keep the low-power settings only if run C misses no detection inside the multicab; then set
   `BEACON_LOW_POWER = true` and build a new driver APK.

## 3. Plan (after your answers)

### Phase 1: `feat/selfie-ltfrb`

Rename the current branch, or branch from it. Remaining work:

1. **Driver app:**
   - name field;
   - document choice;
   - front-camera selfie with its time and guidance text;
   - consent rewrite;
   - `api.ts` sends the new fields;
   - en.ts wording.
2. **Admin:**
   - the card uses `console_registrations_ltfrb`;
   - Pass/Fail/N/A controls;
   - Approve gated by `canApprove`;
   - Reject reason from `failedChecks`;
   - name, document type and selfie time shown.
3. **Photo deletion test:** move the delete-then-confirm logic of `admin/src/api.ts` into a pure
   function the root jest suite can test.
4. **Docs:** PRD, SCOPE_AND_LIMITS, PROPOSAL_TRACEABILITY, the privacy section, and TESTER_SURVEY
   line 120.

**Needs:** a migration apply (`20261119000000_ltfrb_selfie_registration.sql`), an Edge Function
redeploy, a driver APK and an admin redeploy. No new native module.

### Phase 2: `feat/relay-stops-detours`

These are proposed numbers. Each one would be a constant in `src/shared/config`.

- `RELAY_BEACON_LOST_END_S = 120`.
  - Riders in the back of a multicab lose a few packets. The panel already tolerates 30 s, and
    120 s covers a long stop with the engine off without keeping a walked-away rider for long.
- `RELAY_DETOUR_MAX_M = 300` and `RELAY_DETOUR_MAX_MIN = 10`, as in the prompt.
- `ETA_STOP_ALLOWANCE_S = 20` per remaining stop.
  - This is a guess for unloading at a stop. The field log's ETA error will tell if it is right.
- **ETA speed:** the mean of the moving samples only (speed ≥ `STATIONARY_SPEED_KMH = 2`).
  - It needs at least 2 such samples in the last 5 min, instead of 90 s.
  - The "hidden under 5 km/h" rule goes. While stopped, the last moving speed is kept, so the ETA
    holds steady and does not vanish.
- **Idle rule:** replaced by beacon-lost when a scan runs. It stays as the fallback when Bluetooth
  is off.
- **High-traffic zones:** removed, or kept as a fallback (your call).
- **Track view:** status "Moving", "Stopped · 2 min" or "Off route · temporary", the ETA or "ETA
  paused", and "Updated x s ago".
- **Markers:** markers drop the VS1 status text.

**Depends on:** the background scan. Without it, items 1 and 3 cannot be built.

### Phase 3: `feat/abang`

DRIVER_CHANGES_PLAN Part A, with the Q1 to Q3 answers, plus:

- the "Also on this plate" column;
- tests for both drivers registering, the same phone and plate refused, and retire.

### Phase 4: `feat/fares-feedback`

- A note on the fare constants naming the PUJ General Fare Guide as the coming source.
- The feedback link exists already. It needs only your URL, and nothing to build until then.

### Phase 5: `feat/beacon-battery`

- Add `BEACON_ADVERTISE_MODE_LOW_POWER = 'low_power'` (about 1 s) and
  `BEACON_TX_POWER_LOW_POWER = 'low'` (about −15 dBm), unused by default.
  - At 1 s, a commuter phone scanning in low latency still hears several packets within
    `BEACON_PRESENCE_S = 3`. Inside a multicab (under 5 m), −15 dBm should stay above the
    −65 dBm presence threshold. Both need the real-multicab retest.
- **Battery test procedure:**
  1. Use the same driver phone, charged to 100%, with the screen off and the SIM in.
  2. Run 1: beacon off, 2 h; note % at start and end.
  3. Run 2: beacon on (current settings), 2 h.
  4. Run 3: beacon on (low-power settings), 2 h, with a commuter phone checking detection every
     10 min.
  5. Report the % per hour for each run, and the number of missed detections in run 3.

## 4. Docs

At the end of each phase, update:

- `docs/PRD.md`, `docs/SCOPE_AND_LIMITS.md` and `docs/PROPOSAL_TRACEABILITY.md`;
- the privacy section (PRD 15);
- `docs/TESTER_SURVEY.md:120`.

The manuscript files are not read or touched.
