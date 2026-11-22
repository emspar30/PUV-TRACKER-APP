# Tunton: system status audit (commuter app, driver side, admin console)

Audit date: 2026-11-22. Code state: branch `feat/beacon-battery` at commit `c0e0563`, which contains
every change up to the final-defense revisions (none of them pushed to GitHub yet).

## How to use this file

This file is for an AI assistant helping to revise the capstone paper. It records what the software
actually does today and how far each part has been tested, so the paper claims only what is true.

- **"Built"** means the code exists and its automatic tests pass. It does not mean anyone saw it work
  on a phone.
- **"Phone-checked"** means a team member ran the step on a phone or the Android emulator and marked
  it Pass in the build tracker. Most of these checks used **Demo data** (simulated multicabs), not a
  real multicab.
- **"Field-tested"** means tried in a real multicab with real riders. **Almost nothing is
  field-tested yet** (section 6).
- No measured results exist yet for ETA accuracy, map delay, battery use, data use or position error.
  Do not write numbers for these; describe them as planned measurements.
- Where this file and an older document disagree, this file is newer. The detailed requirements are
  in `docs/PRD.md` (the source of truth); the known limits are in `docs/SCOPE_AND_LIMITS.md`.

## 1. The system in one paragraph

Tunton is an Android-only prototype for multicab (PUV) commuters in Butuan City, made of three apps
built from one codebase (Expo SDK 57, React Native, TypeScript): the **commuter app**, the **driver
app** and the **gateway app**, plus a **web admin console** (React and Vite) and a **cloud backend**
(Supabase: Postgres with row-level security, Edge Functions) with an **SMS worker** (Node.js on
Render). Commuters see multicabs on a live map only while a rider "relays" one: a rider inside the
multicab shares its position, verified by the multicab's Bluetooth beacon (the driver's phone). Drivers
never use the internet after setup: they receive the waiting counts at each stop by SMS, sent by the
gateway phone. No AI model is used anywhere; the in-app assistant "Tunie" is rule-based and works
offline.

## 2. Quality checks (as of 2026-11-22)

| Check | Result |
|---|---|
| Automated tests (`npx jest`) | 136 suites, 1,909 tests, all passing |
| TypeScript typecheck (`npx tsc --noEmit`, strict) | No errors (all apps, admin console, SMS worker) |
| Lint (`npx expo lint`) | Clean |
| Android bundle of each app (`expo export`) | Commuter, driver and gateway all bundle without errors |
| Admin console production build | Builds |
| SMS worker build | Builds |
| `expo-doctor` | 1 warning: 11 Expo packages are a few patch versions behind. Not an error; not updated (needs a decision and a retest) |
| Edge Functions' entry files | Not type-checked on this PC (Deno not installed); `driver-registration` deployed without errors on 2026-11-22 |
| Live database tests (`npm run test:live`) | Not run in this audit (they write test rows to the live project) |
| Phone checklist (build tracker) | 464 current test steps: 185 passed, 41 N/A, 1 failed (since fixed, see 5.1), 237 not tested yet |

**APK status:** the newest changes (2026-11-19 to 2026-11-22) are not in any installed APK yet. A new
commuter APK and a new driver APK are needed before they can be tested on phones. The driver APK
build will also be the first compile of a Kotlin change from 2026-11-16 (the beacon code keeps
changing with the screen off).

## 3. Commuter app

Status key: **Phone-checked** (passed on a phone or emulator, mostly with Demo data), **Built** (code
and automatic tests done, not yet checked on a phone, or only partly), **Partial**, **Changed today**
(revised 2026-11-22, needs a new APK and a new check).

### 3.1 Map and tracking

