# Testing guide: running Tunton yourself

Step by step: set up this PC once, then start the commuter app, the driver app, the gateway app and
the SMS worker, and run an end-to-end test (a commuter checks in, the driver's phone shows it by SMS).

Written 2026-10-18 for Windows and PowerShell. Commands are run from the project folder:

```powershell
cd "C:\Users\John Paul Palaran\Desktop\hatdogers\CAPSTONE\PUV-TRACKER-APP"
```

> **Your gateway SIM is your personal Globe SIM.** Every check-in a driver phone hears about costs a
> text (two texts while two driver phones are on the same route). Keep tests short, wait between
> them, and use a different stop each time, not SM City Butuan every time.

---

## 1. What runs where

| Part | Runs on | How it gets its code | Port on this PC |
| --- | --- | --- | --- |
| Commuter app (`com.tunton.app`) | HONOR (or any test phone) | Development build, JavaScript from this PC | 8081 |
| Driver app (`com.tunton.driver`) | HONOR (TEST 001) and Xiaomi (TEST 002) | Development build, JavaScript from this PC | 8082 |
| Gateway app (`com.tunton.gateway`) | Xiaomi, with the Globe SIM | Development build, JavaScript from this PC | 8083 |
| SMS worker | This PC | `npm run worker:dev` | 8787 |
| Database | Supabase (live project) | — | — |

The phones reach this PC over USB through `adb reverse`, so **the phones stay plugged in** while
you test. The flow of one waiting count:

```
Commuter app ──check-in──▶ Supabase ◀──reads counts every 30 s── SMS worker (this PC)
                                                                        │ queues texts
Driver app ◀──── SMS (data) ──── Gateway app (Xiaomi) ──pulls every 10 s─┘
```

---

## 2. One-time setup of this PC

Skip any step that is already done.

1. **Node.js 22** (LTS): `node --version` should print `v22…`.
2. **Project packages:** `npm install`
3. **Android platform tools (adb):** already installed at
   `C:\Users\John Paul Palaran\AppData\Local\Android\sdk\platform-tools\adb.exe`.
   Check with `adb version`. If PowerShell says `adb` is not recognised, use the full path above,
   or add that folder to your PATH (Windows search: "Edit the system environment variables").
4. **`.env` in the project folder** (never commit it). Copy `.env.example` to `.env` and fill in:
   - `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase dashboard,
     Project Settings, API);
   - `SUPABASE_SERVICE_ROLE_KEY` (same page, the `service_role` secret: **keep it private**);
   - `TEST_WRITER_EMAIL` and `TEST_WRITER_PASSWORD` (the team test account).
5. **`services\sms-worker\.env`** (never commit it), one line:

   ```
   SMS_PRIMARY_ENCODING=data
   ```

   The worker finds the Supabase URL and service role key in the main `.env`.
6. **Phones:** USB debugging on (Settings, About phone, tap "Build number" 7 times, then Developer
   options, USB debugging). Plug in, accept "Allow USB debugging" on the phone, then:

   ```powershell
   adb devices
   ```

   Each phone shows a serial number. Today's phones:
   - HONOR X8c: `ANRG6R4C24002611`
   - Xiaomi (POCO): `PZQGPV4H7LDIU8BE`
7. **Development builds on the phones.** Already installed: commuter `development` (`e447a702`) on
   the HONOR and the Xiaomi, `development-driver` (`2349c793`) on both, `development-gateway`
   (`3f7b77d8`) on the Xiaomi. To install one on another phone: expo.dev, account `newtxrsh`, project
   `tunton-app`, Builds, open the build, scan its QR code with the phone, install the APK.

---

## 3. Start a test session (every time)

### 3.1 Start the three development servers

Open **three PowerShell windows** in the project folder, one command in each, and leave them open:

```powershell
npm start                  # commuter app, port 8081
npm run start:driver       # driver app, port 8082
npm run start:gateway      # gateway app, port 8083
```

Each prints "Waiting on http://localhost:808x" when ready. You only need the ones for the apps you
test.

### 3.2 Connect each phone to the servers

Run these in a fourth PowerShell window. `-s` picks the phone (leave it out with one phone plugged in).

```powershell
# HONOR: commuter and driver apps
adb -s ANRG6R4C24002611 reverse tcp:8081 tcp:8081
adb -s ANRG6R4C24002611 reverse tcp:8082 tcp:8082

# Xiaomi: driver and gateway apps
adb -s PZQGPV4H7LDIU8BE reverse tcp:8082 tcp:8082
adb -s PZQGPV4H7LDIU8BE reverse tcp:8083 tcp:8083

# Check
adb -s ANRG6R4C24002611 reverse --list
```

**Forwards disappear** when a phone is unplugged, restarts or drops its USB connection. If an app
shows the development launcher or "problem loading the project", run the `reverse` lines again.

### 3.3 Open an app

Open the app on the phone. A development build either opens straight away, or shows the
**development launcher**: tap the server under "Recently opened" (`http://localhost:8081`, `8082`
or `8083`), or tap "New development server" and type it.

