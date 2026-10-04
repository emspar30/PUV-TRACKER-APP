# Tunton plan, simple version

The full plan is `docs/IMPLEMENTATION_PLAN_MASTER.md`. This page is only a reading aid.

## Already working
- Offline map, routes R3, R4, R5
- My Ride (trip and fare, with placeholder stops and fares)
- Street labels (built, not yet checked by eye)
- Onboarding, Settings, Licences
- Demo vehicles on the Live tab

## Steps, in order

| # | Step | What it is | Waiting for |
|---|------|-----------|-------------|
| 1 | SB1 | Database (written, not applied) | You: "Supabase is ready" |
| 2 | SB2 | Sign-in, username, Energy | Step 1 |
| 3 | C1 | Check-in saved online, with counts per station | Step 1 |
| 4 | L1 | Real vehicles on Live | Step 1 |
| 5 | L2 | Track one vehicle, with ETA | Step 4 |
| 6 | RP1 | Report button | Step 2 |
| 7 | N1 | Feed of reports | Step 2 |
| 8 | G0 | Consent screen and "Use my location" | Your "start G0" |
| 9 | F2, F3, F5 | Profile, suggestions, badges | Steps 1 and 2 |

**Not now:** BLE, driver app, SMS, background tracking.

## What I need from you

**Answers (4):**
1. Move G0 after RP1? Reports and check-in would work "without GPS" first. (My advice: yes.)
2. May the delete-account function also delete the sign-in account?
3. Can any signed-in user see the live map, or only team accounts?
4. At night, hide only moving vehicles (as built), or all?

**Routes:**
- Decide the R4 trim (backlog 82).
- Confirm the loops marked CONFIRM (backlog 83).
- Send per-direction files, or a cycle file with its turnaround.
- Then write "write routes".

**Supabase:**
- Create the project and fill in `.env`.
- Create two test accounts.
- Say "Supabase is ready".
- Enable `pg_cron` yourself when I ask.

**Data to gather later:** real stops, landmarks, fare order, vehicle list.

## Safe rules
- Nothing is pushed.
- Nothing runs on Supabase without your yes.
- Don't use the app outdoors or share it until G0 is done.
