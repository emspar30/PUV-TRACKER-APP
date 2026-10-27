# Implementation plan: driver self-registration with admin approval

- **Date:** 2026-10-27.
- **Base:** `main` at `7051bdd` (the PRD change).
- **Source:** PRD 9.5 "Driver registration and approval" and change 20.
- **Scope:**
  - In: registration in the driver app, the number check by SMS, the photo upload, the admin console (review, approve, reject, drivers list, retire), and the one-time setup download.
  - Out: the rest of the admin console (routes, moderation, analytics), SMS delivery of the setup, and the release builds for the pilot (batched later with backlog 126).
- **Rules (unchanged):**
  - Pure logic goes in `src/shared`, with fixture tests.
  - Every threshold goes in `src/shared/config`.
  - Strings go only in `src/strings/en.ts`.
  - One local commit per approved step, and no push unless you ask.
  - Ask before any new dependency, EAS build or Supabase command.
- **Test labels:** U unit (jest), L live Supabase, P one phone, W web browser.
- **Size:** S is under a day, M is 1 to 3 days, L is more than 3 days of agent work.
- **Change in DRG3:** one Edge Function, `driver-registration`, serves all five actions (the plan named two, `driver-register` and `driver-setup`; both would use the same service role and the same open entry, so splitting them added only a second deploy).

## 1. How it fits what exists

| Piece | Exists now | Reused or changed |
| --- | --- | --- |
| Setup package | The QR's `TPV1.` payload (`src/shared/driver/provisioning.ts`) with plate, route, beacon secret, SMS key, gateway numbers and admin PIN hash | **Reused as is.** The download returns the same payload, and the app's existing setup code takes it from there, as if a QR had been scanned |
| Creating a driver phone | `admin_provision_driver` and `admin_retire_device` in the database, called by the scripts | **Reused.** The server calls them when the driver collects the setup |
| SMS out | `sms_outbox`, pulled by the gateway through the worker | **Changed:** a row can go to a phone that is not a driver phone yet (the number check and the "approved" text) |
| SMS in | The driver app stores every data SMS on its port and texts starting `HM2\|` | **Reused:** the number check arrives the same way, so no native change |
| Driver app setup screens | QR scan, permissions, text messages, beacon on | Registration screens go in front, and the QR stays as "Use a setup code" for development |
| Admin console | None | **New:** a small web app |

**One detail differs from the PRD's wording.** The PRD says the server makes the setup "on approval". In practice the secrets are made at the moment the driver collects the setup, so no secret waits in storage. Approval only marks the registration approved. Drivers and admins see no difference.

**No new native code** is planned for the driver app. Testing uses the installed `development-driver` build. If that build turns out too old for today's code, it costs one EAS build (#12), asked first.

## 2. Decisions (owner, 2026-10-27)

All recommendations were accepted, except D4 (one admin account). The PRD was updated to match.

| # | Question | Decided |
| --- | --- | --- |
| D1 | When are the photos deleted? | **At the decision** (approve or reject), keeping a text record of who decided, when, and the outcome |
| D2 | Where does the install token live on the phone? | **The app's private storage** (as the driver app's other data). The token works only once and only after approval, so the Keystore (new native code and a build) is not needed |
| D3 | The admin console | **A small separate web app** (`admin/`, React with Vite, signing in with Supabase), hosted free as a Render static site next to the worker. Its packages are approved in DRG5 |
| D4 | Admin accounts | **One account for now**, marked as admin in a new `admin_accounts` table, added once by SQL. More can be added later the same way |
| D5 | Admin PIN for the driver phones | **One PIN for all pilot phones**, set once in the console's settings |
| D6 | Limits on number-check texts (anyone can start a registration, and each check costs a text from the gateway SIM) | **3 per number a day and 20 in total a day**; a number can be checked again after 10 minutes |

## 3. Order

DRG1 → DRG2 → DRG3 → DRG4 and DRG5 (either order) → DRG6 → DRG7. Each step ends with its tests passing and a local commit.

## 4. Steps

### DRG1 Shared rules (S, U)

- `src/shared/driver/registration.ts`:
  - plate format (letters and digits, a space allowed, at most 16 characters) and its normal form (`abc 1234` → `ABC 1234`);
  - the vehicle id made from route and plate (`R4-ABC1234`);
  - the number-check message: a data SMS with its own first byte, and the text form `HM2|V|<code>` for when the gateway sends text;
  - the registration statuses and which moves are allowed (pending → approved or rejected; approved → collected or expired).
- Constants from D1, D5 and D6 and the PRD 0.3 row in `src/shared/config`.
- Tests: plate cases, vehicle id, message round trip, wrong first byte refused, status moves.

### DRG2 Database (M, L)