| Feature | Status | Notes |
|---|---|---|
| Offline map of Butuan (routes, stops, streets without internet) | Phone-checked | Zoom 18 not checked |
| Six routes (R1 to R5, R14) with 39 stops | Partial | R14 return leg, six stops and the real terminal list still being traced |
| Multicab markers with seat colour (green, amber, red) | Phone-checked (demo) | Moving live markers by day never seen; only parked ones at night |
| Live, Stale, No data and Estimated markers (dead reckoning up to 5 minutes) | Phone-checked | |
| All routes view, route list, map remembers the route, zoom and Locate | Phone-checked | |
| Track one multicab: ETA, guide line, distance alerts at 1 km, 500, 250, 100 m, arrival | Phone-checked (demo, 15 steps) | Lock-screen notifications built 2026-11-13, not yet phone-checked |
| ETA rule | **Changed today** | Distance along the route / mean of moving speeds (2 km/h or more, last 5 minutes) + 30 s per km for stops, lights and traffic. Holds steady while the multicab stops; no longer hidden under 5 km/h. The 30 s per km is a starting guess, not measured |
| Short detour (gas station, side street) | **Changed today** | More than 60 m off the route: the marker stays where it left the route and the Track view says "ETA paused"; allowed up to 300 m and 10 minutes |
| Track view status: Moving, Stopped · N min, Off route · temporary | **Changed today** | Shown only in the Track view. The map marker now shows the position only (the earlier status marks on the marker were removed) |
| Night Mode (21:00 to 04:59): no multicab positions; "Where R4 has been" stop view | Phone-checked (demo) | |
| Offline banner and offline behaviour of every tab | Phone-checked | |

### 3.2 Check-in (telling drivers someone is waiting)

| Feature | Status | Notes |
|---|---|---|
| Check in where you stand (at a stop within 40 m, or near the route line within 40 m) | Phone-checked (12 steps) | Sends only the stop code and a "near" flag to the server |
| Check-in costs 0.3 Energy per route pinged | Phone-checked | |
| "Did you board?" prompt | Phone-checked | In-app only |
| Driver receives the count by SMS | Built | Not checked in the tracker with the current check-in (step marked N/A); the partner's SMS device tests (DR5, DR7) only partly run |

### 3.3 Relay (crowdsourcing a multicab's position) and Crowdsource feed

| Feature | Status | Notes |
|---|---|---|
| Relay gate: needs location, a verified multicab beacon (Bluetooth) and being on that multicab's route | Phone-checked (demo; 4 steps) | Finding a real driver beacon by Bluetooth was seen on phones in October 2026 (DR8); the side-by-side beacon test is not done |
| Queued relay: posted only once one beacon is heard and the rider has moved 50 m along the route | Built | Not yet phone-checked |
| Relay ends: at the destination, by Stop, after 20 minutes in one spot, after the 3-hour "Still riding?" check | Built; partly phone-checked | High-traffic zones (5 hand-mapped spots) hold the 20-minute idle clock |
| Relay ends after a detour too far (300 m) or too long (10 minutes) | **Changed today** | Not phone-checked |
| Relay in the background (screen off, other apps) | Built | Phone tests pending |
| Verification window (speed, route line, distance) and in-vehicle detection | Built | Thresholds are starting values; need field rides |
| Two riders on one multicab (Primary and Secondary, take-over after 90 s) | Built | Needs a two-phone ride |
| Crowdsource feed, flags (3 flags hide a post), Trusted badge | Phone-checked | |
| Moderation: strikes, 7-day suspensions, Merit shields, appeals | Built | No moderator screen; moderators use SQL functions in the Supabase dashboard |
| Known detour routes (Active Detour Mode) | Built | No detour lines traced yet, so not usable |

Important: the phone listens for the beacon only while the Relay panel is open. After a relay is
released, it runs on GPS; it is **not** ended when the beacon is lost (that would need a native change,
declined by the owner on 2026-11-22).

### 3.4 Energy, assistant, account and settings

| Feature | Status | Notes |
|---|---|---|
| Energy wallet (max 5, +1 per 12 hours, history); tracking costs 1 per 30 minutes | Phone-checked | |
| Earning: +1.0 for a relay on the live map, +0.5 in Crowdsource | Built | Steps marked N/A so far (need a real beacon) |
| My Rides: trip planner, walking directions, fare estimate with 20% discount for student, senior and PWD | Phone-checked (21 steps) | Fare ₱14.00 for 4 km, ₱2.00 per further km: an estimate until the LTFRB fare guide is received |
| Ask Tunie (rule-based assistant, English and Bisaya questions, offline) and the commuter guide | Phone-checked | Bisaya phrases not yet checked by a Butuan speaker |
| Account required (email sign-in), introduction, avatar, profile, badges | Phone-checked | Badges count on the phone only |
| Location consent and accuracy checks (mock locations refused) | Phone-checked | Consent text awaits the Data Protection Officer's review |
| Delete account, privacy contact | Phone-checked | |
| Settings, Demo and simulation menu, tips tour, notifications screen | Phone-checked | |
| Give feedback link in Menu | Built | Hidden until the Google Form link is set |

