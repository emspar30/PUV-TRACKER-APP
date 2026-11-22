# Tunton: system status audit (commuter app, driver side, admin console)

Audit date: 2026-11-22, last updated the same day after the security changes, the push and the APK
builds. Code state: branch `main` at commit `bd1345c`, pushed to GitHub. Every final-defense change is
in it, and the new commuter and driver APKs were built from it (section 2). Section 0 lists what
changed since the first version of this audit.

## 0. What happened since the first version of this audit (2026-11-22)

1. **Security hardening (weak points the panel may ask about).** All built, all database changes
   applied on the live Supabase project:
   - **Device ban:** a suspension now also covers every other account used on the same phone (3.3).
   - **Admin two-step sign-in:** the admin console asks for a 6-digit authenticator-app code after the
     password; the database refuses admin actions without it. Set up and confirmed working by the
     owner (QR code scanned, code accepted) (5).
   - **Admin action log:** who approved, rejected, retired or changed the PIN, and when (5).
   - **Supabase Security Advisor:** 0 errors after closing one database function to app users (8).
   - **Passwords need at least 8 characters**, in the app and in Supabase Auth.
2. **Small-screen fix (commuter Map tab).** On short screens (under 700 dp tall) the map buttons and
   the night card no longer crowd each other. Reported by the partner on a small phone; checked by the
   owner on a tablet in its normal and "small phone" display sizes.
3. **ISO/IEC 25010 self-test run.** Most of the 46 steps were run by the team with evidence; results
   are in section 6.1. TAM results of the user survey are in section 6.2.
4. **Pushed to GitHub** (`main` at `bd1345c`).
5. **Weak-point fixes after the ISO run** (code done, not in any APK yet):
   - **Commuter data use:** the live map re-reads a route every 120 s instead of 30 s (and at once
     when its live connection comes back); the Check-in tab reads the waiting counts only while it
     is open, every 60 s instead of 30 s. The 425.5 KB per hour measured in step 13 came mostly from
     these re-reads (one per route in the All routes view). **Needs a new commuter APK and a new
     measurement.**
   - **Admin console idle sign-out** after 20 minutes without activity (web; no APK needed).
   - **Backup authenticators:** the admin can add up to 2 more authenticator apps on other phones in
     Settings, so a lost phone does not lock the console (web; no APK needed).
6. **Night relays go to Crowdsource** (2026-11-23): see 3.1. Migration 20261123000002 to apply;
   needs the next commuter APK.
6a. **Automatic moderation and the console's Moderation page** (2026-11-23): web part and both
   migrations built; the commuter app's part (red flag, notices, ban text) built and waiting for a new
   commuter APK. See 3.3 and 5.
7. **New APKs built** on 2026-11-22 from `bd1345c`: commuter (EAS build `0dbacde9`) and driver (EAS
   build `c89c010e`). Both builds finished without errors. The driver build is the first compile of
   the screen-off beacon change of 2026-11-16. **Neither APK is installed and phone-checked yet.**

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
- Measured values now exist only for what section 6.1 lists (driver battery, data use, SMS delay,
  phone brands). No measured results exist for ETA accuracy (in seconds), map delay or position
  error. Do not write numbers for these; describe them as planned measurements.
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
| Automated tests (`npx jest`) | 138 suites, 1,924 tests, all passing (re-run after the security changes) |
| TypeScript typecheck (`npx tsc --noEmit`, strict) | No errors (all apps, admin console, SMS worker) |
| Lint (`npx expo lint`) | Clean |
| Android bundle of each app (`expo export`) | Commuter, driver and gateway all bundle without errors |
| Admin console production build | Builds |
| SMS worker build | Builds |
| `expo-doctor` | 1 warning: 11 Expo packages are a few patch versions behind. Not an error; not updated (needs a decision and a retest) |
| Edge Functions' entry files | Not type-checked on this PC (Deno not installed); `driver-registration` deployed without errors on 2026-11-22 |
| Live database tests (`npm run test:live`) | Not run in this audit (they write test rows to the live project) |
| Phone checklist (build tracker) | 464 current test steps: 185 passed, 41 N/A, 1 failed (since fixed, see 5.1), 237 not tested yet |

