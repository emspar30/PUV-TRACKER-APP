# Tunton: full application audit (commuter app, driver side, admin console, backend)

Audit date: 2026-11-23. Code state: branch `main`, commit `b8366c3` (local; GitHub `main` is at
`45823ff`, one commit behind: only the Moderation page layout differs). Database: all 42 migrations
applied on the live Supabase project and checked with queries.

This file is the complete reference for the AI assistant revising the capstone manuscript. It is
written from the code, the migrations and the test results, not from older documents. Where this
file disagrees with an older document (including `docs/SYSTEM_STATUS_AUDIT.md`, the PRD's early
sections, or an earlier draft of the paper), this file is newer. `docs/PRD.md` holds every decision
with its date (its change log, items 1 to 61); `docs/SCOPE_AND_LIMITS.md` holds the limits.

---

## 0. Rules for using this file in the paper

1. **Status words.** Every feature below has one status:
   - **Phone-checked:** a team member ran it on a phone or emulator and marked it Pass in the build
     tracker. Most such checks used **Demo data** (simulated multicabs), not a real multicab.
   - **Built:** the code exists and its automatic tests pass; not yet seen working on a phone.
   - **Changed (date):** revised recently; the old phone check no longer covers the new behaviour.
   - **Not built / out of scope:** say so plainly.
2. **Measured numbers.** Only section 11 has measured values. Do not invent figures for ETA accuracy
   in seconds, map delay, or position error: none were measured. Describe them as planned.
3. **Evaluation.** The ISO/IEC 25010:2023 evaluation was done by the developers themselves (no IT
   expert was found). State this as a limitation and recommend an independent evaluation.
4. **No AI.** No machine-learning model is used anywhere. The assistant "Tunie" is rule-based
   (keyword and fuzzy matching over a fixed knowledge base) and works offline. Driver verification is
   a human decision: no OCR, no face recognition, no document classification.
5. **Regulator.** Multicabs fall under the **LTFRB**. Older drafts say "CTTDM"; that is wrong now.
6. **Android only.** There is no iOS app.

---

## 1. The system in brief

