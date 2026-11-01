# Tunton: scope and limits of the prototype

For evaluators and testers. It says what the prototype does, what is planned and not built yet, what is outside this phase, and the known limits, with the reason for each. The full requirements are in `docs/PRD.md`; section 0.6 sets the scope.

Updated 2026-11-02.

## 1. What is built

Tunton is an Android app for multicab commuters in Butuan City, with a driver app, an SMS gateway app and a small web console.

**Commuter app**
- **Map:** the routes R1 to R5 and R14 with their stops, an offline map of Butuan, and live multicabs relayed by riders.
- **Tracking:** follow one multicab, with its arrival time and distance alerts.
- **Check-in:** at a stop (within 300 m), or near the route between stops (within 40 m of the line). Drivers on that route are told by SMS how many people are waiting.
- **Relay:**
  - A rider on a multicab shares its position and seats.
  - The phone first checks the location, the multicab's Bluetooth beacon and the route.
  - The relay is held on the phone and sent once the multicab moves off with the rider.
  - It keeps running in the background with a notification.
- **My Rides:** a trip planner with the walk to and from the route, and a fare estimate with the student, senior and PWD discount.
- **Crowdsource:** reports from the last hour, with flags; a report with 3 flags is hidden.
- **Ask Tunie:** an assistant that answers on the phone with no AI model, online or offline.
  - It answers trips, fares and the nearest stop, in English or Bisaya.
  - A commuter guide covers how to ride, with the Bisaya to say. It is meant for visitors and first-time riders.
- **Other:**
  - The Energy wallet, which limits tracking and check-ins.
  - Night Mode from 9 PM to 5 AM.
  - An offline banner and offline notes.
  - Notifications inside the app.
  - Settings, an introduction, a tips tour, account deletion.
  - A Demo data mode that simulates multicabs.

**Driver side** (the partner's work)
- **Driver app:** a Bluetooth beacon, and the waiting counts per stop, received by SMS.
- **Gateway app:** sends the SMS.
- **SMS worker on Render.**
- **Self-registration with admin approval,** and the web admin console.

**Quality checks**
- 123 automated test suites and 1,721 tests, run before every change.
- Lint and a strict TypeScript typecheck, run before every change.
- Database rules: clients never write a table directly, every table has row-level security, and the location history is deleted on a schedule.

## 2. Planned, not built yet

These are in the approved plan (`docs/IMPLEMENTATION_PLAN_PRD_GAPS.md`). Each waits on something.

| Feature | What it adds | Why it is not built yet |
|---|---|---|
| V1a, verification window | A relay counts as verified only after the multicab moves (25 km/h for 20 s), stays within 30 m of the route and travels 50 m | It changes how every relay is posted, so it comes after the first test round. Until then relays are marked "unverified" in the app |
| BT1, primary and secondary riders | One rider per multicab sends the position; the next takes over after 90 s of silence | Needs V1a, and two riders on the same multicab to test |
| MOD1, moderation | Trust levels, strikes, suspensions and in-app appeals | Strikes need verified evidence, so it follows V1a (decision D4). Flags and hiding already work |
| DT1, detours | Rides on a known detour, drawn dashed | Needs the traced detour lines (D8) |
| V1b, in-vehicle detection | The phone's activity signal when speed alone fails in traffic | Only if field rides show it is needed (D6); it adds a Google Play services dependency |
| S10, field experiments | Battery, data use, background survival on several phone brands, Bluetooth signal inside a multicab | Needs phones and a real multicab over several days |

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
- **Relays are unverified until V1a.**
- **Route data is partly provisional.** The R14 return leg, six stops and the terminal list are still being traced.
- **Fares are estimates.** The fare is ₱14.00 for the first 4 km and ₱2.00 per further km, with 20% off for students, seniors and PWD. It must be confirmed against the official fare order.
- **Notifications stay inside the app.** Nothing reaches the phone's notification shade, except the relay's background notice.
- **The location consent text** awaits the Data Protection Officer's review.
- **Tunie's Bisaya phrases** come from general Cebuano and commuter guides. They still need a check by a Butuan speaker.

## 5. How it was tested

- **Automated:** unit, flow and migration tests (`npx jest`), lint (`npx expo lint`) and the typecheck (`npx tsc --noEmit`), run before every commit.
- **On phones:**
  - Each feature has a test checklist in the build tracker.
  - 12 features are checked on a device.
  - The rest wait for the phone test round with testers.
  - The driver side was tested end to end on phones by the partner (DRG6, DR5, DR7).
- **Testers:** `docs/TESTER_GUIDE.md` lists the tasks, and `docs/TESTER_SURVEY.md` holds the survey. The survey covers the System Usability Scale and ISO/IEC 25010 quality ratings for the IT experts.