**APK status:** a new commuter APK and a new driver APK were built on 2026-11-22 from commit
`bd1345c` (EAS builds `0dbacde9` and `c89c010e`, both finished without errors). They contain every
change of 2026-11-19 to 2026-11-22. The driver build compiled the screen-off beacon change of
2026-11-16 without errors. Until they are installed and phone-checked, everything marked "Changed
today" or "Built 2026-11-22" below is untested on a phone.

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
| Night Mode (21:00 to 04:59): no multicab positions | Phone-checked (demo) | **Changed 2026-11-23:** every night relay goes to Crowdsource (the live map switch is locked off; the server does the same) and earns +1.0 Energy; the "Where R4 has been" stop list is removed and a Night Mode note with See Crowdsource takes its place. Needs the next commuter APK |
| Small screens (under 700 dp tall) | **Changed today** | Tunie button stays round beside the second button column; the night card shows 2 stops instead of more. Checked on a tablet set to a small display size; not yet on a small phone |
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
| Moderation: strikes, 7-day suspensions, Merit shields, appeals | Built | Since 2026-11-23 automatic (see 5): a flag notifies the author; a report hidden by 3 weighted flags gives a strike unless it was a verified ride; after a suspension, 2 new strikes give a permanent ban. Rider side built 2026-11-23 (red filled flag that stays, notices, "Account banned"); needs the next commuter APK |
| Device ban: a suspension covers every account used on the same phone | Built 2026-11-22, database change applied | At each sign-in the phone sends its Android ID; only a keyed HMAC-SHA256 of it is stored (key in Supabase Vault). A new account on a banned phone gets the same suspension, and lifting the ban (upheld appeal) lifts the copies. Evaded by a factory reset, another phone or a rooted phone; two people sharing one phone share a ban. Not phone-checked yet |
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
| Account required (email sign-in), introduction, avatar, profile, badges | Phone-checked | Badges count on the phone only. New accounts need a password of at least 8 characters (since 2026-11-22) |
| Location consent and accuracy checks (mock locations refused) | Phone-checked | Consent text awaits the Data Protection Officer's review |
| Delete account, privacy contact | Phone-checked | |
| Settings, Demo and simulation menu, tips tour, notifications screen | Phone-checked | |
| Give feedback link in Menu | Built | Hidden until the Google Form link is set |

## 4. Driver side

### 4.1 Driver app