## 4. Driver side

### 4.1 Driver app

| Feature | Status | Notes |
|---|---|---|
| Bluetooth beacon with a code that changes every 60 s (signed, checked by the server) | Phone-checked (partner, DR4) | Screen-off code change (2026-11-16) not yet compiled or tested |
| Waiting counts per stop received by SMS, no internet after setup | Built; partner device tests DR5 partly run | |
| Self-registration (number, plate, route, photos), then setup collected once after approval | Phone-checked by the partner (DRG6, 2026-10-29) with the old form | |
| **New registration form (LTFRB)** | **Built 2026-11-19 to 22, not on a phone yet** | Full name as written on the LTFRB document; choice of "Driver's Academy ID (old LTFRB ID)" or "Driver's Academy certificate (LTFRB)"; a selfie holding that document (in-app camera only, front camera first, capture time recorded) and a multicab photo; consent text citing R.A. 10173 |
| Driver removed by the admin ("This phone was removed") | Built and tested by the partner | |
| Several drivers on one multicab ("abang") | **Built 2026-11-22, database change applied** | 2 or 3 drivers, each with their own driver ID and phone, share the multicab's beacon, so it shows as one multicab |
| Beacon advertising | Unchanged | About every 250 ms at medium power. Lower-power settings (about 1 s, low power) exist but are switched off until a battery and detection retest |

Multicabs fall under the **LTFRB** (not the city transport office). Earlier documents mention a
"CTTDM ID"; that wording was replaced everywhere in the app on 2026-11-19 to 22.

### 4.2 Gateway app and SMS worker

| Part | Status | Notes |
|---|---|---|
| SMS worker (counts per route every 30 s, minimum gap 120 s, daily cap) | Tested (DR6) | Runs on Render |
| Gateway app (a phone that sends the queued SMS) | Built | One delivery test passed (Globe to TNT in 15 to 41 s); the other device tests (DR7) not run |
| Daily SMS cap | 100 per gateway SIM | Placeholder until the real SIM or promo limit is confirmed |

## 5. Admin console (web)

| Feature | Status | Notes |
|---|---|---|
| Sign-in with the admin account; Registrations, Drivers and Settings pages | Phone-checked earlier by the partner | |
| **Review with five checks** | **Built 2026-11-19 to 22, database part live** | Document type, Name match, On LTFRB list, Face match (N/A for the certificate), Plate match: each Pass, Fail or N/A. Approve only when the rule passes; Reject needs a failed check, with the reason picked from the failed checks. The database enforces the same rule |
| Photos deleted right after approve or reject | Built and covered by automatic tests | Only a text record remains: the decision, each check's result, the document type, who decided and when |
| Drivers list, route filter, plate search, Retire | Built | Shows "Also on this plate: DRV-00xx" for abang drivers |
| Admin PIN for the driver phones' Admin screen | Built | |
| Moderation screens | Not built | Done in the Supabase dashboard instead |

Verification of drivers is a **human decision**: there is no OCR, face recognition or document
classification. The admin checks the LTFRB driver list outside the app; the list is never imported or
stored (promised to the LTFRB in writing).

### 5.1 The one failed phone step

`au1.fresh@1`: after clearing the app's storage, a returning account was sent through the introduction
again. Fixed on 2026-11-02 (commit `0ce4588`); the newer steps that re-test it (`au1.fresh@3`, `au1.cleared@1`) are not marked yet.

## 6. Evaluation status (for the Results and Methodology chapters)

