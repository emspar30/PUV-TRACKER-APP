# Tunton: scope and limits of the prototype

For evaluators and testers. It says what the prototype does, what is planned and not built yet, what is outside this phase, and the known limits, with the reason for each. The full requirements are in `docs/PRD.md`; section 0.6 sets the scope.

Updated 2026-11-22.

## 1. What is built

Tunton is an Android app for multicab commuters in Butuan City, with a driver app, an SMS gateway app and a small web console.

**Commuter app**
- **Map:** the routes R1 to R5 and R14 with their stops, an offline map of Butuan, and live multicabs relayed by riders.
- **Tracking:** follow one multicab, with its arrival time and distance alerts.
- **Check-in:** where the commuter stands: at a stop (within 40 m), or near the route between stops (within 40 m of the line, counted near the nearest stop). Drivers on that route are told by SMS how many people are waiting.
- **Relay:**
  - A rider on a multicab shares its position and seats.
  - The phone first checks the location, the multicab's Bluetooth beacon and the route.
  - The relay is held on the phone and sent once the multicab moves off with the rider, so two multicabs parked side by side do not confuse it (the Smart Queue).
  - The relay is verified on the move: speed (or the phone's in-vehicle signal), the route line and distance travelled. A verified relay is marked so.
  - With two riders on one multicab, one sends the position and the other takes over after 90 s of silence.
  - It keeps running in the background with a notification, and says "Get ready to get off" 300 m before the rider's stop.
- **My Rides:** a trip planner with the walk to and from the route, and a fare estimate with the student, senior and PWD discount.
- **Crowdsource:** reports from the last hour, with flags. Moderation weighs flags by trust, gives strikes and 7-day suspensions, and takes appeals.
- **Detours:** a known detour, once an admin turns it on, is drawn dashed and still counts as on the route.
- **Ask Tunie:** an assistant that answers on the phone with no AI model, online or offline.
  - It answers trips, fares and the nearest stop, in English or Bisaya.
  - A commuter guide covers how to ride, with the Bisaya to say. It is meant for visitors and first-time riders.
- **Other:**
  - The Energy wallet, which limits tracking and check-ins.
  - Night Mode from 9 PM to 5 AM.
  - An offline banner within about a second of losing the network, and offline notes.
  - Notifications inside the app.
  - Settings, an introduction, a tips tour, account deletion. Another account signing in on the same phone starts clean.
  - A Demo data mode that simulates multicabs, and a field test log.

**Driver side** (the partner's work)
- **Driver app:** a Bluetooth beacon, and the waiting counts per stop, received by SMS.
- **Gateway app:** sends the SMS.
- **SMS worker on Render.**
- **Self-registration with admin approval,** and the web admin console. The driver gives the full name and a selfie holding an LTFRB document (Driver's Academy ID or certificate) plus a multicab photo; the admin marks five checks and the photos are deleted at the decision.

**Quality checks**
- 131 automated test suites and 1,796 tests, run before every change.
- Lint and a strict TypeScript typecheck, run before every change.
- Database rules: clients never write a table directly, every table has row-level security, and the location history is deleted on a schedule.

## 2. Built, waiting on field tests

Every step of the approved plan (`docs/IMPLEMENTATION_PLAN_PRD_GAPS.md`) is built. These need phones, a multicab and several days, so they are tested in the field rounds.

| Feature | What the field test checks |
|---|---|
| V1a, verification window | That real rides pass and walking or other vehicles do not |
| V1b, in-vehicle detection | That the phone's activity signal helps in slow traffic (D6) |
| BT1, primary and secondary riders | Two riders on one multicab, the take-over after 90 s |
| MOD1, moderation | Flags, strikes and appeals with real testers |
| DT1, detours | Needs the traced detour lines (D8) |
| S10, field experiments E1 to E9 | Battery, data use, background survival on several phone brands, Bluetooth signal inside a multicab, beacons side by side at a terminal |

## 3. Outside this phase

These are excluded on purpose (PRD 0.6).

| Item | Reason |
|---|---|
| Play Integrity and device fingerprint | A suspension binds to the account instead (D7). Device checks need Play Store distribution |
| Cebuano screens | All text is in one file, ready to translate. Tunie already understands Bisaya questions and gives Bisaya phrases |
| Play Store release | The pilot uses an installable APK |
| Route updates without an app release | A new route data version ships with the app |

Two earlier items were replaced by later steps, not dropped. The old Energy earning rule became RL2b, and the Smart Queue became part of the queued relay (RL2c).

## 4. Known limits

- **Live multicabs need riders.** A multicab shows on the live map only while a rider relays it, so it may be missing when nobody does. Demo data shows the feature anywhere.
- **The live map is limited to team accounts for now.** Other accounts' relays go to Crowdsource (PRD 0.7).
- **Verification thresholds are starting values.** The speed, distance and Bluetooth signal values come from the PRD and are tuned in the field tests.
- **Two beacons when the Relay form opens** keep it greyed out until one multicab's signal clearly leads. Inside a multicab its own beacon should lead; the field test at a terminal (E2) checks it.
- **Route data is partly provisional.** The R14 return leg, six stops and the terminal list are still being traced.
- **Fares are estimates.** The fare is ₱14.00 for the first 4 km and ₱2.00 per further km, with 20% off for students, seniors and PWD. It must be confirmed against the official fare order.
- **Notifications stay inside the app.** Nothing reaches the phone's notification shade, except the relay's background notice.
- **The location consent text** awaits the Data Protection Officer's review.
- **Tunie's Bisaya phrases** come from general Cebuano and commuter guides. They still need a check by a Butuan speaker.
- **Driver verification is by eye.** The admin compares the selfie, the document and the plate; there is no OCR or face matching. The LTFRB list is checked outside the app and never stored, so the app cannot show that check's evidence.
- **Abang drivers share one beacon secret.** Retiring a lost phone while another driver of the multicab is active keeps the secret, so the lost phone's beacon stays valid until the retire text reaches it (which stops its beacon) or the last driver of that multicab is retired.
- **No "take over this unit" step, and the SMS goes to every driver of a multicab.** After setup the driver app has no internet link, so the server cannot know which driver is on. Each abang driver gets the waiting counts, which counts against the gateway's daily SMS cap.
- **A relay does not follow the beacon during the ride.** The phone listens for the multicab's beacon only while the Relay panel is open. So a relay is not ended when the beacon is lost; it ends at the destination, by Stop, after a detour that goes too far or too long (300 m, 10 minutes), after 20 minutes in one spot, or at the 3-hour check. Following the beacon for the whole ride needs a native change and a new app build.
- **The ETA's stop allowance is a guess.** 30 s per km for stops, lights and traffic is a starting value; the field test log's ETA error will tell if it is right.
- **The selfie's readability is not confirmed on budget phones.** The front camera is used first; on a phone whose front camera cannot make the name readable, the driver switches to the back camera and someone else takes the photo.

## 5. How it was tested

- **Automated:** unit, flow and migration tests (`npx jest`), lint (`npx expo lint`) and the typecheck (`npx tsc --noEmit`), run before every commit.
- **On phones:**
  - Each feature has a test checklist in the build tracker.
  - Most commuter features are checked on a phone or the emulator with Demo data.
  - Bluetooth, background and field features wait for the phone test round with testers.
  - The driver side was tested end to end on phones by the partner (DRG6, DR5, DR7).
- **Testers:** `docs/TESTER_GUIDE.md` lists the tasks, and `docs/TESTER_SURVEY.md` holds the survey. The survey covers the System Usability Scale and ISO/IEC 25010 quality ratings for the IT experts.