One migration, pushed after you approve the command:
- `driver_registrations` (PRD 12.2) and `admin_accounts`, with security rules: no client reads or writes the tables directly, and admins work only through functions that check `is_admin()`.
- A **private** storage bucket for the photos: uploads only through a short-lived upload link from the server, at most 1 MB, JPEG only; reads only by admins.
- `sms_outbox`: a row may name a phone number instead of a driver phone, with a kind (heatmap, number check, notice); the gateway's pull reads the number from either. Heatmap rows work as today.
- Admin functions: list registrations, get photo links, approve (checks for an active phone on the plate and returns the warning), reject with a reason, list driver phones, retire.
- Live tests: a client cannot read the table or the bucket; a non-admin cannot call the admin functions; a heatmap row still reaches the gateway pull.

### DRG3 Server functions (M, L)

Supabase Edge Functions, deployed after you approve the command. They are called by the driver app without an account:
- `driver-register`:
  - **start:** takes the number, checks the D6 limits, queues the number-check SMS;
  - **verify:** takes the number and the code the app read; on a match it returns two short-lived upload links;
  - **submit:** takes the plate, route, install token hash and the uploaded photos, and makes a pending registration.
- `driver-setup`:
  - **status:** given the install token, returns pending, approved, rejected (with the reason) or expired;
  - **collect:** once, for an approved registration and the right token. It retires an active phone on the plate if approval said so, makes the secrets, calls `admin_provision_driver`, and returns the `TPV1.` payload. A second call gets nothing.
- Approval queues the "You're approved. Open Tunton Driver while connected to the internet." text (PRD 9.5).
- Photo deletion at the decision (D1) happens here through the storage service, not in SQL.
- Live tests: the limits hold; a wrong code is refused; collect works once and only with the right token; an expired approval cannot be collected.

### DRG4 Driver app registration (M, U, P)

New screens before the existing setup steps, using fetch (the driver app keeps its rule of no Supabase library):
1. **Welcome:** "Register this phone" (main), and "Use a setup code" (the current QR, for development).
2. **Mobile number:** sends it, then waits for the check SMS, read automatically. It can resend after 10 minutes.
3. **Plate and route:** typed plate, route picked from the app's route list.
4. **Consent notice**, then a **CTTDM ID photo** and a **multicab photo** taken with the camera the app already has (no new library; the photo size is kept small with the camera's own settings).
5. **Permissions:** the existing steps (Nearby devices, notifications, text messages with the restricted-setting help).
6. **Submit**, then **Waiting for approval**. It checks the status each time the app opens while online and shows the reason if rejected, with "Register again".
7. **Approved:** collects the setup by itself and hands it to the existing setup code, which turns the beacon on and opens the home screen.
- Tests: the screen order, each status, the D6 messages, a collected payload going through the same parser as a QR.

### DRG5 Admin console (M, W)

`admin/`, a small web app, after you approve its packages (D3):
- **Sign in** with the admin account (D4).
- **Pending:** each registration with number, plate, route, both photos side by side, and the warning when the plate already has a phone. Buttons: **Approve**, **Reject** (with a reason).
- **Drivers:** active phones with vehicle and number, and **Retire**.
- **Settings:** the admin PIN (D5).
- Hosting: a Render static site (you add it in Render, about 5 minutes, steps written in the README).

### DRG6 End-to-end test on the Xiaomi (S, P)

Register the Xiaomi from the driver app, approve it in the console, collect the setup, then check in on the commuter app and watch the count arrive.
- **SMS:** about **4 texts** from the gateway SIM: 1 number check, 1 "approved", about 2 heatmap updates.
- **Needs from you:** the Xiaomi plugged in, the console open, and a check-in at a stop other than CSU.

### DRG7 Docs and the old path (S)

- `docs/TESTING_GUIDE.md`: setting up a driver by registration; the QR scripts become the development path.
- The runbook, `STATUS.md` and the backlog (the PRD already matches D1 to D6).
- The release builds (driver, gateway, commuter preview) stay batched with backlog 126 and the gateway's failed-report fix, asked separately.

## 5. Risks

| Risk | Handling |
| --- | --- |
| Someone uses the public registration to make the gateway send texts | The D6 limits; photos can be uploaded only after the number check |
| A fake driver gets approved | The photo check by you two; the warning when a plate already has a phone; Retire rotates the vehicle's beacon secret at once |
| The setup is taken by another phone | It goes only to the install token made at registration, once |
| Photos leak | Private bucket, admin-only short-lived links, deletion at the decision (D1) |
| The installed development build is too old | One EAS build (#12), asked first |

## 6. What it costs

- **EAS builds:** none planned (one if the development build is too old).
- **Texts:** about 4 in DRG6, plus a few number checks while testing DRG3 and DRG4 (each one stated before it is sent).
- **New packages:** only the admin console's (D3).
- **Size in total:** about 2 weeks of agent work, plus your time for approvals and the phone test.