| Feature | Status | Notes |
|---|---|---|
| Bluetooth beacon with a code that changes every 60 s (signed, checked by the server) | Phone-checked (partner, DR4) | Screen-off code change (2026-11-16) compiled in the 2026-11-22 driver APK; not yet tested on a phone |
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
| **Review: plain Approve or Reject** | **Changed 2026-11-23 (web), migration to apply** | The five Pass/Fail checks of 2026-11-19 were removed: the admin compares the selfie, document, name and plate, checks the LTFRB list outside the console, then approves, or rejects with a typed reason the driver sees. Registrations decided before keep their checks. Confirmations use the console's own box instead of the browser's |
| Photos deleted right after approve or reject | Built and covered by automatic tests | Only a text record remains: the decision, each check's result, the document type, who decided and when |
| Drivers list, route filter, plate search, Retire | Built | Shows "Also on this plate: DRV-00xx" for abang drivers |
| Admin PIN for the driver phones' Admin screen | Built | |
| Two-step sign-in (authenticator app code after the password) | **Built 2026-11-22, applied, checked by the owner** | First sign-in shows a QR code to scan with Google or Microsoft Authenticator; every later sign-in asks for the 6-digit code. The database refuses every admin action from a session without it (`is_admin()` needs the second factor) |
| Idle sign-out after 20 minutes without activity | Built 2026-11-22 (web) | Not checked yet. The sign-in page says why it signed out |
| Backup authenticators (up to 3 phones in all) | Built 2026-11-22 (web) | Not checked yet. Settings, Two-step sign-in. With several, the code screen asks which app; the last one cannot be removed |
| Admin action log (approve, reject, retire, PIN change, with who and when) | Built 2026-11-22, applied | Written by database triggers, so it cannot be skipped or edited from the console; the last 50 entries are listed on Settings ("You", "System" or "Admin" plus a short ID). Database check confirmed the triggers exist |
| Moderation page | **Built 2026-11-23 (web); first migration applied, second (rules only) to apply** | Flagged reports with their evidence (ride check, beacon check, phone evidence, weighted flags, notes, author's strikes); the admin decides only hidden verified rides (evidence conflicts) and appeals, and may Lift a suspension or ban to fix a mistake. Suspensions and bans come only from the rules (no manual Suspend). Every action in Admin activity |

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
| ISO/IEC 25010:2023 quality evaluation | No IT expert was found, so the team tested the 9 characteristics itself with recorded evidence (46-step test plan). **Mostly run; results in 6.1.** To be stated as a limitation, with an independent expert evaluation recommended |
| Real multicab field test | One informal field test on a real multicab showed the marker was right but arrival was delayed by stops, lights and traffic, and the multicab sometimes left its route (a gas station). The ETA passed this test by eye (no seconds measured), but with the **old** ETA rule. The ETA and detour changes of 2026-11-22 answer what it found; they are not re-tested yet |

### 6.1 ISO/IEC 25010 self-test results (team-run, 2026-11-22)

Numbers are the team's own test-plan step numbers (1 to 46). Results as reported by the owner from the
test-plan sheet; the evidence (screen recordings, screenshots) is kept by the team.

| Steps | Result |
|---|---|
| 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 20, 21, 22, 28, 29, 30, 31, 32, 40, 43, 44, 45, 46 | Pass |
| 14 | N/A (driver app storage measured at 267 MB) |
| 41 | Fail: the Map tab was crowded on a small phone. Since partly fixed (section 0, item 2); not re-tested on a small phone |
| 23 to 27, 33 to 39 | Not tested yet |
| 2, 3, 19, 42 | Result not recorded in this audit |

Measured values:

| Measure | Value | Note for the paper |
|---|---|---|
| Driver phone battery, beacon on | 3 to 5% per 30 minutes | |
| Driver phone battery, beacon off | 2 to 3% per 30 minutes | So the beacon adds about 1 to 2% per 30 minutes |
| Commuter phone battery | 0.21% (as recorded) | Looks too low for real tracking; re-check how it was measured (duration, screen on or off) before reporting it |
| Commuter data use | 425.5 KB per hour | **Above the 150 KB per hour target** in the PRD. Cause found and fixed after the test (section 0, item 5); measure again with the next commuter APK and report both numbers |
| SMS delay, check-in to driver's phone | About 1 minute | Earlier single test: 15 to 41 s Globe to TNT |
| Phone brands | Works on Xiaomi, Vivo and Honor | Plus the Samsung phone and tablet used during development |

Caveats for the paper:

- **Step 25's pass rule is wrong.** It expects a relay to end when the beacon is lost. The app does not
  do that: after a relay is released it runs on GPS, and losing the beacon does not end it (3.3). Change
  the expected result before running it, or the step will "fail" on correct behaviour.
- Steps 12 and 13 are marked Pass; check them against their targets (13 is data use, which is above the
  150 KB per hour target).
- These are developer self-tests, not an independent evaluation.

### 6.2 User survey (TAM)

| Group | Perceived ease of use (mean, 5-point scale) |
|---|---|
| Commuters | 4.39 |
| Drivers | 3.63 |

Only the perceived-ease-of-use results were reported to this audit. The drivers' lower score fits
the driver app's harder steps (registration with photos, Bluetooth and permissions setup).

## 7. Changes made for the final defense (2026-11-19 to 2026-11-22)

1. **LTFRB selfie registration** (driver app, admin, database): replaces the CTTDM ID photo. See 4.1 and 5.
2. **Stops, detours, Track view and ETA:** see 3.1 and 3.3.
3. **Abang, several drivers per multicab:** see 4.1. No "take over this unit" step: after setup the
   driver app has no internet link, so the server cannot know whose beacon is on. The waiting counts
   go by SMS to every driver of the multicab.
4. **Fares:** unchanged, in one config place, waiting for the LTFRB PUJ General Fare Guide.
5. **Driver beacon battery:** lower-power settings prepared but off; battery test procedure written.
6. **Device ban** (commuter accounts): see 3.3.
7. **Admin two-step sign-in and admin action log:** see 5.
8. **Security Advisor fix and 8-character passwords:** see 8.
9. **Small-screen Map tab fix:** see 3.1.

Database: these migrations are applied on the live Supabase project (2026-11-22), each checked with
a query afterwards:

| Migration | What it does |
|---|---|
| `20261119000000_ltfrb_selfie_registration` | LTFRB selfie registration and the five review checks |
| `20261122000000_abang_shared_plate` | Several drivers per multicab |
| `20261122000001_device_ban` | Device ban |
| `20261122000002_admin_mfa` | Admin actions need the second factor |
| `20261122000003_admin_log` | Admin action log |
| `20261122000004_security_advisor` | Closes `rls_auto_enable()` to app users |

The `driver-registration` function is redeployed (2026-11-22). Whether the earlier migrations of
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
- Supabase Security Advisor (2026-11-22): 0 errors. Its warnings are the app's own access-checked
  database functions (by design), and leaked-password protection, which needs a paid plan (passwords
  need 8 characters instead).
- The device ban is a deterrent, not proof: a factory reset, another phone or a rooted phone evades it.
- Automatic strikes can hit an honest rider whose ride was not verified (for example, weak GPS); appeals
  and the admin's Lift are the safety net. Hidden verified rides are never struck automatically.
- Commuter data use measured above the PRD's 150 KB per hour target (6.1); fixed afterwards, not yet
  measured again.
- An authenticator phone is needed to sign in to the console; a backup on a second phone covers a lost
  one, and losing every one needs a reset in the Supabase dashboard.
- Outside this phase on purpose: Play Integrity, Cebuano screens, Play Store release, route updates
  without an app release.

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