| Item | Status |
|---|---|
| Field experiments E1 to E9 (battery, data use, background survival, Bluetooth signal inside a multicab, beacons side by side, verification) | Tools built (Field test log in the app, exports CSV; procedure in `docs/FIELD_TESTS.md`). **No field results recorded yet** |
| ETA accuracy and map delay (target under 5 s) | Measured by the Field test log; **no results yet** |
| Position error (target median 50 m or less) | No experiment planned yet |
| Driver beacon battery (beacon on vs off, % per hour) | Procedure written (`docs/APP_CHANGES_PLAN.md`); **not run yet** |
| User survey | Draft in `docs/TESTER_SURVEY.md`. Decision of 2026-11-19: commuters and drivers answer the TAM part only; the System Usability Scale and the IT-expert part are left out of the paper. Not run yet; the Google Form is not made yet |
| ISO/IEC 25010:2023 quality evaluation | No IT expert was found, so the team tests the 9 characteristics itself with recorded evidence (46 steps in the build tracker). To be stated as a limitation, with an independent expert evaluation recommended. Not run yet |
| Real multicab field test | One informal field test on a real multicab showed the marker was right but arrival was delayed by stops, lights and traffic, and the multicab sometimes left its route (a gas station). The ETA and detour changes of 2026-11-22 answer that; they are not re-tested yet |

## 7. Changes made for the final defense (2026-11-19 to 2026-11-22)

1. **LTFRB selfie registration** (driver app, admin, database): replaces the CTTDM ID photo. See 4.1 and 5.
2. **Stops, detours, Track view and ETA:** see 3.1 and 3.3.
3. **Abang, several drivers per multicab:** see 4.1. No "take over this unit" step: after setup the
   driver app has no internet link, so the server cannot know whose beacon is on. The waiting counts
   go by SMS to every driver of the multicab.
4. **Fares:** unchanged, in one config place, waiting for the LTFRB PUJ General Fare Guide.
5. **Driver beacon battery:** lower-power settings prepared but off; battery test procedure written.

Database: the LTFRB and abang migrations are applied on the live Supabase project, and the
`driver-registration` function is redeployed (2026-11-22). Whether the earlier migrations of
2026-11-02 to 2026-11-13 (verification, two-rider baton, moderation, detours, open live map,
account avatar) are all applied is not confirmed in this audit; `npx supabase migration list`
shows it.

## 8. Known limits to state honestly in the paper

- A multicab appears on the live map only while a rider relays it.
- The live map was limited to team accounts; a change opening it to every signed-in account is built
  (2026-11-13), but whether its database setting is applied is not confirmed here.
- Verification thresholds (speed, distance, Bluetooth signal) are starting values from the PRD, not yet
  tuned in the field.
- The ETA's stop allowance (30 s per km) is a starting guess.
- A relay is not ended by losing the multicab's beacon; it ends by destination, Stop, detour limits,
  20 minutes idle or the 3-hour check.
- Route data is partly provisional (R14 return leg, six stops, terminals).
- Fares are estimates until confirmed against the official LTFRB fare guide.
- Driver verification is by eye; the LTFRB list check happens outside the app, so the app holds no
  evidence of it.
- Abang drivers share one beacon secret: a lost phone retired while another driver is active stays
  valid until the retire text reaches it.
- Every driver of a multicab receives the waiting counts, which counts against the gateway's daily SMS cap.
- The location consent text awaits the Data Protection Officer's review; the selfie and name collection
  also need it.
- Tunie's Bisaya phrases need a check by a Butuan speaker.
- Outside this phase on purpose: Play Integrity and device fingerprint, Cebuano screens, Play Store
  release, route updates without an app release.

## 9. Where the evidence is

| What | Where |
|---|---|
| Requirements and every decision with its date | `docs/PRD.md` (change log at the end) |
| Scope and known limits | `docs/SCOPE_AND_LIMITS.md` |
| Proposal-to-build traceability | `docs/PROPOSAL_TRACEABILITY.md` |
| The defense changes, audit and plan | `docs/APP_CHANGES_PLAN.md`, `docs/DRIVER_CHANGES_PLAN.md` |
| Field experiment procedures | `docs/FIELD_TESTS.md` |
| Survey draft | `docs/TESTER_SURVEY.md` |
| Phone test checklists and results | The build tracker (private claude.ai page, owner's account) |
| Constants (every threshold) | `src/shared/config/index.ts`, `supabase/functions/_shared/serverConfig.ts` |