**After changing code**, the app reloads by itself. If a reload ends on an error screen or a blank
white screen, **close the app fully and open it again** (a cold start): Settings, Apps, the app,
Force stop; or `adb -s <serial> shell am force-stop com.tunton.driver` (or `com.tunton.app`,
`com.tunton.gateway`).

A red "Can't perform a React state update…" toast is a known development-only warning from
Expo Router. Tap ✕.

---

## 4. Commuter app

1. **Sign in:** menu, Sign in, the team test account (from `.env`). Check-in, Relay and Crowdsource
   need an account; the tabs say "needs an account" otherwise.
2. **Demo and simulation settings:** menu, Demo & simulation, or from the PC:

   ```powershell
   adb -s ANRG6R4C24002611 shell am start -a android.intent.action.VIEW -d "tunton://demo-settings" com.tunton.app
   ```

   - **Simulated multicabs:** off for real tests (on, it shows made-up vehicles and turns the
     Bluetooth search off).
   - **Simulated location:** on, then pick a stop under "Stand at" (scroll the row). Pick a stop on
     the driver's route (R4 stops: TAL, ANT, SOL, LTF, AMP, CSU, TIN, NIS, BAA, FSU, SJI, OBR, LPM,
     BWB, SMB, ZAM, ANH, PAL), **a different one each test**.
3. **Location consent:** Settings, Privacy, Location must say "Agreed · Android allows it". If not,
   tap it, read the notice, I agree.
4. **Check in:** Check-in tab, tap the nearest station, under "Ping routes" leave **only R4** on,
   then "Check in at …". To end it: Cancel, or "I boarded".
5. **Relay with Bluetooth (finds the multicab you are in):** Bluetooth and location on, the phone
   **right next to** a driver phone whose beacon is on, then the round Relay button on the map. It
   says "Looking for your multicab…", then "Found by Bluetooth · R4 · TEST 00x". If you are checked
   in on that route, this ends the check-in ("Boarded"). The search stops when the panel closes.

---

## 5. Driver app

### 5.1 First-time setup of a driver phone (once per phone)

On the PC (you type the admin PIN it asks for; remember it):

```powershell
# A new multicab: no --replace
npx tsx scripts/provision-driver.ts --vehicle R4-TEST-03 --plate "TEST 003" --route R4 --phone 09xxxxxxxxx

# A phone replacing the multicab's old phone (a reset or new phone): add --replace
npx tsx scripts/provision-driver.ts --vehicle R4-TEST-01 --plate "TEST 001" --route R4 --phone 09xxxxxxxxx --replace
```

`--phone` is the driver phone's own number. The script shows a QR code. On the phone: driver app,
point the camera at the QR, "Yes, set up", Continue (Nearby devices, notifications), "Allow text
messages", Done.

**If Android refuses text messages without asking** (a "restricted setting" for apps not from the
Play Store): Settings, Apps, Tunton Driver. Xiaomi: ⋮ (top right), "Allow restricted settings".
HONOR: tap "Remove restriction" on the red banner, then the phone's lock-screen PIN. Back in the app,
Try again.

Already set up: TEST 001 on the HONOR (DRV-0004) and TEST 002 on the Xiaomi (DRV-0005), both R4.

### 5.2 Using it

- **Home:** the beacon and battery at the top, the plate, the route map (drag and zoom; buttons for
  zoom in/out, default view, stop names), the colour key, and the stops with their waiting counts.
  At night (21:00 to 04:59) the list shows ranges (0, 1–4, 5–9, 10+) instead of exact counts.
  After 15 minutes with no update it greys out and says "No update for …".
- **Admin:** hold the top bar (beacon and battery) for 3 seconds, enter the admin PIN. Shows the
  beacon code, "accepted" messages, dropped messages by reason, and a log of recent messages;
  Turn beacon off/on; Set up again (asks to confirm; then the phone needs a new QR).
- The beacon needs **Bluetooth on**. It keeps running in the background and comes back after a
  restart (once the phone is unlocked).

---

## 6. Gateway app (the Xiaomi)

### 6.1 First-time setup (already done: GW-01)

```powershell
npx tsx scripts/provision-gateway.ts --gateway GW-01 --phone 09xxxxxxxxx --worker-url http://localhost:8787
```