Tunton is an Android prototype that helps multicab (PUV) commuters in Butuan City see where multicabs
are, how full they are and when they will arrive, using **crowdsourcing**: a rider on board shares
the multicab's position (a **relay**), and the multicab's **Bluetooth beacon** (the driver's phone)
proves the rider is really on it. Drivers need no internet after setup: they receive the number of
people waiting at each stop by **SMS**, sent by a **gateway phone**.

| Part | What it is | Who uses it |
|---|---|---|
| Commuter app (Tunton) | Map, tracking, check-in, relay, Crowdsource feed, trip planner, assistant | Commuters |
| Driver app (Tunton Driver) | Registration, Bluetooth beacon, waiting counts by SMS | Multicab drivers |
| Gateway app (Tunton Gateway) | A phone that sends the queued SMS to drivers | The research team |
| Admin console (web) | Driver registrations, drivers, moderation, settings | The research team (admin) |
| Backend | Supabase: Postgres database with row-level security, Edge Functions, Storage, Auth, Vault | All |
| SMS worker | Node.js service on Render: counts waiting riders per route and queues the SMS | Server |

### 1.1 Technology

| Item | Version or choice |
|---|---|
| Mobile framework | Expo SDK 57, React Native 0.86, React 19.2, TypeScript (strict) |
| Navigation | Expo Router (file-based) |
| Map | MapLibre React Native 11, offline vector tiles of Butuan bundled in the app |
| State | Zustand; on-device storage with expo-sqlite (key-value store) |
| Location and background | expo-location with a location foreground service; expo-task-manager |
| Notifications | expo-notifications (local notifications only; no push server) |
| Camera | expo-camera (driver selfie and plate photo, in-app camera only) |
| Native modules (own) | `tunton-beacon` (Bluetooth advertising and scanning), `tunton-sms` (SMS for driver and gateway), `tunton-motion` (motion sensors) |
| Backend | Supabase (Postgres, RLS, Edge Functions in Deno, Storage, Auth with TOTP MFA, Vault) |
| Admin console | React with Vite, hosted on Render |
| Builds | EAS Build (cloud), APKs for internal distribution |

### 1.2 Data flow (one relay)

1. A rider on a multicab opens **Relay**. The phone hears the multicab's beacon (Bluetooth), checks
   the rider is on that multicab's route, and queues the relay.
2. Once the multicab moves 50 m along the route with the beacon heard, the relay is released and
   posted (to the live map, or to Crowdsource; at night always to Crowdsource).
3. The phone sends its position every 30 s or 100 m to the **ingest** Edge Function, which checks the
   beacon code, the time, the speed and the route, and updates the multicab's live row.
4. Other commuters' maps receive the update through Supabase Realtime and show the multicab marker,
   its seats and ETA.
5. Separately, commuters **check in** at a stop; the SMS worker counts them per stop and route and the
   gateway phone texts each driver of that route the waiting counts.

---

## 2. Commuter app

Bottom tabs: **Map**, **Check-in**, **Relay** (a centre button that opens the Relay form over any
tab), **My Rides**, **Crowdsource**. Other screens: Sign-in, Onboarding (introduction), Location
consent, Menu, Profile, Settings, Notifications, Ask Tunie (assistant), Appeal, About, Licences,
Demo and simulation settings, Field test log.

### 2.1 Map and live multicabs

| Feature | How it works | Status |
|---|---|---|
| Offline map | Butuan streets, routes and stops without internet | Phone-checked |
| Routes and stops | Six routes (R1, R2, R3, R4, R5, R14) with 39 stops | Partial: R14's return leg, six stops and the terminal list are provisional |
| Multicab markers | One marker per multicab, coloured by seats: green (0 to 6 taken), amber (7 to 12), red (13 or more of 16) | Phone-checked (demo) |
| Marker freshness | Live (position under 90 s old), Stale (up to 10 min), No data; **Estimated** markers move by dead reckoning for up to 5 min (at most 40 km/h, 2 km) | Phone-checked |
| All routes view, route list, Locate, zoom | The map remembers the chosen route | Phone-checked |
| Live updates | Realtime pushes; the whole route is re-read every 120 s and at once when the connection comes back | Changed 2026-11-22 (was every 30 s; lowered for data use) |
| Night Mode (9 PM to 5 AM, Manila time) | The map shows **no** multicab. A note says Night Mode and offers "See Crowdsource" | Changed 2026-11-23: the "Where R4 has been" stop list was removed; night relays go to Crowdsource |
| Small screens | Under 700 dp tall, the map buttons rearrange so they do not overlap | Changed 2026-11-22; checked on a tablet set to a small display size |
| Offline banner | Every tab says when it is offline and keeps what it has | Phone-checked |

### 2.2 Tracking one multicab

| Feature | How it works | Status |
|---|---|---|
| Track view | Pick a multicab: ETA, a guide line to it, its status | Phone-checked (demo) |
| ETA rule | Distance along the route divided by the average of its **moving** speeds (2 km/h or more) over the last 5 minutes, plus **30 s per km** for stops, lights and traffic. Holds steady while the multicab is stopped | Changed 2026-11-22. The 30 s per km is a starting value, not measured |
| Status in the Track view | Moving; Stopped · N min; Off route · temporary | Changed 2026-11-22 |
| Short detours | More than 60 m off the route: the marker stays where it left and the ETA says "paused"; allowed up to 300 m and 10 minutes | Changed 2026-11-22 |
| Alerts | 2 minutes away; 1 km, 500 m, 250 m, 100 m; arrived (within 50 m) | Phone-checked in-app (demo) |
| Alerts outside the app | Shown on the lock screen and in the notification shade. While tracking, a background service with a notice ("Tracking a R4 multicab") keeps Tunton running in other apps and with the screen off. Needs location "Allow all the time" | Changed 2026-11-23; not phone-checked |
| Cost | 1 Energy per 30-minute tracking session | Phone-checked |

### 2.3 Check-in (telling drivers someone is waiting)

| Feature | How it works | Status |
|---|---|---|
| Check in where you stand | At a stop (within 40 m) or near a route line (within 40 m); GPS accuracy must be 25 m or better | Phone-checked |
| What is sent | Only the stop code and whether the rider is "near"; never the rider's coordinates | Phone-checked |
| Lifetime | 15 minutes; ends early when the rider walks 70 m away | Phone-checked |
| Cost | 0.3 Energy per route pinged | Phone-checked |
| "Did you board?" | Asked when a live multicab of the route stands at the stop, and 5 minutes into the check-in | Phone-checked in-app |
| "Did you board?" outside the app | The 5-minute one is scheduled with Android at check-in (it comes even if Tunton is closed, and is cancelled if the check-in ends first); a multicab at the stop is notified from other apps while the background service runs | Changed 2026-11-23; not phone-checked |
| Driver receives the count | By SMS through the gateway (section 3.3) | Built; partly tested by the partner |

### 2.4 Relay (crowdsourcing a multicab's position)

| Feature | How it works | Status |
|---|---|---|
| Relay gate | Needs location, the multicab's **verified beacon** (Bluetooth, code checked by the server) and being on that multicab's route | Phone-checked (demo) |
| Queued relay | Posted only once the beacon is heard and the rider has moved 50 m along the route (waits up to 30 min) | Built |
| Live map or Crowdsource | The rider chooses "Show me on the live map". From 9 PM to 5 AM the switch is locked off and the relay goes to Crowdsource (the server enforces this too) | Changed 2026-11-23 |
| Verification window | Once released, the ride is checked: riding speed held, every fix within 30 m of the route, 50 m along it. Passing shows a "Verified ride" badge | Built; thresholds are starting values |
| Relay ends | At the chosen destination (within 50 m, 60 s countdown), by Stop, after 20 minutes in one spot (30 at a terminal), after a detour of more than 300 m or 10 minutes, or at the 3-hour "Still riding?" check | Built; partly phone-checked |
| Background | A location foreground service with a notice keeps the relay going in other apps and with the screen off | Built; phone tests pending |
| Two riders, one multicab | Primary and secondary relays; the secondary takes over after 90 s without the primary | Built; needs a two-phone ride |
| Beacon loss | A released relay continues on GPS; losing the beacon does not end it (that would need a native change, declined) | By design |
| Same multicab | A rider cannot relay the same multicab again within 3 hours | Built |
| Energy earned | +1.0 for a relay on the live map, +0.5 in Crowdsource; at night every relay earns +1.0 | Changed 2026-11-23 |
| Position privacy | Positions are kept 7 days (24 hours at night) for verification, then deleted (see 8.2 about the deletion jobs) | Built |

### 2.5 Crowdsource feed and moderation (rider side)

| Feature | How it works | Status |
|---|---|---|
| Feed | Reports from the last hour: route, multicab, seats, a short status ("Full", "Few seats left", "Not moving", "Heavy traffic", "Loading passengers"), the stop it was sent near, Trusted and Verified badges | Phone-checked |
| Night rules | A report naming a stop waits 2 minutes before others see it; at night only riders who relayed before appear | Built |
| Flag a report | With a reason: Wrong location, Spam, Not a multicab. An account must be 7 days old (or Trusted) to flag; at most 10 flags a day | Phone-checked |
| After flagging | The card **stays**, with a filled red flag and "Flagged" (kept on the phone 24 hours); it cannot be flagged twice | Changed 2026-11-23 |
| Hiding | 3 **weighted** flags hide a report for everyone. A flag counts only from an account at least 48 hours old that does not mostly flag the same author | Built |
| Automatic strike | A hidden report that was **not** a verified ride gives its author a strike automatically. A hidden **verified** ride gives no strike: it waits for the admin (the evidence conflicts). Phone evidence of a fake or impossible location also gives a strike | Changed 2026-11-23 |
| Suspension and ban | 2 strikes within 30 days: suspended 7 days. After a suspension, 2 **new** strikes within 30 days: **permanent ban**. A suspended or banned rider cannot relay, check in or flag, but can still use the map, routes and fares | Changed 2026-11-23 |
| Merit shields | 1 per 100 trust points, at most 3; a shield takes a strike instead | Built |
| Notices | The rider is told when their report is flagged (with the reason, never who flagged), when they get a strike, are suspended, banned or lifted, and when an appeal is decided | Changed 2026-11-23 (in-app; shown when the app is next opened) |
| Appeal | From Profile, within 30 days of a strike, once per strike, up to 500 characters | Built |
| Trust Level | Share of the rider's recent reports never hidden or struck (shown after 10 reports) | Built |
| Device ban | A suspension or ban also covers every account used on the same phone. Only a keyed HMAC-SHA256 of the Android ID is stored (key in Supabase Vault) | Built 2026-11-22; evaded by a factory reset, another phone or a rooted phone |

### 2.6 My Rides, assistant, account

| Feature | How it works | Status |
|---|---|---|
| Trip planner | Routes that serve a trip, walking directions to and from stops (at most 500 m per walk), ranked by time | Phone-checked |
| Fare estimate | ₱14.00 for the first 4 km, ₱2.00 per further km; 20% discount for student, senior and PWD | Phone-checked; an **estimate** until the LTFRB fare guide is received |
| Ask Tunie | Rule-based assistant in English and Bisaya phrases, offline: routes, fares, stops, safety tips | Phone-checked; Bisaya phrases not yet checked by a Butuan speaker |
| Account | Email sign-in (password at least 8 characters), username, avatar (16 presets), badges | Phone-checked |
| Energy wallet | Starts at 5, at most 5, +1 every 12 hours (at most 2 a day), history | Phone-checked |
| Location consent | Shown before any location use; mock locations are refused | Phone-checked; text awaits the Data Protection Officer's review |
| Delete account | Deletes the account and its posts, check-ins, flags and Energy history | Phone-checked |
| Give feedback | Link to the survey form | Built; hidden until the form link is set |

---

## 3. Driver side

### 3.1 Driver app (Tunton Driver)

| Feature | How it works | Status |
|---|---|---|
| Self-registration | Mobile number (confirmed by a 6-digit SMS code), plate, route, full name as on the LTFRB document, document type (Driver's Academy ID, the old LTFRB ID; or Driver's Academy certificate, LTFRB), a **selfie holding the document** (in-app camera only, front camera first, time recorded) and a **plate photo**; consent citing R.A. 10173 | Built 2026-11-19; the earlier form was phone-checked by the partner |
| Waiting for approval | The app checks the status every 60 s; after approval it collects its setup once (within 7 days) | Phone-checked by the partner (old form) |
| Beacon | Bluetooth advertising with a code that changes every 60 s, signed with the multicab's secret, checked by the server | Phone-checked (partner) |
| Screen-off beacon | The code keeps changing with the screen off | Compiled in the Nov 22 driver APK; not phone-checked |
| Waiting counts | Received by SMS per stop of the route; **no internet needed after setup** | Built; partner device tests partly run |
| Several drivers per multicab ("abang") | 2 or 3 drivers, each with their own driver ID (DRV-0000) and phone, share the multicab's beacon secret, so it shows as one multicab; each gets the waiting counts | Built 2026-11-22 |
| Removed by the admin | The phone gets a signed SMS and says "This phone was removed" | Built and tested by the partner |
| Admin screen | Protected by the admin PIN (6 digits) set in the console | Built |
| Beacon power | About every 250 ms at medium power; lower-power settings exist but are off until a battery and detection retest | By decision |

### 3.2 Gateway app (Tunton Gateway)

A team phone that pulls queued SMS from the server every 10 s and sends them, reporting delivery.
Daily cap 100 SMS per SIM (a placeholder until the real promo limit is confirmed). Status: Built; one
delivery test passed (Globe to TNT in 15 to 41 s).

### 3.3 SMS worker (server)

Every 30 s it counts active check-ins per stop and route; it texts a route's drivers when a count
changes by 2 or more, or every 5 minutes while any count is above zero, never more often than every
120 s per phone. Status: Tested (partner, DR6). Runs on Render.

---

## 4. Admin console (web)

Sign-in, then a 6-digit code from an authenticator app. Side menu: **Registrations**, **Drivers**,
**Moderation**, **Settings**. Every confirmation uses the console's own dialog.

| Page or feature | How it works | Status |
|---|---|---|
| Two-step sign-in | Password plus an authenticator-app code (TOTP). The database refuses every admin action without the second factor (`is_admin()` requires the session's aal2 level) | Built, applied, checked by the owner (2026-11-22) |
| Backup authenticators | Up to 3 phones in all; the last one cannot be removed | Built 2026-11-22 (web); not checked |
| Idle sign-out | After 20 minutes without activity; the sign-in page says why | Built 2026-11-22 (web); not checked |
| Registrations | Pending registrations with the selfie and document, the plate photo with the typed plate, the typed name and details. **Approve** (sends the driver one SMS) or **Reject** with a typed reason the driver sees. Photos are deleted right after the decision | Changed 2026-11-23: the five Pass/Fail checks of Nov 19 were removed (a plain Approve or Reject) |
| How the admin verifies | By eye: the face matches the selfie's document, the name matches, the plate photo matches the typed plate; the LTFRB driver list is checked outside the console and never imported or stored (promised to the LTFRB in writing) | By design |
| Drivers | Active driver phones by route and plate, "Also on this plate" for abang drivers, View details, **Retire** (stops the phone; replaces the beacon secret when no other driver of the multicab remains) | Built |
| Moderation | Tabs **Flagged reports**, **Appeals**, **Suspended and banned**, each a table with counts. **View** on a report shows its evidence: verified ride, beacon check, GPS, phone evidence, flags (counted out of total), reasons, flaggers' notes, the author's strikes, and a hint (Likely real, Likely false, Mixed). The admin **Confirms** (gives a strike) or **Dismisses** (shows the report again and lifts its strike) mainly for hidden verified rides ("Needs you"); **Upholds** or **Denies** appeals; may **Lift** a suspension or ban to fix a mistake. **No manual suspend or ban**: those come only from the rules | Built 2026-11-23 (web); applied; not yet exercised with real flags |
| Settings | Admin PIN for the driver phones; Two-step sign-in (authenticators); **Admin activity** log | Built |
| Admin activity log | Every approval, rejection, retired phone, PIN change and moderation action (automatic ones as "System"), with who and when; written by the database, cannot be edited | Built 2026-11-22 and 23; applied |

---

## 5. Backend and security model

### 5.1 Database (Supabase Postgres)

Main tables, by area:

| Area | Tables |
|---|---|
| Accounts and settings | `profiles`, `app_config`, `team_accounts`, `admin_accounts`, `account_devices` (device fingerprints, HMAC only) |
| Map and relays | `vehicles`, `vehicle_beacons`, `telemetry_latest`, `telemetry_raw`, `telemetry_ingest_log`, `relay_sessions`, `node_events`, `off_route_days`, `route_alternatives`, `beacon_verify_calls` |
| Check-ins and Energy | `checkins`, `energy_ledger` |
| Crowdsource and moderation | `feed_posts`, `feed_flags`, `feed_review_queue`, `strikes`, `appeals`, `risk_events`, `moderation_notices`, `moderation_log`, `account_review_queue` |
| Driver side | `driver_registrations`, `registration_checks`, `driver_devices`, `driver_settings`, `gateways`, `sms_outbox`, `sms_dispatch_state`, `ops_alerts` |
| Admin | `admin_log` |

### 5.2 Security measures

| Measure | Detail |
|---|---|
| Row-level security | On every table. Client roles get no table grants except a few read-only ones; every write goes through a checked database function |
| Database functions | `security definer` with an empty search path; each one revoked from anonymous users; admin functions check `is_admin()` (admin account plus two-step sign-in) |
| Secrets | Beacon secrets, SMS keys and the device-fingerprint key are kept in Supabase Vault, never in a table |
| Beacon codes | Change every 60 s, signed (HMAC) with the multicab's secret; the server checks each one (rate-limited: 30 checks a minute) |
| Positions | The ingest function rejects stale (over 120 s), future, impossible-speed (over 200 km/h) and off-route packets; mock locations are refused on the phone |
| Admin | Two-step sign-in, backup authenticators, idle sign-out, an action log nobody can edit |
| Device ban | Suspensions and bans follow the phone (HMAC of the Android ID) |
| Passwords | At least 8 characters |
| Supabase Security Advisor (2026-11-22) | 0 errors. Remaining warnings: the app's own access-checked functions (by design) and leaked-password protection, which needs a paid Supabase plan |
| Automated checks | A migration test forbids storing email, phone, rider category, gender or destination in commuter tables, forbids destructive statements, and checks every grant |

### 5.3 Edge Functions

| Function | Purpose |
|---|---|
| `ingest` | Receives relay positions; checks the beacon code, age, speed and route; updates the live row; records stop passages and risk events |
| `driver-registration` | Driver sign-up: SMS code, photo upload, status, collecting the setup after approval |

---

## 6. Privacy (R.A. 10173, Data Privacy Act)

| Data | Kept? |
|---|---|
| Rider's email | Only in Supabase Auth (for sign-in); never in app tables |
| Rider's classification (student, senior, PWD), gender, destination | **Never stored** on the server; the fare discount and destination stay on the phone |
| Check-in | Only the stop code and a "near" flag; deleted after it expires (15 min) |
| Relay positions | Kept 7 days (24 hours at night) for verification, then deleted (see 8.2) |
| Crowdsource report | Preset words only (no free text), route, multicab, nearest stop code; shown for 1 hour |
| Flag notes | Up to 200 characters, seen only by the admin |
| Phone identity | Only a keyed HMAC of the Android ID, for the device ban |
| Driver | Phone number, plate, route; the full name only until the phone is retired or the registration rejected; **photos deleted at the decision**; nothing from the LTFRB list |
| Moderation console | Shows usernames only; no location, destination or contact details |
| Notifications | Made on the phone; no push token is collected |

---

## 7. Key rules and their values (all in `src/shared/config/index.ts` and `supabase/functions/_shared/serverConfig.ts`)

| Rule | Value |
|---|---|
| Relay position sent | Every 30 s or 100 m |
| Live / Stale / Estimated | Live under 90 s; Stale up to 10 min; dead reckoning up to 5 min |
| Seats colour (16 seats) | Green 0 to 6 taken, amber 7 to 12, red 13 or more |
| ETA | Moving speeds (2 km/h or more) over 5 min, plus 30 s per km |
| Track alerts | 2 min; 1 km, 500 m, 250 m, 100 m; arrived within 50 m |
| Check-in | Within 40 m of a stop or route line; 15 min; reminder at 5 min; GPS accuracy 25 m |
| Relay GPS accuracy | 30 m or better |
| Relay queue | Released after 50 m along the route with the beacon; waits up to 30 min |
| Relay ends | Destination 50 m (60 s countdown); 20 min idle (30 at a terminal); detour over 300 m or 10 min; 3-hour check |
| Verification window | 30 to 90 s; fixes within 30 m of the route; 50 m along it |
| Night Mode | 21:00 to 04:59 Asia/Manila |
| Energy | Start 5, cap 5; +1 per 12 h (2 a day); tracking −1 per 30 min; check-in −0.3 per route; relay +1.0 live or night, +0.5 Crowdsource |
| Feed | 1 hour; 3 weighted flags hide |
| Moderation | Flag: account 7 days old, weight after 48 h, 10 a day; strike lasts 60 days; 2 strikes in 30 days: 7-day suspension; after a suspension 2 new strikes: ban; appeal within 30 days |
| Fares | ₱14.00 for 4 km, ₱2.00 per km after; 20% discount |
| SMS | Worker every 30 s; text on a change of 2 or every 5 min; at least 120 s apart; 100 a day per gateway SIM |
| Admin | Idle sign-out 20 min; up to 3 authenticators; PIN 6 digits |

---

## 8. Known limits (state them in the paper)

### 8.1 Function limits

- A multicab appears on the live map only while a rider relays it; at night, never (Crowdsource only).
- A relay is not ended by losing the beacon after release; it ends by destination, Stop, idle,
  detour limits or the 3-hour check.
- Verification thresholds, the ETA's 30 s per km and the beacon signal margins are starting values,
  not tuned in the field.
- Route data is partly provisional (R14's return leg, six stops, terminals).
- Fares are estimates until checked against the official LTFRB fare guide.
- Driver verification is by eye; the LTFRB list check happens outside the app, so the app holds no
  record of it.
- Abang drivers share one beacon secret: a lost phone retired while another driver is active stays
  valid until the retire SMS reaches it.
- Every driver of a multicab receives the waiting counts, which counts against the SMS cap.
- Automatic strikes can hit an honest rider whose ride was not verified (for example, weak GPS);
  appeals and the admin's Lift are the safety net.
- The device ban is evaded by a factory reset, another phone or a rooted phone; two people sharing
  one phone share a ban.
- Background alerts need location "Allow all the time"; without it they come only while the app is
  open. Alerts that start on the server (moderation notices, Energy refill) show when the app is next
  opened: there is no server push. A phone that is switched off gets nothing.
- Some phone brands (Xiaomi, Vivo and others) stop background apps; the app shows a guide when it
  detects this.
- The consent texts (location, driver selfie and name) await the Data Protection Officer's review.
- Tunie's Bisaya phrases need a check by a Butuan speaker.
- Leaked-password protection needs a paid Supabase plan.

### 8.2 Open technical point (found in this audit)

The data-deletion jobs (`supabase/cron/retention.sql`: check-ins, feed posts after 1 hour, flags after
30 days, raw positions after 7 days, SMS queue after 7 days) are written but run only once the
`pg_cron` extension is enabled and the file is run in the SQL Editor. **Whether they are running on
the live project is not confirmed.** If they are, a Crowdsource report is deleted 1 hour after posting,
so a flagged report leaves the admin's Moderation list after an hour (its strike remains). Until this
is settled, do not claim that positions are deleted after 7 days as a verified fact; say "scheduled".

### 8.3 Out of scope on purpose

Play Integrity, iOS, Cebuano screens, a Play Store release, route updates without an app release,
server push notifications, AI or computer vision.

---

## 9. Changes for the final defense (2026-11-19 to 2026-11-23)

| Date | Change | Part |
|---|---|---|
| Nov 19 | LTFRB selfie registration (replaces the CTTDM ID photo) | Driver, admin, database |
| Nov 22 | ETA with stop allowance; short detours; Track view status | Commuter |
| Nov 22 | Abang: 2 or 3 drivers per multicab | Driver, admin, database |
| Nov 22 | Device ban; admin two-step sign-in; admin action log; Security Advisor fix; 8-character passwords | All |
| Nov 22 | Small-screen Map fix; lower data use (re-read every 120 s, Check-in reads only on screen) | Commuter |
| Nov 22 | Backup authenticators; idle sign-out | Admin |
| Nov 23 | Automatic moderation: flag notices, automatic strikes, permanent ban; Moderation page (rules only, no manual suspend), laid out like Drivers | Commuter, admin, database |
| Nov 23 | Flagged report keeps a red flag instead of disappearing; moderation notices in the app | Commuter |
| Nov 23 | Night relays go to Crowdsource (+1.0 Energy); "Where R4 has been" removed | Commuter, database |
| Nov 23 | Plain Approve or Reject for driver registrations; the console's own confirmation dialog | Admin, database |
| Nov 23 | Ride alerts from other apps and with the screen off (background service; scheduled "Did you board?") | Commuter |

Builds: commuter APK built 2026-11-23 from `45823ff` (has everything above except the Moderation
page layout, which is web only); driver APK built 2026-11-22 from `bd1345c` (no driver change since);
admin console runs from the latest code locally and from GitHub on Render.

---

## 10. Quality checks (2026-11-23, commit `b8366c3`)

| Check | Result |
|---|---|
| Automated tests (`npx jest`) | 143 suites, 1,960 tests, all passing |
| Type check (`npx tsc --noEmit`, strict) | No errors |
| Lint (`npx expo lint`) | No errors or warnings |
| Admin console build | Builds |
| EAS builds | Commuter and driver APKs build without errors |
| Database | 42 migrations applied; the newest checked with queries |

---

## 11. Evaluation results so far

### 11.1 ISO/IEC 25010:2023 self-test (team-run, 2026-11-22)

Test plan of 46 steps over the 9 characteristics, run by the developers with recorded evidence.

| Steps | Result |
|---|---|
| 1, 4 to 13, 15 to 18, 20 to 22, 28 to 32, 37, 40, 43 to 46 | Pass (37: tests, lint and type check on the final commit, re-run 2026-11-23) |
| 14 | N/A (driver app storage 267 MB) |
| 41 | Fail (crowded Map on a small phone); fixed afterwards, not re-tested on a small phone |
| 23 to 27, 33 to 36, 38, 39 | Not tested yet |
| 2, 3, 19, 42 | Result not reported to this audit |

Caveats: step 25 expects a relay to end when the beacon is lost, which the app does not do by design;
its expected result must be corrected. Step 13 (data use) is marked Pass but its value was above the
target (below).

| Measure | Value | Note |
|---|---|---|
| Driver phone battery, beacon on | 3 to 5% per 30 min | The beacon adds about 1 to 2% per 30 min |
| Driver phone battery, beacon off | 2 to 3% per 30 min | |
| Commuter phone battery | 0.21% (as recorded) | Looks too low; to be measured again |
| Commuter data use | 425.5 KB per hour | Above the 150 KB per hour target. The cause (frequent re-reads) was fixed on 2026-11-22; to be measured again with the new APK |
| SMS delay, check-in to driver | About 1 minute | |
| Phone brands | Works on Xiaomi, Vivo, Honor, plus a Samsung phone and tablet | |

### 11.2 User survey (TAM)

| Group | Perceived ease of use (mean, 5-point scale) |
|---|---|
| Commuters | 4.39 |
| Drivers | 3.63 |

Only perceived ease of use was reported to this audit. The System Usability Scale and the IT-expert
part were left out of the paper (decision of 2026-11-19).

### 11.3 Field tests

- One informal ride on a real multicab: the marker was right; arrival was late because of stops,
  lights and traffic; the multicab once left its route (a gas station). The ETA and detour changes of
  2026-11-22 answer this; not re-tested.
- Field experiments E1 to E9 (battery, data, background survival, Bluetooth inside a multicab,
  beacons side by side, verification): tools built (the in-app Field test log exports CSV;
  procedures in `docs/FIELD_TESTS.md`); no recorded results beyond 11.1.
- Not measured: ETA error in seconds, map delay (target under 5 s), position error (target median
  50 m or less).

---

## 12. Glossary

| Term | Meaning |
|---|---|
| Multicab | The small public utility vehicle (PUV) of Butuan routes; 16 seats assumed |
| Relay | A rider on board sharing the multicab's position and seats |
| Beacon | The driver's phone advertising a signed Bluetooth code that proves a multicab is near |
| Check-in | A commuter telling drivers they are waiting at a stop |
| Crowdsource | The feed of short reports from riders, shown for one hour |
| Live map | The map showing multicabs from relays in real time (by day) |
| Night Mode | 9 PM to 5 AM: no multicab on the map; relays go to Crowdsource |
| Energy | In-app points spent on tracking and check-ins, earned by relaying |
| Trust points, Trusted badge | Points for check-ins and relays nobody flagged; 5 give the Trusted badge |
| Merit shield | Earned from trust points; takes a strike instead |
| Strike, suspension, ban | Moderation penalties (section 2.5) |
| Abang | A multicab shared by 2 or 3 drivers in turns |
| Gateway | The team phone that sends the drivers' SMS |
| Tunie | The rule-based in-app assistant |

---

## 13. Where the evidence is

| What | Where |
|---|---|
| Every decision with its date | `docs/PRD.md` (change log at the end, items 1 to 61) |
| Limits | `docs/SCOPE_AND_LIMITS.md` |
| Earlier status audit | `docs/SYSTEM_STATUS_AUDIT.md` |
| Proposal-to-build traceability | `docs/PROPOSAL_TRACEABILITY.md` |
| Admin console guide | `admin/README.md` |
| Field test procedures | `docs/FIELD_TESTS.md`; survey draft `docs/TESTER_SURVEY.md` |
| All thresholds | `src/shared/config/index.ts`, `supabase/functions/_shared/serverConfig.ts` |
| Database rules | `supabase/migrations/` (42 files) |
| Phone test checklists and results | The build tracker (private claude.ai page) |