`--phone` is the gateway's own number (the Globe SIM). Scan the QR in the gateway app, allow SMS,
Phone and notifications, and allow it to run in the background. Re-running this makes a new token:
the phone must scan the new QR. Set up the gateway **before** driver phones (their QR carries the
gateway's number).

### 6.2 Using it

- **Home:** Running / Stopped / Restarting… / "Cannot reach the worker", last check, today's
  sent / delivered / failed, battery, SIM.
- **Admin** (type the admin PIN, Unlock): **Start sending** / **Stop sending**, Event log, Carrier
  test, Set up again.
- "Cannot reach the worker" just means the worker is not running or the 8787 forward is missing.

---

## 7. SMS worker

The worker reads the live waiting counts every 30 s and queues texts; the gateway sends them. It
sends **only while someone is checked in** (plus one "cleared" text when they leave), at any hour.

```powershell
# 1. Start it (its own PowerShell window; leave it open)
npm run worker:dev

# 2. Let the Xiaomi's gateway reach it
adb -s PZQGPV4H7LDIU8BE reverse tcp:8787 tcp:8787
```

3. On the Xiaomi: gateway app, Admin, **Start sending**. Within 10 s it says "Running" and
   "Last check … s ago".

The worker prints one line per event, for example `"message":"queued","reason":"new_stop","phones":2`.
A `gateway_heartbeat` alert at start-up only means the gateway was quiet before; it is normal.

**Never run `scripts/fake-gateway.ts` while the real gateway is sending**: both would take the same
messages.

---

## 8. End-to-end test (one check-in, about 4 texts with two driver phones)

1. Steps 3 and 7 done: servers running, forwards set, worker running, gateway "Running".
2. Driver app open on the HONOR (and/or the Xiaomi).
3. **Check in** on the commuter app (section 4) at a stop on R4, only R4 pinged. Or from the PC,
   as the team test account:

   ```powershell
   npx tsx scripts/dev-checkin.ts --route R4 --station SJI
   ```

4. Within about 30 s: the worker prints `queued … new_stop` (or `first` for the day's first text),
   the gateway's "sent" count goes up, and each driver app shows "Updated just now" with the stop in
   "Most waiting".
5. **End the check-in** (commuter app: Cancel or I boarded; or `npx tsx scripts/dev-checkin.ts --end`).
   Within about 30 s a `cleared` text arrives and the counts go back to 0.
6. **Wait a few minutes before the next test, and pick another stop.**

To look at the texts themselves: Supabase dashboard, Table editor, `sms_outbox` (status
`delivered`, with times).

---

## 9. Stop everything

1. Gateway app: Admin, **Stop sending**.
2. In each server and worker window: **Ctrl+C**.
3. Remove the forwards (the HONOR is your mother's phone, so always do this one):

   ```powershell
   adb -s ANRG6R4C24002611 reverse --remove-all
   adb -s PZQGPV4H7LDIU8BE reverse --remove-all
   ```

4. Make sure nobody is left checked in (commuter app, or `npx tsx scripts/dev-checkin.ts --end`).

If a port stays busy after Ctrl+C ("port 8081 is in use"), a Node process is still running: close
its window, or find it with `Get-Process node` and stop it with `Stop-Process -Id <id>`.

---

## 10. Troubleshooting

| What you see | What to do |
| --- | --- |
| App opens the development launcher, or "There was a problem loading the project" | The forward is gone (section 3.2) or the server is not running (3.1). Fix, then tap the server again |
| Blank white screen after a reload | Force stop the app and open it again (section 3.3) |
| Gateway "Cannot reach the worker" | Worker not running, or `adb reverse tcp:8787 tcp:8787` missing on the Xiaomi |
| Gateway "Restarting…" for a long time | Open the gateway app with the phone unlocked; Admin, Stop then Start sending |
| Driver app gets no update | Gateway "Running"? Worker printed `queued`? Is the check-in on the driver's route (R4)? Driver phone's Admin: anything under "Dropped"? |
| Commuter tabs say "needs an account" | Sign in again (menu, Sign in) |
| Relay never finds the multicab | Bluetooth and location on on both phones, the driver's beacon on, the phones close together (within about a metre) |
| Driver phone can't receive texts after setup | The restricted-setting steps in section 5.1 |
| A driver or gateway app stops after being swiped away (Xiaomi) | Settings, Apps, the app: Autostart on, Battery saver "No restrictions" |

---

## 11. Quick reference

| What | Command |
| --- | --- |
| Commuter / driver / gateway server | `npm start` / `npm run start:driver` / `npm run start:gateway` |
| Phone forwards | `adb -s <serial> reverse tcp:<port> tcp:<port>` |
| SMS worker | `npm run worker:dev` (+ `adb -s PZQGPV4H7LDIU8BE reverse tcp:8787 tcp:8787`) |
| Check in / end from the PC | `npx tsx scripts/dev-checkin.ts --route R4 --station <CODE>` / `--end` |
| Set up a driver phone | `npx tsx scripts/provision-driver.ts --vehicle … --plate "…" --route R4 --phone …` |
| Set up the gateway | `npx tsx scripts/provision-gateway.ts --gateway GW-01 --phone … --worker-url http://localhost:8787` |
| Code checks | `npm run typecheck`, `npm run lint`, `npx jest src/ services/ supabase/functions/` |

**Release builds** (for the pilot, not for these tests): driver `e00a98c8` and gateway `19a73c5a`
on expo.dev. A release gateway only accepts an `https://` worker address, so it needs the Cloudflare
tunnel (`services/sms-worker/README.md`, "Team PC") before it can replace the development build.
More detail: `services/sms-worker/README.md`, `docs/device-tests.md`, `docs/IMPLEMENTATION_PLAN_DRIVER.md`
section 11 (runbooks).
