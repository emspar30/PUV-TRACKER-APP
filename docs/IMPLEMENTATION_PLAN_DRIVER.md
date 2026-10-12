# Implementation plan: the driver side

- **Date:** 2026-10-11.
- **Base:** `main` at `900f3c8` (ST2-D2).
- **Status:** proposal; the section 3 questions were answered on 2026-10-11. Nothing here is built until Emjay approves it, step by step.
- **Scope:** everything a driver, the cooperative and the research team need beyond the commuter app:
  1. the **driver app** (BLE beacon, signed SMS heatmap, offline screen);
  2. the **Node.js SMS worker** (demand counts to signed messages, queue, retries, gateway health);
  3. the **gateway app** (pulls the queue over HTTPS, sends the SMS);
  4. the **commuter side of the beacon** (boarding detection that fills the Relay panel), because a beacon nobody listens to proves nothing.
- **Out of scope:** the verification window, Smart Queue and Primary/Secondary baton (V1, PRD 8.3, 10.1–10.2), background relay (B1), the web admin console (PRD 0.6: dashboard and scripts instead), Play Integrity, Cebuano strings.
- **PRD build steps covered:** S6 (driver beacon), S7 (boarding detection, without the verification window), S9 (SMS worker, gateway, driver heatmap) and the driver parts of S10.
- **Standing decisions this plan keeps** (Emjay, 2026-10-10 and 2026-10-11):
  1. **Option A:** commuter, driver and gateway are **build variants of this one Expo codebase**, chosen by `APP_VARIANT` in `app.config.js`, installed as three separate apps.
  2. **The Node.js SMS worker stays** (PRD 6.1, 6.3). The gateway pulls from it over HTTPS. Edge Functions do not replace it.
  3. **The driver channel is one-way and aggregate** (PRD 6.2, 9.1). Drivers see waiting counts per stop only, never individual commuters. The driver phone sends nothing to the cloud.

> **Step codes.** This plan uses **DR0 to DR9**. Plain "D1 to D14" already names the PRD 19.2 decisions (for example "D1: tracking costs Energy"), so a "D1" step would be ambiguous in commits and STATUS.

---

## Contents

1. [How to use this guide](#1-how-to-use-this-guide)
2. [The system in one page](#2-the-system-in-one-page)
3. [Decisions (answered)](#3-decisions-answered-by-emjay-2026-10-11)
4. [Hardware, SIMs and paperwork (DR0)](#4-hardware-sims-and-paperwork-dr0)
5. [Repository layout after this plan](#5-repository-layout-after-this-plan)
6. [Protocols and formats](#6-protocols-and-formats)
7. [New config constants](#7-new-config-constants)
8. [Security model](#8-security-model)
9. [Steps DR1 to DR9](#9-steps-dr1-to-dr9)
10. [Order, dependencies and effort](#10-order-dependencies-and-effort)
11. [Runbooks (operating the system)](#11-runbooks-operating-the-system)
12. [Risks specific to the driver side](#12-risks-specific-to-the-driver-side)
13. [Traceability to the PRD](#13-traceability-to-the-prd)
14. [Approvals checklist](#14-approvals-checklist)

---

## 1. How to use this guide

Every step in section 9 has the same parts:

| Part | Meaning |
| --- | --- |
| **Goal** | What exists when the step is done, with PRD references |
| **Needs** | Steps, hardware, data or approvals that must come first |
| **Files** | Every file created (**new**) or changed (**chg**) |
| **Tasks** | The work in order; each task is small enough to check |
| **Tests** | Automated tests (names and cases) |
| **Device scripts** | Manual scripts to add to `docs/device-tests.md`, with numbered IDs |
| **Accept** | The criteria that close the step |
| **Approvals** | Exact commands that need Emjay's word before they run |

**The procedure for every step** (PRD 0.1 rule 9, master plan rules):

1. The agent states the files it will create or change and the commands it needs. Emjay approves.
2. The agent builds. Pure logic goes in `src/shared/` with fixture tests, and every threshold goes in `src/shared/config/` (lint enforces both).
3. Quality gates, all passing: `npx tsc --noEmit`, `npx expo lint`, `npx jest`.
4. Manual scripts are written into `docs/device-tests.md`. The agent runs the emulator ones it can; phone runs are by Emjay or the partner.
5. One local commit: `DRn: <summary> (Emjay)`, ending with the co-author line. **Never pushed** unless Emjay writes "push".
6. `docs/STATUS.md` gets a row per step, and `docs/AUDIT_BACKLOG.md` gets an item for every check only a person can close.

**Who does what**

| Role | Does |
| --- | --- |
| **Emjay** (owner) | Approves each step, each dependency, each native build and each live Supabase command; holds the service role key; signs off device results |
| **Partner** | Phone builds, the two-phone and SIM tests, field experiments |
| **Agent** | Code, tests, migrations (written, not applied), scripts, docs |

---

## 2. The system in one page

```text
                        (1) check_in RPC (exists)
   Commuter app  ───────────────────────────────────────▶  Supabase
   com.tunton.app                                           checkins (expires_at)
        ▲   │ (7) verify_beacon RPC (DR8)                   driver_devices, gateways,
        │   └───────────────────────────────────────────▶  sms_outbox, vault secrets
        │                                                       ▲      │
        │ (6) BLE beacon, rotating                (2) service   │      │ (3) outbox rows
        │     signed code every 60 s                  role, 30 s│      ▼
        │                                              ┌──────────────────────┐
   ┌────┴──────────────┐                               │   Node.js SMS worker │
   │ Driver app        │                               │   services/sms-worker│
   │ com.tunton.driver │                               └──────────┬───────────┘
   │ beacon + heatmap  │                                          │ (4) HTTPS pull,
   └────▲──────────────┘                                          │     result, heartbeat
        │ (5) signed SMS (data SMS to a port,          ┌──────────▼───────────┐
        │     text SMS as fallback)                    │ Gateway app          │
        └──────────────────────────────────────────────│ com.tunton.gateway   │
                                                       │ phone on mains power │
                                                       └──────────────────────┘
```

| # | Flow | Who owns the rule |
| --- | --- | --- |
| 1 | A commuter checks in at a stop; the row expires after 15 min | Database (`check_in`, exists) |
| 2 | Every `WORKER_CYCLE_S` the worker reads live counts per route and stop | Worker; `worker_demand_snapshot()` |
| 3 | When the dispatch rule fires, the worker signs one message per driver phone (own key, own sequence number) into `sms_outbox` | Worker; pure `src/shared/sms/` |
| 4 | The gateway pulls queued messages, sends them, reports sent/delivered/failed, and sends a heartbeat | Gateway service (Kotlin) and worker HTTP API |
| 5 | The driver phone accepts a message only from the gateway number, with a valid signature, a fresh time and a newer sequence number; it draws the heatmap and greys it after 15 min | Driver app; pure `validateHeatmap` (exists) |
| 6 | The driver phone advertises a 9-byte code that changes every 60 s | Driver beacon service (Kotlin) |
| 7 | A commuter phone hears the beacon, applies the presence rule and asks the server whether the code is valid; the Relay panel fills itself | Commuter app and database |

**Principles carried from the PRD**

- **One-way driver channel** (PRD 6.2): the driver phone has no Supabase client, no account and no location permission. It advertises and listens. Lint enforces this (DR1).
- **Server is the authority** for beacon validation (PRD 6.2). The commuter app never holds a vehicle secret.
- **Vehicles, not drivers** (PRD 3.2, 9.1): nothing identifies or scores a driver. The driver's phone number exists only so the gateway can text it, and only the worker can read it.
- **Pure core, thin native** (PRD 0.1 rule 5): beacon codes, SMS packing, dispatch rules, heatmap state and clock drift are pure TypeScript with fixture tests. Kotlin does only what the OS forces into native code: advertising, scanning, SMS broadcasts, sending SMS, foreground services.

---

## 3. Decisions (answered by Emjay, 2026-10-11)

All twelve are answered. The rest of this plan follows these answers.

| # | Question | Answer | Affects |
| --- | --- | --- | --- |
| Q1 | Step codes DR0–DR9 (not D0–D8, which collides with PRD decisions D1–D14)? | **Yes, DR.** | Commits, STATUS |
| Q2 | How each variant gets its own screens | **Settled by the DR1 spike (2026-10-12): the per-variant `root` works.** Each exported bundle holds only its own screens. Originally: try the Expo Router `root` option per variant (`src/driver/app`, `src/gateway/app`); **fall back to one route tree** with `/driver` and `/gateway` paths and a redirect by variant if the DR1 spike fails. (The Expo v57 docs list `root` but advise against it "unless you have a specific need", which three apps in one repo is.) | DR1 |
| Q3 | Where the SMS worker runs | **The team PC**, for development and the pilot. The gateway reaches it over USB (`adb reverse`) during development and through a **Cloudflare Tunnel** (HTTPS, free) during the pilot. The PC must be on and online during SMS hours (05:00–21:00); runbook 11.7. | DR6, DR7, DR9 |
| Q4 | Gateway carrier and SMS plan | **Smart/TNT** prepaid SIM. **Written confirmation** of automated-SMS terms is still required (PRD 9.6, 15.3; DR0). Driver SIMs on Smart/TNT where possible, so texts stay on-net. A backup SIM on another network is optional. | DR0, DR5, DR7 |
| Q5 | Exact counts or bands for drivers | **Bands on the map, exact numbers in the list below it** (`DRIVER_SHOW_EXACT_COUNTS` = true). | DR5 |
| Q6 | SMS operating hours | **05:00 to 21:00** Asia/Manila. | DR6 |
| Q7 | First route and vehicles | **R4 (De Oro); 2 test vehicles now, about 10 for the pilot.** | DR0, DR3 |
| Q8 | Dependencies | **All five approved:** `expo-camera`, `expo-keep-awake`, `expo-battery`; dev-only `qrcode-terminal` and `esbuild`. Each is still installed in its own step with the command in section 14. | DR3, DR4, DR6 |
| Q9 | How the worker alerts the team | **Dashboard only:** a row in `ops_alerts`, checked in the Supabase dashboard (runbook 11.3). No webhook. | DR6 |
| Q10 | Include commuter boarding detection (DR8)? | **Include it:** detection, server code check and Relay auto-fill. The verification window, Smart Queue and baton stay in V1. | DR8 |
| Q11 | Night demand counts to drivers | **Bands only after 21:00** (`DRIVER_NIGHT_BANDS_ONLY` = true), **and added to the DPO review** with the consent text. | DR0, DR5 |
| Q12 | Admin access on the driver phone | **A 6-digit PIN, entered after holding the status bar for 3 seconds.** Set at provisioning; only its salted hash is stored. | DR4 |

**Consequences of the answers**

- **Q3 (team PC):** the worker's uptime is the PC's uptime. DR9's 7-day SMS trial (E7) needs the PC on for those 7 days during SMS hours. If that proves impractical, the same one-file bundle runs unchanged on any Node host later.
- **Q9 (dashboard only):** nobody is notified automatically. The two-minute daily check (runbook 11.3) is the only way to find out about problems, so it has to happen every pilot day.
- **Q4 (Smart/TNT):** DR5's carrier spike tests data SMS on Smart/TNT first. Cross-network tests run only if some driver SIMs end up on another network.

---

## 4. Hardware, SIMs and paperwork (DR0)

DR0 is not code. It starts now and runs beside DR1 to DR3, because SIMs, phones and written terms take days to arrive, and the carrier test (risk 4) must happen in the first week of SMS work.

### 4.1 Devices

| Item | For | How many | Must have |
| --- | --- | --- | --- |
| Driver phone | DR4, DR5, DR9 | 2 for development; about 10 for the pilot | Android 8.0+; **BLE peripheral (advertising) support**, checked with the DR4 self-test or the free "nRF Connect" app's Advertiser tab before buying more of the same model; SIM slot; USB charging from the vehicle |
| Commuter test phone | DR4 (scanner), DR8 | 2 | Android 8.0+, Bluetooth; one is the partner's phone |
| Gateway phone | DR5 spike, DR7, DR9 | 1 (+1 spare later, PRD 16 risk 12) | Android 8.0+; dual SIM preferred; mains charger and a power bank or small UPS |
| Vehicle mount and charger | DR9 | 1 per vehicle | Dashboard mount the cooperative allows (PRD 18.2), a car charger that keeps a phone at 100% |

### 4.2 SIMs

- **Every SIM must be registered** under the SIM Registration Act (RA 11934) before it works. Register the gateway SIM to the project (a team member, recorded in the pilot file).
- **Gateway SIM:** Smart/TNT prepaid (Q4), on an SMS plan whose terms allow automated sending at the planned volume (section 6.2.6), confirmed **in writing** (PRD 15.3). Keep the SIM loaded so it does not expire.
- **Driver SIMs:** receive-only, but still loaded enough to stay active. Record each number; it goes into the provisioning QR (DR3).

### 4.3 Paperwork

| Document | Owner | Needed before |
| --- | --- | --- |
| Cooperative agreement (PRD 4.3, 9.1): voluntary participation, what data the cooperative may see, mounting, phone ownership, return of phones | Emjay | DR9 pilot |
| Driver information sheet in plain English (Cebuano later): what the phone does, that it does not track the driver, how to report a fault | Emjay (agent drafts) | DR9 |
| DPO review: driver phone numbers held by the project, night counts to drivers (Q11), commuter Bluetooth scanning (DR8) | Emjay | DR8 release to anyone outside the team; DR9 |
| Written SMS terms from the carrier (PRD 9.6) | Emjay | DR7 pilot volume |
| Vehicle list from the cooperative: plates, routes, seat capacity (PRD 5.1, 18.1) | Emjay | DR3 real vehicles |

---

## 5. Repository layout after this plan

Only the paths that change are shown.

```text
app.json                          base config (kept; the commuter values)
app.config.js                     new: variant switch on APP_VARIANT (commuter | driver | gateway)
eas.json                          chg: variant profiles
plugins/
  withDriverAndroid.js            new: driver permissions, beacon service, SMS receivers, boot receiver
  withGatewayAndroid.js           new: gateway permissions, gateway service, boot receiver, dev cleartext to localhost
  withCommuterBle.js              new (DR8): Bluetooth scan permissions for the commuter app
modules/
  tunton-beacon/                  new: Kotlin; advertiser service (driver), scanner (commuter, DR8), secret store
  tunton-sms/                     new: Kotlin; SMS receivers and inbox (driver), sender and gateway service (gateway)
src/
  app/                            commuter routes (unchanged)
  driver/
    app/                          new: driver routes (_layout, provision, index, admin)
    features/                     new: heatmap, status strip, provisioning, self-test
    state/                        new: driverStore, heatmapStore
  gateway/
    app/                          new: gateway routes (_layout, setup, index, log)
    features/, state/             new
  shared/
    beacon/                       new: code.ts, presence.ts (pure)
    sms/                          protocol.ts (exists); gsm.ts, pack.ts, binary.ts, dispatch.ts (new, pure)
    driver/                       new: heatmap.ts, drift.ts, phone.ts, provisioning.ts (pure)
    config/index.ts               chg: section 7 constants
  strings/en.ts                   chg: strings.driver, strings.gateway
services/
  sms-worker/                     new: Node.js worker (src/, __tests__/, README.md)
supabase/
  migrations/20261013000000_driver_side.sql     new (DR3)
  migrations/20261014000000_beacon_verify.sql   new (DR8)
  cron/retention.sql              chg: sms_outbox retention
scripts/
  with-variant.js                 new: sets APP_VARIANT on any shell, then runs the command
  provision-driver.ts             new
  provision-gateway.ts            new
  retire-device.ts                new
  sms-sign.ts                     new: prints a signed test message (emulator tests)
  decode-beacon.ts                new: decodes and checks a captured beacon payload
  fake-gateway.ts                 new: pulls from the worker and prints, for DR6 without phones
  run-worker.ps1                  new: starts the worker on the team PC and restarts it if it stops (Q3)
tests/
  fixtures/beacon-vectors.json    new: test vectors shared by Jest, Kotlin and SQL
docs/
  IMPLEMENTATION_PLAN_DRIVER.md   this file
```

**Boundaries (enforced by ESLint `no-restricted-imports`, DR1)**

| Code in | May not import |
| --- | --- |
| `src/driver/**`, `src/gateway/**` | `@supabase/*`, `@/services/*`, `@/data/live/*`, `@/state/sessionStore` (no cloud from the driver or gateway app) |
| `src/app/**`, `src/features/**`, `src/state/**` | `@/driver/*`, `@/gateway/*` |
| `src/shared/**` | React, React Native, Expo, native modules (existing rule) |
| `services/sms-worker/**` | React, React Native, Expo, `@/…` app code; it may import `src/shared/**` by relative path |

---

## 6. Protocols and formats

These are fixed in DR2, before any native code, so Kotlin, TypeScript, SQL and the worker implement one specification and share one set of test vectors.

### 6.1 Beacon payload (PRD 8.2)

**Advertising layout**

| Packet | Content | Bytes |
| --- | --- | --- |
| Advertising data | Flags (added by Android when needed) + the 128-bit service UUID (`BEACON_SERVICE_UUID`) | ≤ 21 |
| Scan response | Service data for `BEACON_SERVICE_UUID`: the 9-byte payload below | 2 + 16 + 9 = 27 (limit 31) |

The commuter scan filters on the service UUID (PRD 8.2: the system Bluetooth stack does the matching) and reads the service data from the scan response. Android's scanner requests scan responses; DR4-M2 confirms that the payload reaches a scanning phone.

**Payload, 9 bytes, big-endian**

| Bytes | Field | Notes |
| --- | --- | --- |
| 0 | `version` | `BEACON_PAYLOAD_VERSION` = 1 |
| 1–2 | `shortId` | Vehicle short id, 1 to 65,535 (0 reserved); `vehicles.short_id` |
| 3–4 | `slotLow` | Low 16 bits of `slot = floor(unixSeconds / BEACON_SLOT_S)` |
| 5–8 | `mac` | First 4 bytes of `HMAC-SHA256(secret, version ‖ shortId ‖ slot)` |

- The MAC covers the **full 32-bit slot** (7 bytes signed: 1 + 2 + 4), though only the low 16 bits travel. A captured code therefore never becomes valid again when the 16-bit counter wraps (every 45 days).
- `secret`: 32 random bytes per vehicle, stored in Supabase Vault and on the driver phone only.
- **Server check:** for `d` in −1, 0, +1 (`BEACON_SLOT_TOLERANCE`): `s = serverSlot + d`; if `s mod 65536 = slotLow` and the MAC matches, accept with offset `d`. Otherwise `expired` (the slot matches no candidate) or `bad_mac`. This is the PRD 0.2 S1 rule: valid in its slot and one either side, invalid two or more away.
- **Rotation:** the advertiser updates the scan response at each slot boundary (aligned to the wall clock, not to the service start), using `AdvertisingSet.setScanResponseData`, so advertising never stops.

### 6.2 Heatmap SMS (PRD 9.3, 12.3)

#### 6.2.1 Text form: unchanged

`HM2|<route>|<seq>|<HHMM>|<code>:<count>,...|<mac>`, as implemented in `src/shared/sms/protocol.ts`. Every current stop code is 3 letters (39 stations), so every stop fits the `[A-Z]{2,4}` rule.

#### 6.2.2 Merge semantics

A message lists **stops and their current counts**. The driver app **merges** them into its state: listed stops update, unlisted stops keep their last value. Zeros are therefore sent explicitly, as in the PRD example (`RBN:0`). This lets a long route be split over two messages without changing the format.

#### 6.2.3 Length rule (GSM-7)

A single SMS holds 160 GSM-7 septets. **`|` is in the GSM-7 extension table and costs 2 septets**, so each message costs `length + 5` (five pipes). `src/shared/sms/gsm.ts` counts septets exactly. `pack.ts` puts stops in riding order and starts a new message (its own sequence number) when the next stop would pass `SMS_TEXT_MAX_SEPTETS`.

| Route | Stops | One text message, counts up to 99 | One data message |
| --- | --- | --- | --- |
| **R4** (longest list, the pilot route) | 18 | **156 of 160 septets** | 120 of 133 bytes |
| R14 | 17 | 150 | 114 |
| R2 | 17 | 149 | 114 |
| R5 | 16 | 142 | 108 |
| R1, R3 | 13 | 121 | 90 |

*Measured in DR2 (2026-10-12) on the seed data (route data version 7). Three-digit counts, or more stops, make `pack.ts` split the list into two messages; `smsPacking.test.ts` checks that every route still fits in one message at counts up to 99.*

#### 6.2.4 Binary form (data SMS, PRD 9.3 primary path)

A data SMS carries at most 140 bytes; the port header takes 7, so **`DATA_SMS_MAX_BYTES` = 133** (DR5's carrier spike confirms it).

| Bytes | Field |
| --- | --- |
| 0 | Magic `0x48` (`H`) |
| 1 | Format version `0x02` |
| 2 | Route number (R1 → 1 … R99 → 99) |
| 3–4 | Sequence number (0–9,999) |
| 5–6 | Minute of day, Asia/Manila (0–1,439) |
| 7 | Stop count `n` |
| … | `n` × [code length (1 byte), code (ASCII), count (2 bytes)] |
| last 4 | MAC |

The binary form is **only a transport encoding**. The driver app decodes it back to the canonical text, then runs the existing `validateHeatmap` on that text. The MAC is always computed over the text's signed part, so there is one signing rule and one validator. R4's 18 stops take 8 + 18 × 6 + 4 = 120 bytes; at most 20 three-letter stops fit one data SMS.

#### 6.2.5 Sequence numbers and keys

- **One key and one sequence per driver phone** (`driver_devices.sms_key_secret_id`, `driver_devices.last_seq`). The worker signs each phone's copy separately.
- A re-sent message (lost acknowledgement, gateway retry) carries the same sequence number, so the driver phone drops it as `old_sequence`. Duplicates are harmless by design.
- A phone that misses more than 5,000 messages (`SMS_SEQ_NEWER_WINDOW`) would reject everything. At the dispatch rate (≤ 12 an hour) that takes over two weeks of the phone being off. The fix is re-provisioning (runbook 11.4), which resets both sides.

#### 6.2.6 Dispatch rule (PRD 9.6) and volume

Per route, evaluated every `WORKER_CYCLE_S`:

| Rule | Send when |
| --- | --- |
| `first` | No message has been sent today for this route and any count is above zero |
| `change` | Any stop's count differs by `SMS_DISPATCH_MIN_CHANGE` (2) or more from the last sent value |
| `interval` | `SMS_DISPATCH_INTERVAL_MIN` (5) minutes since the last send while any count is above zero |
| `cleared` | All counts are now zero and the last sent message had a non-zero count (sent once, so drivers do not see an old queue for 15 minutes) |
| *(never)* | Outside the operating hours (Q6) |

**Volume:** at most 12 messages an hour per phone (×2 for a split route) over 16 operating hours is ≤ 192 a day per phone, so about **1,900 a day for 10 vehicles** (PRD 9.6 estimates 1,700 for 14 hours). Android's own outgoing-SMS limiter (by default about 30 messages per 30 minutes per app) must be raised on the gateway phone (DR7 task 9).

### 6.3 Provisioning QR (PRD 9.5)

The text is `TPV1.` followed by base64url-encoded JSON. `src/shared/driver/provisioning.ts` parses and validates it; malformed, expired or wrong-kind payloads are refused with a reason.

| Field | Driver | Gateway |
| --- | --- | --- |
| `v`, `kind` | 1, `"driver"` | 1, `"gateway"` |
| `exp` | Unix seconds; `PROVISIONING_QR_TTL_MIN` (15) after creation | same |
| `deviceId` | e.g. `DRV-0001` | — |
| `vehicleId`, `shortId`, `routeCode`, `plate` | from `vehicles` | — |
| `beaconSecret` | 64 hex characters | — |
| `smsKey` | 64 hex characters | — |
| `gatewayNumbers` | E.164 list, e.g. `["+639171234567"]` | — |
| `adminPinHash`, `adminPinSalt` | Q12 | same |
| `gatewayId`, `workerUrl`, `token` | — | `GW-01`, `https://…`, 43-character random token |

The QR is shown **only in the provisioning script's terminal** and is never written to disk. The app hands secrets straight to the native module, which encrypts them with an Android Keystore key. JavaScript state keeps only non-secret fields (vehicle, route, plate).

### 6.4 Worker HTTP API (gateway ↔ worker)

All requests use `Authorization: Bearer <gateway token>`; the worker compares the SHA-256 of the token with `gateways.token_hash`. HTTPS only in release builds.

| Method and path | Body | Response | Effect |
| --- | --- | --- | --- |
| `POST /v1/pull` | `{ "max": 10 }` | `{ "messages": [{ "id", "to", "encoding": "text"\|"data", "text"?, "dataB64"?, "port"? }] }` | Claims up to `max` queued messages (`for update skip locked`) with a lease of `SMS_CLAIM_LEASE_S` |
| `POST /v1/result` | `{ "id", "status": "sent"\|"delivered"\|"failed", "errorCode"?, "atMs" }` | `204` | Records the outcome; a failed message is re-queued until `SMS_SEND_MAX_ATTEMPTS` |
| `POST /v1/heartbeat` | `{ "batteryPct", "charging", "simReady", "signalLevel", "queueLocal", "appVersion" }` | `{ "pullEveryS" }` | Updates `gateways.last_heartbeat_at` and `last_status` |
| `GET /healthz` | — | `200 ok` | Liveness for the host; no authentication; no data |

---

## 7. New config constants

All go in `src/shared/config/index.ts` (no magic numbers in `src/shared`). Values the database also enforces are repeated in the migration, and `migration.test.ts` checks the two agree (the existing pattern). Kotlin never hard-codes them: JavaScript passes them to the native module when it starts a service, and the module stores them for restarts after a reboot.

| Constant | Default | Used by | PRD |
| --- | --- | --- | --- |
| `BEACON_SERVICE_UUID` | generated once in DR2 (`crypto.randomUUID()`) | driver, commuter | 8.2 |
| `BEACON_PAYLOAD_VERSION` | 1 | all | 8.2 |
| `BEACON_SLOT_S` | 60 | all, SQL | 0.3 |
| `BEACON_SLOT_TOLERANCE` | 1 | SQL, tests | 0.3 |
| `BEACON_MAC_BYTES` | 4 | all | 8.2 |
| `BEACON_ADVERTISE_MODE` | `balanced` (about 250 ms) | driver | 9.2 |
| `BEACON_TX_POWER` | `medium` (tuned in E1) | driver | 9.2 |
| `BEACON_PRESENCE_S` | 3 | commuter | 0.3, 10.1 |
| `RSSI_MARGIN_DB` | 8 | commuter | 0.3, 10.1 |
| `ARMED_SCAN_MIN` | 15 | commuter | 0.3, 8.1 |
| `CLOCK_DRIFT_WARN_S` | 90 | driver | 8.2, 14 |
| `CLOCK_DRIFT_SAMPLES` | 5 (added in DR2) | driver | 14 |
| `BEACON_LOST_S` | 10 (added in DR2: a beacon not heard this long is gone; tuned in E1) | commuter | 10.1 |
| `HEATMAP_BAND_EDGES` | `[1, 5, 10]` (0, 1–4, 5–9, 10+) | driver | 9.4 |
| `DRIVER_SHOW_EXACT_COUNTS` | `true` (Q5) | driver | 9.4 |
| `DRIVER_NIGHT_BANDS_ONLY` | `true` (Q11) | driver | 10.4 |
| `DRIVER_INBOX_MAX` | 50 | driver (native inbox) | — |
| `SMS_TEXT_MAX_SEPTETS` | 160 | worker | 12.3 |
| `DATA_SMS_MAX_BYTES` | 133 (confirmed in DR5) | worker | 9.3 |
| `DATA_SMS_PORT` | chosen in DR2 (not a well-known port) | driver, gateway | 9.3 |
| `SMS_DISPATCH_MIN_CHANGE` | 2 | worker | 9.6 |
| `SMS_DISPATCH_INTERVAL_MIN` | 5 | worker | 9.6 |
| `SMS_OPERATING_START_MIN`, `SMS_OPERATING_END_MIN` | 300, 1260 (05:00 and 21:00 as minutes after midnight, Manila; Q6) | worker | 9.6 |
| `SMS_OUTBOX_TTL_MIN` | 10 (a stale count is worse than none; must stay under `SMS_MAX_AGE_MIN`) | worker | 12.3 |
| `SMS_CLAIM_LEASE_S` | 120 | worker | — |
| `SMS_SEND_MAX_ATTEMPTS` | 3 | worker | 14 |
| `WORKER_CYCLE_S` | 30 | worker | 13 |
| `GATEWAY_PULL_S` | 10 | gateway | 9.6 |
| `GATEWAY_SEND_GAP_MS` | 1500 | gateway | 16 risk 3 |
| `GATEWAY_SENT_TIMEOUT_S` | 30 | gateway | — |
| `GATEWAY_HEARTBEAT_S` | 60 | gateway | 9.6 |
| `GATEWAY_HEARTBEAT_ALERT_MIN` | 5 | worker | 14 |
| `GATEWAY_FAIL_ALERT_RATIO` | 0.05 | worker | 16 risk 3 |
| `SMS_LATENCY_P90_TARGET_S` | 60 | worker | 13 |
| `PROVISIONING_QR_TTL_MIN` | 15 | scripts, apps | 9.5 |
| `ADMIN_PIN_DIGITS` | 6 | driver, gateway | — |

Already present and reused: `RSSI_SMOOTHING_ALPHA`, `RSSI_PRESENCE_THRESHOLD_DBM`, `SMS_MAX_AGE_MIN`, `SMS_STALE_HEATMAP_MIN`, `SMS_SEQ_MODULUS`, `SMS_SEQ_NEWER_WINDOW`.

---

## 8. Security model

| Secret | Created by | Stored | Readable by | Rotation |
| --- | --- | --- | --- | --- |
| Vehicle beacon secret (32 bytes) | `provision-driver.ts` | Supabase Vault; driver phone (Keystore-encrypted) | `verify_beacon()` (security definer); the driver beacon service | `retire-device.ts` (it also replaces the beacon secret) + re-provision (runbook 11.5) |
| Driver SMS key (32 bytes) | `provision-driver.ts` | Vault; driver phone (Keystore-encrypted) | Worker (service role); driver app | Re-provision |
| Gateway token (32 bytes) | `provision-gateway.ts` | SHA-256 hash in `gateways`; gateway phone (Keystore-encrypted) | Worker compares hashes | `provision-gateway.ts --rotate` |
| Supabase service role key | Supabase dashboard | Worker host environment; Emjay's PC `.env` for the scripts | Worker, provisioning scripts | Dashboard |
| Admin PIN | Emjay at provisioning | Salted hash on the phone | — | Re-provision |

**Rules**

1. No secret is committed, logged or placed in a JavaScript store. `.env.example` lists the variable names with empty values. The worker logs mask phone numbers (`+63917•••4567`) and never print keys or tokens.
2. Every new table has Row Level Security on and **no client policies**. Only security-definer functions granted to `service_role` touch them. `verify_beacon` (DR8) is the only new function granted to `authenticated`, and it returns only the vehicle id, route and plate.
3. The SMS receivers require `android.permission.BROADCAST_SMS`, so only the system can deliver to them. The text receiver keeps only messages that start with `HM2|` and discards every other text without storing or logging it. **Personal SMS on the driver phone are never read beyond that prefix check.**
4. The driver and gateway apps block every location permission (`blockedPermissions`). The commuter app blocks the SMS, advertise and camera permissions. Each built APK's permissions are checked against an allowlist (DR1 task 8).
5. Honest limits (PRD 8.2): a rotating code raises the cost of cloning but does not stop an attacker who extracts a secret from a phone. Lost phones are retired at once (runbook 11.5).

---

## 9. Steps DR1 to DR9

### DR1: Variant foundation

**Goal.** Three installable apps from one codebase. The commuter app is unchanged in behaviour and permissions. The driver and gateway apps open to placeholder screens.

**Needs.** Q1, Q2 and Q8 (`expo-camera`, `expo-keep-awake` can wait until DR4) answered. Approval for the prebuild commands.

**Files**

| File | |
| --- | --- |
| `app.config.js` | new |
| `eas.json` | chg |
| `package.json` | chg: scripts only |
| `scripts/with-variant.js` | new |
| `plugins/withDriverAndroid.js`, `plugins/withGatewayAndroid.js` | new (empty shells now; filled in DR4, DR5, DR7) |
| `src/driver/app/_layout.tsx`, `src/driver/app/index.tsx` | new |
| `src/gateway/app/_layout.tsx`, `src/gateway/app/index.tsx` | new |
| `src/strings/en.ts` | chg: `driver`, `gateway` sections |
| `eslint.config.js` | chg: boundaries from section 5 |
| `scripts/variant-permissions.json`, `scripts/check-apk-permissions.ts` | new |

**Tasks**

1. **Router spike (Q2).** On a scratch branch, set `["expo-router", { "root": "./src/driver/app" }]` with `APP_VARIANT=driver` and confirm, before anything else: Metro serves the driver routes; the commuter build still serves `src/app`; `npx expo start --clear` is needed when switching. If it fails, switch to the single-tree fallback: `src/app/driver/…` and `src/app/gateway/…`, with the root layout redirecting by variant and lint keeping the trees apart. Record the result in STATUS.
2. **`app.config.js`.** It reads `APP_VARIANT` (default `commuter`), spreads `app.json` (`({ config }) => ({ ...config, … })`, as in the Expo variants guide) and overrides per variant:

   | | commuter | driver | gateway |
   | --- | --- | --- | --- |
   | `name` | Tunton APP | Tunton Driver | Tunton Gateway |
   | `android.package` | `com.tunton.app` | `com.tunton.driver` | `com.tunton.gateway` |
   | `scheme` | `tunton` | `tunton-driver` | `tunton-gateway` |
   | Router root | `src/app` | `src/driver/app` | `src/gateway/app` |
   | Plugins added | — | `./plugins/withDriverAndroid` | `./plugins/withGatewayAndroid` |
   | Plugins removed | — | none (see below) | none (see below) |
   | `blockedPermissions` | background location, `SEND_SMS`, `RECEIVE_SMS`, `READ_SMS`, `BLUETOOTH_ADVERTISE`, `CAMERA` | all location permissions | all location permissions |
   | `extra.appVariant` | `commuter` | `driver` | `gateway` |

   **Changed in the build (2026-10-12):** no plugin is removed from any variant. Every native module is linked into every variant, and removing the plugin that configures one (MapLibre, for example) could break the native build. Location is cut with `blockedPermissions` instead, and the APK check (task 8) proves it.

   Icons: same artwork for now, with a "D" or "G" badge on the adaptive icon later (DR9).
3. **`eas.json` profiles:** `development` and `preview` get `"env": { "APP_VARIANT": "commuter" }`. Add `development-driver`, `development-gateway`, `preview-driver` and `preview-gateway` (each `extends` its base and sets `APP_VARIANT`). Add `release-driver` and `release-gateway` (signed APKs, `distribution: internal`) for DR9.
4. **`scripts/with-variant.js`** (no dependencies): `node scripts/with-variant.js driver -- npx expo run:android`. It sets `process.env.APP_VARIANT` and spawns the command, so it works the same in PowerShell and bash. Add package.json scripts: `start:driver` (Metro on port 8082), `start:gateway` (port 8083), `android:driver`, `android:gateway`, `prebuild:driver`, `prebuild:gateway`.
5. **Placeholder screens:** the driver `index.tsx` shows "Tunton Driver: not provisioned"; the gateway shows "Tunton Gateway: not set up". Both use `ThemeProvider` and `strings`.
6. **Lint boundaries** from section 5. Add a test file in each tree that tries a forbidden import, run lint to confirm it fails, then remove the file.
7. **The `android/` folder** is regenerated per variant (`prebuild --clean`), because the package name differs. Document this in `docs/PARTNER_BUILD_GUIDE.md` (an existing reference doc) under a new "Variants" heading.
8. **Permission audit:** `scripts/check-apk-permissions.ts <variant> <apk | merged AndroidManifest.xml>` reads an APK with the SDK's `aapt2 dump permissions`, or reads the merged manifest that every local Gradle build writes (no SDK tools needed). It compares the result with `scripts/variant-permissions.json`, and fails on a forbidden permission, a missing required one, or any permission not yet reviewed. It runs on every APK from DR1 on. (Built 2026-10-12: aapt2 instead of `apkanalyzer`, since this PC's SDK has only platform-tools.)

**Tests**

- `src/shared/__tests__/variants.test.ts` loads `app.config.js` with each `APP_VARIANT` and checks: package names; the commuter config **equals today's** `app.json` result except for `extra.appVariant` (snapshot); each variant's blocked permissions; an unknown variant throws.

**Device scripts**

- **DR1-M1:** build and install all three on one emulator. Three icons appear with three names. Each opens: the commuter app as before (Map tab), the driver and gateway apps to their placeholders.
- **DR1-M2:** `check-apk-permissions` passes for all three APKs. The commuter APK's permissions equal the R1a build's.

**Accept.** DR1-M1 and DR1-M2 pass; the gates pass; the commuter app behaves exactly as before (ST1 checklist, spot check).

**Approvals.**
- `node scripts/with-variant.js driver -- npx expo prebuild --clean --platform android`, and the same for `gateway` and `commuter`.
- `node scripts/with-variant.js <variant> -- npx expo run:android` (local builds).

---

### DR2: Shared pure core

**Goal.** Every rule in section 6, implemented once in pure TypeScript and tested on fixtures, before any native code or database work.

**Needs.** DR1 (only for the lint config). No hardware.

**Files** (all new unless marked)

| File | Exports |
| --- | --- |
| `src/shared/beacon/code.ts` | `slotOf(ms)`, `encodeBeacon({ shortId, slot }, secretHex)`, `decodeBeacon(bytes)`, `verifyBeacon(bytes, secretHex, nowMs)` → `{ ok: true, slotOffset } \| { ok: false, reason: 'malformed' \| 'bad_version' \| 'bad_mac' \| 'expired' }`, `bytesToHex`, `hexToBytes` |
| `src/shared/beacon/presence.ts` | `updateBeacon(track, reading, nowMs)` (EMA via the existing `smoothRssi`), `isPresent(track, nowMs)`, `pickBeacon(tracks, nowMs)` → `{ kind: 'one', shortId } \| { kind: 'ambiguous' } \| { kind: 'none' }` |
| `src/shared/sms/gsm.ts` | `gsm7Septets(text)` (null for text outside GSM-7), `fitsSingleSms(text)` |
| `src/shared/sms/pack.ts` | `buildHeatmapTexts({ route, firstSeq, minuteOfDay, nodes }, keyHex)` → signed texts, split by septets; `stopsInOrder` reuses `inRouteOrder` |
| `src/shared/sms/binary.ts` | `encodeHeatmapBinary(text)`, `decodeHeatmapBinary(bytes)` → canonical text or null |
| `src/shared/sms/dispatch.ts` | `dispatchDecision(prev, counts, nowMs)` → `{ send: false } \| { send: true, reason: 'first' \| 'change' \| 'interval' \| 'cleared' }`; `inOperatingHours(nowMs)` |
| `src/shared/driver/heatmap.ts` | `emptyHeatmap(routeStops)`, `applyMessage(state, parsed, receivedAtMs)`, `heatmapBand(count)`, `isStale(state, nowMs)`, `displayCount(state, code, nowMs)` (applies Q5 and Q11) |
| `src/shared/driver/drift.ts` | `driftSample(deviceMs, smscMs)`, `driftStatus(samples)` (the **smallest** of the last 5, not the median, as built in DR2: delivery delay only ever makes a sample larger, so the fastest message says the most about the clock; `ok`, `warn` or `unknown`) |
| `src/shared/driver/phone.ts` | `normalizePhNumber(raw)` (`09…`, `639…`, `+639…` → E.164, else null) |
| `src/shared/driver/provisioning.ts` | `encodeProvisioning(payload)`, `parseProvisioning(text, nowMs)` → `{ ok, payload } \| { ok: false, reason }`, `hashAdminPin(pin, salt)` |
| `src/shared/config/index.ts` | chg: section 7 |
| `tests/fixtures/beacon-vectors.json` | 12 vectors: secret, shortId, slot, expected payload hex, plus checks at offsets −2 to +2 |
| `scripts/gen-beacon-vectors.ts` | writes the vectors file from `code.ts` (run once; committed output) |

**Tasks**

1. Generate `BEACON_SERVICE_UUID` and choose `DATA_SMS_PORT`. Add the section 7 constants.
2. Implement `code.ts` with `@noble/hashes` (already a dependency); write the vectors.
3. Implement the SMS modules. `pack.ts` must produce texts that the existing `validateHeatmap` accepts.
4. Implement the driver modules. `displayCount` returns `{ band, exact | null, unknown }`: a stop never heard from is `unknown`, not 0.
5. Implement provisioning and the admin PIN hash (SHA-256 of salt and PIN via `@noble/hashes`).

**Tests** (Jest `shared` project)

| File | Cases |
| --- | --- |
| `beaconCode.test.ts` | Every vector encodes exactly; decode round-trips; valid at offsets −1, 0, +1; **`expired` at −2 and +2** (PRD S1 and S7); a flipped MAC bit gives `bad_mac`; version 2 gives `bad_version`; 8 or 10 bytes give `malformed`; the slot wrap (`slotLow` 65535 → 0) is handled; a code from 65,536 slots ago fails though its `slotLow` matches |
| `beaconPresence.test.ts` | −60 then −70 smooths to −63.0 (PRD S1); present only after 3.0 s above −65 (2.9 s is not); a dip below the threshold restarts the clock; two beacons 9 dB apart → `one`; 7 dB apart → `ambiguous`; none above the threshold → `none` |
| `smsGsm.test.ts` | `\|` counts 2; ASCII letters and digits count 1; `€` counts 2; a non-GSM character gives null |
| `smsPack.test.ts` | R2's 18 stops with 1-digit counts → one message ≤ 160 septets; with 3-digit counts → two messages with consecutive sequence numbers, together covering every stop once; each output passes `validateHeatmap`; the sequence wraps 9999 → 0 |
| `smsBinary.test.ts` | Round trip to the identical text; 18 stops → 120 bytes ≤ 133; a truncated buffer or a bad magic byte → null; the decoded text's MAC still validates |
| `smsDispatch.test.ts` | `first`; a change of 1 → no send; a change of 2 → `change`; 4 min 59 s with counts → no send; 5 min → `interval`; all zero after non-zero → `cleared` once, then nothing; 21:00 and 04:59 → nothing (Q6); a midnight crossing |
| `driverHeatmap.test.ts` | Merge keeps unlisted stops; a split pair applies fully; bands at 0, 1, 4, 5, 9, 10; stale at 15:00.0 min, not at 14:59.9; `unknown` before any message; bands-only at 21:00 when `DRIVER_NIGHT_BANDS_ONLY` |
| `driverDrift.test.ts` | +95 s → `warn`; +85 s → `ok`; a delayed message does not raise a false warning; no samples → `unknown` |
| `driverPhone.test.ts` | `09171234567`, `639171234567` and `+639171234567` → `+639171234567`; landline or short codes → null |
| `provisioning.test.ts` | Round trip; expired → `expired`; wrong kind → `wrong_kind`; a secret of 63 hex characters → `malformed`; an `http://` worker URL → `insecure_url` |

**Accept.** All of the above pass; no magic numbers (lint); the gates pass. Nothing native, nothing live.

**Approvals.** None.

---

### DR3: Backend for the driver side

**Goal.** The database holds vehicles with short ids and beacon secrets, driver phones, gateways and the SMS outbox, with functions only the worker can call. Scripts provision and retire devices.

**Needs.** DR2. Q7 (which vehicles). The service role key on Emjay's PC for the scripts (never committed). Approval for `db push`.

**Files**

| File | |
| --- | --- |
| `supabase/migrations/20261013000000_driver_side.sql` | new |
| `supabase/cron/retention.sql` | chg |
| `supabase/seed.sql` | chg: `short_id` for the test vehicles |
| `src/shared/__tests__/migration.test.ts` | chg |
| `tests/integration/driverSide.test.ts` | new (skipped without `.env`) |
| `scripts/provision-driver.ts`, `scripts/provision-gateway.ts`, `scripts/retire-device.ts`, `scripts/admin-common.ts` | new |
| `.env.example` | chg: `SUPABASE_SERVICE_ROLE_KEY=` (empty; for the scripts and the worker only) |
| `docs/BACKEND_SETUP.md` | chg: a "Driver side" section |

**Migration contents**

1. `create extension if not exists pgcrypto with schema extensions;` and a check that `supabase_vault` is enabled (both are on by default in hosted projects; the migration fails loudly if not).
2. **As built (2026-10-12):** a server-only `vehicle_beacons` table (`vehicle_id`, `short_id` 1 to 65535, `secret_id` in Vault, `rotated_at`) instead of new columns on `vehicles`, because signed-in commuters can read `vehicles`. Short ids are given at provisioning, not seeded.
3. `driver_devices`: `device_id text primary key` (`^DRV-[0-9]{4}$`), `vehicle_id` (references `vehicles`), `phone_e164 text not null` (`^\+639[0-9]{9}$`), `sms_key_secret_id uuid not null`, `last_seq integer`, `active boolean default true`, `provisioned_at`, `retired_at`, `note`. Row Level Security on, no policies.
4. `gateways`: `gateway_id text primary key` (`^GW-[0-9]{2}$`), `token_hash text not null`, `phone_e164`, `active`, `last_heartbeat_at`, `last_status jsonb`. Row Level Security on, no policies.
5. `sms_outbox`: `id bigint identity`, `device_id`, `route_id`, `seq`, `encoding` (`text` or `data`), `body_text`, `body_b64`, `status` (`queued`, `claimed`, `sent`, `delivered`, `failed`, `expired`), `attempts`, `gateway_id`, `created_at`, `claimed_at`, `sent_at`, `delivered_at`, `expires_at`, `error`. An index on `(status, created_at)`. Row Level Security on, no policies.
6. `sms_dispatch_state`: `route_id` primary key, `last_counts jsonb`, `last_sent_at`.
7. `ops_alerts`: `id`, `kind`, `detail jsonb`, `created_at`, `resolved_at` (Q9).
8. Functions (security definer, `search_path = ''`, execute revoked from `public`, `anon` and `authenticated`, granted to `service_role`):

   | Function | Does |
   | --- | --- |
   | `worker_demand_snapshot()` | `route_id, station_code, waiting` for every live check-in (`expires_at > now()`), the same rule as `checkin_counts` |
   | `worker_devices()` | Active devices with route, phone and the **decrypted** SMS key (from `vault.decrypted_secrets`) |
   | `worker_next_seq(device text, n int)` | Reserves `n` sequence numbers atomically (mod 10,000); returns the first |
   | `worker_enqueue(rows jsonb)` | Inserts outbox rows and updates `sms_dispatch_state` in one transaction |
   | `worker_claim(gateway text, max int)` | Expires old queued rows, returns stale leases to the queue, then claims up to `max` with `for update skip locked` |
   | `worker_result(id bigint, status text, error text)` | Records sent, delivered or failed; re-queues failures under the attempt limit |
   | `worker_gateway_auth(token_hash text)` | Returns the active gateway id for a token hash, or null |
   | `worker_heartbeat(gateway text, status jsonb)` | Updates the gateway row |
   | `admin_provision_driver(...)` | Creates or updates the vehicle, gives it a new beacon secret, creates the device and its SMS key (both in Vault); refuses a second active phone; returns the device id, short id and gateway numbers |
   | `admin_provision_gateway(...)`, `admin_retire_device(device, new_beacon_secret)` | As named; retiring sets `active = false`, expires the phone's queued texts, overwrites its SMS key in Vault and (with a new secret) replaces the beacon secret. **As built:** this replaces the planned `admin_rotate_beacon` and `rotate-beacon.ts` |
   | `vault_put(name, value, description)` | Internal (granted to nobody): creates a Vault secret, or updates the one with that name, so a vehicle or device id provisioned again never collides |
9. **Retention** (`cron/retention.sql`): `sms_outbox` rows older than 7 days are deleted daily; `ops_alerts` older than 30 days.

**Scripts** (run on Emjay's PC with `npx tsx`; read `.env`; print no secrets except inside the QR)

- `provision-driver.ts --vehicle R4-001 --plate "ABC 123" --route R4 --phone 09171234567 [--short-id N]` makes 32-byte secrets with `crypto.randomBytes` and calls `admin_provision_driver`. It then prints the provisioning QR in the terminal with `qrcode-terminal` (Q8), along with the device id, vehicle and route. The admin PIN is prompted for and never echoed.
- `provision-gateway.ts --gateway GW-01 --phone … --worker-url https://…` prints the gateway QR. `--rotate` replaces the token.
- `retire-device.ts DRV-0001` (asks to confirm; also replaces the vehicle's beacon secret with one nobody holds).
- **As built:** the gateway QR accepts `http://localhost` or `http://127.0.0.1` as the worker address for development over USB (`adb reverse`); every other address must be HTTPS.

**Tests**

- `migration.test.ts` (static): Row Level Security on for all five new tables; no `create policy` on them; every `worker_*` and `admin_*` function is `security definer` with an empty `search_path`; execute revoked from `public`, `anon` and `authenticated`; the dispatch and beacon constants in SQL equal the config ones.
- `driverSide.test.ts` (live, skipped without `.env`): a signed-in commuter calling `worker_demand_snapshot` or reading `driver_devices` is **denied**. Service role: provision a test device, reserve 3 sequence numbers twice and get consecutive ranges, enqueue then claim then result through every state, run a lease expiry, retire the device. It cleans up after itself.

**Accept.** Static and live tests pass. A provisioning QR printed for a test vehicle parses with `parseProvisioning`.

**Approvals.**
- `npx supabase db push` (after `npx supabase db push --dry-run` shows only `20261013000000_driver_side.sql` pending).
- Pasting the updated `retention.sql` jobs in the SQL editor.
- `npm install --save-dev qrcode-terminal` (dev only; it ships in no app).

---

### DR4: Driver app, provisioning and BLE beacon (PRD S6)

**Goal.** A driver phone is provisioned by QR and advertises the rotating signed code from a foreground service that survives screen-off, Bluetooth toggles and reboots.

**Needs.** DR1 to DR3. Two Android phones (driver and scanner). Q8 (`expo-camera`, `expo-keep-awake`, `expo-battery`) and Q12.

**Files**

| File | |
| --- | --- |
| `modules/tunton-beacon/` | new, via `npx create-expo-module@latest --local`; **delete its `ios/` folder** and set `"platforms": ["android"]` in `expo-module.config.json` (Android only) |
| `.../TuntonBeaconModule.kt` | JS API: `isPeripheralSupported()`, `provision(json)`, `clearProvisioning()`, `getProvisioning()` (non-secret fields), `startAdvertising(options)`, `stopAdvertising()`, `getStatus()`, event `onStatus` |
| `.../BeaconAdvertiserService.kt` | Foreground service, type `connectedDevice`; one `AdvertisingSet`; scan response updated at each slot boundary (`Handler.postAtTime`, aligned to the wall clock); restarts on `BluetoothAdapter.ACTION_STATE_CHANGED`; notification "Tunton beacon on" |
| `.../BeaconCode.kt` | `javax.crypto.Mac` (`HmacSHA256`); the same layout as `code.ts` |
| `.../SecretStore.kt` | AES-GCM key in the Android Keystore; encrypted secrets in private `SharedPreferences` |
| `.../BootReceiver.kt` | `BOOT_COMPLETED` → restart the service if provisioned and enabled |
| `.../src/test/.../BeaconCodeTest.kt` + `src/test/resources/beacon-vectors.json` | JUnit against the shared vectors |
| `modules/tunton-beacon/index.ts` | Typed wrapper |
| `plugins/withDriverAndroid.js` | chg: permissions `BLUETOOTH_ADVERTISE`, `BLUETOOTH` and `BLUETOOTH_ADMIN` (`maxSdkVersion` 30), `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`, `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS`, `CAMERA`; declares the service (`foregroundServiceType="connectedDevice"`, not exported) and the boot receiver |
| `src/driver/app/_layout.tsx` | chg: redirects to `/provision` when not provisioned; `useKeepAwake` |
| `src/driver/app/provision.tsx` | new: scan → confirm → permissions → self-test |
| `src/driver/app/index.tsx` | chg: beacon status card (the heatmap comes in DR5) |
| `src/driver/app/admin.tsx` | new: behind the PIN; re-provision, wipe, beacon on or off, show the current code |
| `src/driver/features/provisioning/*`, `src/driver/features/status/StatusStrip.tsx` | new |
| `src/driver/state/driverStore.ts` | new: non-secret provisioning fields, beacon enabled flag; persisted with `partialize` and a defensive `merge` like the other stores |
| `src/shared/__tests__/beaconVectorsSync.test.ts` | new: the Kotlin test resource equals `tests/fixtures/beacon-vectors.json` byte for byte |

**Tasks**

1. Create the module and remove `ios/`. Keep the module's own `AndroidManifest.xml` free of permissions and components, so the commuter app gets none of them; everything goes through `withDriverAndroid.js`.
2. `SecretStore` and `provision(json)`: the module receives the parsed payload, stores the two secrets encrypted and returns only success. The secrets never return to JavaScript.
3. The advertiser service (see the file table). `startAdvertising(options)` receives the UUID, slot length, version, mode and power from JavaScript config, and stores them for boot restarts.
4. Status reporting: `getStatus()` returns `{ supported, bluetoothOn, advertising, lastSlot, lastError, provisioned }`; `onStatus` fires on change.
5. **Provisioning screen**, one thing per screen in large type:
   1. "Scan the setup code": camera (`expo-camera`, QR only). `parseProvisioning`, then refuse with a plain reason if expired or malformed.
   2. Confirm vehicle, plate and route ("Is this the vehicle this phone is mounted in?").
   3. Permissions one at a time with a short reason before each system prompt (PRD 4.2 pattern): Nearby devices, Notifications. SMS comes in DR5.
   4. Set the admin PIN (Q12).
   5. **Self-test:** "This phone can act as a beacon" (`isPeripheralSupported`, else stop with "This phone cannot be used as a beacon. Use another model."); Bluetooth on; the advertiser starts; "Now check the second phone" (DR4-M2).
6. **Status strip** (PRD 9.4) on the home screen: Bluetooth or beacon state, battery and charging (`expo-battery`). The last-SMS and clock fields arrive in DR5. The admin entry is a 3-second long-press on the strip, then the PIN.
7. **Road safety** (PRD 15.3): the home screen has **no required interaction**. Nothing on it asks the driver to tap.

**Tests**

- JUnit `BeaconCodeTest` (run with `cd android; .\gradlew.bat :tunton-beacon:testDebugUnitTest` after prebuild): every shared vector matches.
- Jest: `beaconVectorsSync.test.ts`; `driverStore.test.ts` (persist and merge, no secret fields); `provisionFlow.test.tsx` (app project; mocks the native module): an expired QR shows the reason, a valid QR reaches confirmation, an unsupported phone stops at the self-test.

**Device scripts**

| ID | Script | Expected |
| --- | --- | --- |
| DR4-M1 | Provision phone A from a QR printed by `provision-driver.ts` | Vehicle, plate and route confirmed; self-test passes; notification "Tunton beacon on" |
| DR4-M2 | On phone B, nRF Connect → Scanner, filter by `BEACON_SERVICE_UUID` | The device appears; the service data is 9 bytes; **it changes within 60 s and at each minute boundary** (PRD S6 acceptance) |
| DR4-M3 | Copy one payload from B into `npx tsx scripts/decode-beacon.ts <hex> --vehicle R4-001` (service role) within 60 s; repeat with a payload 3 minutes old | First: valid, offset 0; second: `expired` |
| DR4-M4 | Screen off on A for 30 min | B still sees the beacon throughout; record the battery drop and the phone's temperature |
| DR4-M5 | Turn Bluetooth off for 1 min, then on | The status strip shows Bluetooth off; advertising resumes within 10 s of turning it on |
| DR4-M6 | Reboot A, unlock it | Advertising resumes without opening the app (note the time to resume) |
| DR4-M7 | Force-stop the app from Android settings | Record what happens (expected: advertising stops until the app is opened; the vendor note goes to DR9) |
| DR4-M8 | Install on a phone without peripheral support, if one is available | Self-test stops with the "cannot be used" message |

**Accept.** DR4-M1, M2, M3, M5 and M6 pass on two real phones. JUnit and Jest pass. `check-apk-permissions` passes for driver and commuter.

**As built (2026-10-12):**
- The module was written by hand in the shape `create-expo-module --local` produces (that command asks its questions interactively); autolinking finds it.
- The **SMS key can be read back** by JavaScript (`getSmsKey`), because the heatmap is validated in TypeScript (DR5). The beacon secret can still only be written.
- The admin PIN is chosen on the PC when the setup code is printed (DR3's script), so the phone has no PIN step.
- `expo-camera`'s plugin is set to `recordAudioAndroid: false`, and `RECORD_AUDIO` is blocked in all three apps.
- The Kotlin code is unverified until the first EAS build compiles it (backlog 93).

**Approvals.**
- `npx create-expo-module@latest --local` (name `tunton-beacon`).
- `npx expo install expo-camera expo-keep-awake expo-battery`.
- Driver development build: `npx eas-cli@latest build --profile development-driver --platform android`, or the local `android:driver` script.

---

### DR5: Driver SMS receiver and heatmap, plus the carrier spike

**Goal.** The driver phone receives signed heatmap messages (data SMS first, text SMS as fallback), validates them, and shows a glanceable offline heatmap of its route that greys out after 15 minutes. The carrier test for data SMS (PRD 16 risk 4, "test in week 1") runs in this step, before the worker exists.

**Needs.** DR4. A SIM in the driver phone and a SIM in a second phone (the future gateway). Q5, Q11.

**Files**

| File | |
| --- | --- |
| `modules/tunton-sms/` | new, via `create-expo-module --local`; `ios/` deleted; Android only |
| `.../SmsReceiver.kt` | Two receivers: `DATA_SMS_RECEIVED` with `<data android:scheme="sms" android:host="*" android:port="DATA_SMS_PORT"/>`, and `SMS_RECEIVED` (text, prefix `HM2\|` only). Both require `android.permission.BROADCAST_SMS` and are exported (system broadcasts) |
| `.../InboxStore.kt` | Ring of `DRIVER_INBOX_MAX` entries `{ kind: data\|text, sender, body (text or base64), smscMs, receivedMs }` in private storage; `drain()` returns and clears; event `onHeatmapSms` when JavaScript is alive |
| `.../SmsSender.kt` | `sendText(to, text)`, `sendData(to, port, bytes)` with sent and delivery `PendingIntent`s, per SIM subscription; used by the spike screen now and the gateway in DR7 |
| `.../TuntonSmsModule.kt`, `modules/tunton-sms/index.ts` | JS API: `drainInbox()`, `onHeatmapSms`, `sendText`, `sendData`, `listSims()`, events `onSendResult` |
| `plugins/withDriverAndroid.js` | chg: `RECEIVE_SMS`; the two receivers |
| `plugins/withGatewayAndroid.js` | chg (spike): `SEND_SMS`, `READ_PHONE_STATE` (SIM choice) |
| `src/gateway/app/spike.tsx` | new, **development builds only**: send a signed test text or data SMS to a number, show sent and delivery results |
| `src/driver/state/heatmapStore.ts` | new: `HeatmapState` from `shared/driver/heatmap`, last sequence, last accepted time, rejection counters per reason, drift samples; persisted |
| `src/driver/features/heatmap/useHeatmapInbox.ts` | new: drains on start, on `onHeatmapSms` and on return to the foreground; for each entry: `normalizePhNumber`, sender check, `decodeHeatmapBinary` for data SMS, `validateHeatmap`, then `applyMessage`; records a drift sample from the SMSC time even for rejected messages (a wrong clock is exactly when messages fail) |
| `src/driver/features/heatmap/HeatmapMap.tsx` | new: static MapLibre map (the bundled tiles) of the vehicle's route, framed once, gestures off; a glowing node per stop sized by band (PRD 9.4); grey when stale |
| `src/driver/features/heatmap/HeatmapList.tsx` | new: stops in riding order (`inRouteOrder`) with a large band chip and, per Q5 and Q11, the exact count |
| `src/driver/app/index.tsx` | chg: status strip, map (top half), list (bottom half); "Updated 3 min ago" or "No update for 17 min" |
| `src/driver/app/admin.tsx` | chg: recent accepted and rejected messages with reasons (no bodies of other SMS exist to show) |
| `scripts/sms-sign.ts` | new: `npx tsx scripts/sms-sign.ts --route R4 --seq 12 --key <hex> SMB:3,ZAM:0` prints a signed text for emulator tests (development keys only) |

**Tasks**

1. Build the module and both receivers. Check on the emulator that a non-`HM2|` text is ignored and not stored.
2. **Carrier spike (E7-lite).** From the gateway development build's spike screen, send to the driver phone on the pilot carrier:
   1. 20 data SMS to `DATA_SMS_PORT`;
   2. 20 text SMS;
   3. 5 data SMS to a SIM on another network, only if some driver SIMs end up off Smart/TNT.

   Record: received or not, latency (sent to receivedMs), whether anything appears in the driver phone's inbox or notifications, and the largest data payload that arrives (to confirm `DATA_SMS_MAX_BYTES`). **The result chooses the primary path for DR6 (`SMS_PRIMARY_ENCODING`).**
3. The inbox hook, stores and validation as listed.
4. The heatmap screens. Large type (minimum 20 sp for counts), 48 dp targets, readable in sunlight: high-contrast tokens from `DESIGN.md`. **Never a "No demand" message when the truth is "No update"** (PRD 2.3 spirit).
5. Status strip complete: beacon, last update age, clock (`ok`, "Clock off by 2 min", `unknown`), battery.
6. Provisioning gains the SMS permission step ("To receive waiting counts by text").

**Tests**

- Jest `useHeatmapInbox.test.ts` (app project, module mocked): a wrong sender is dropped and counted; a bad signature, stale time or old sequence each counted by reason; a valid data SMS decodes and applies; a split pair applies; a stale clock still records drift.
- Jest `heatmapScreen.test.tsx`: unknown stops grey; stale after 15 min; night shows bands only.

**Device scripts**

| ID | Script | Expected |
| --- | --- | --- |
| DR5-M1 (emulator) | Provision the driver app with a development QR whose gateway number is the emulator's sender; `adb emu sms send <number> "<output of sms-sign.ts>"` | The heatmap shows the counts within 2 s |
| DR5-M2 (emulator) | Send the same message again; one with a changed MAC character; one from another number; one with a time 40 min off | Each dropped; admin shows `old_sequence`, `bad_signature`, `wrong_sender`, `stale_time` (PRD S9 acceptance) |
| DR5-M3 (emulator) | No message for 15 min | The heatmap greys and shows the age (PRD S9 acceptance) |
| DR5-M4 (emulator) | Kill the app; send a valid message; open the app | The message is applied on open (native inbox) |
| DR5-M5 (two phones) | The carrier spike (task 2) | Results table recorded in `device-tests.md` |
| DR5-M6 (phone) | Send an ordinary personal text to the driver phone | It is not shown, stored or counted by the app |

**Accept.** DR5-M1 to M4 and M6 pass; DR5-M5 is recorded and the primary path is chosen with Emjay.

**Approvals.**
- `npx create-expo-module@latest --local` (name `tunton-sms`).
- Driver and gateway development builds.

---

### DR6: Node.js SMS worker

**Goal.** A long-running worker turns live check-in counts into signed per-phone messages using the dispatch rule, queues them, serves them to the gateway over HTTPS, and watches gateway health. Verified end to end with a fake gateway, no phones.

**Needs.** DR2, DR3 applied live. Q3, Q6, Q9. Q8 (`esbuild`).

**Files** (all new unless marked)

| File | |
| --- | --- |
| `services/sms-worker/src/main.ts` | Starts the cycle timer and the HTTP server; shuts down cleanly on SIGTERM |
| `services/sms-worker/src/env.ts` | Reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `SMS_PRIMARY_ENCODING`; refuses to start if one is missing; never prints values |
| `services/sms-worker/src/deps.ts` | `WorkerDeps` interface (snapshot, devices, nextSeq, enqueue, claim, result, gatewayAuth, heartbeat, alert, now, log), the same injection pattern as `handleIngest` |
| `services/sms-worker/src/cycle.ts` | `runCycle(deps)`: snapshot → per route `dispatchDecision` → per active device on the route: reserve sequence numbers, `buildHeatmapTexts` with that device's key, encode as data or text → `enqueue` |
| `services/sms-worker/src/http.ts` | `handleRequest(method, path, headers, body, deps)` → `{ status, body }`; the four routes in section 6.4; body size limit 4 KB; token hashed before lookup |
| `services/sms-worker/src/health.ts` | Each cycle: heartbeat gap > 5 min, failure ratio over the last hour > 5 %, p90 latency (`created_at` → `sent_at`) > 60 s → one `ops_alerts` row per condition per hour (dashboard only, Q9) |
| `services/sms-worker/src/supabaseDeps.ts` | The real `WorkerDeps` over the `worker_*` functions with `@supabase/supabase-js` (service role); key cache refreshed every 10 min |
| `services/sms-worker/src/mask.ts` | Phone masking for logs |
| `services/sms-worker/__tests__/*.test.ts` | See Tests |
| `services/sms-worker/README.md` | Run, build, deploy, environment, how to read the logs |
| `scripts/run-worker.ps1` | Starts the bundled worker and restarts it after a crash; no dependencies (Q3) |
| `scripts/fake-gateway.ts` | Pulls every 10 s with a development gateway token, prints masked destinations and message texts, posts `sent`, then `delivered` |
| `package.json` | chg: `worker:dev` (`tsx services/sms-worker/src/main.ts`), `worker:build` (esbuild bundle to `services/sms-worker/dist/worker.cjs`, Node target) |
| `jest.config.js` | chg: the `shared` project also matches `services/sms-worker/**/__tests__/**/*.test.ts` |
| `eslint.config.js` | chg: Node globals for `services/**`; boundaries from section 5 |
| `.gitignore` | chg: `services/sms-worker/dist/` |

**Tasks**

1. Deps and `cycle.ts` with fake deps first (pure tests), then `supabaseDeps.ts`.
2. HTTP with Node's built-in `node:http` (no web framework). JSON only; a request without a valid token gets 401 with no detail.
3. Health and alerts.
4. The esbuild bundle: one file, no `node_modules` on the host; Node 22 or 24 LTS.
5. **Deployment on the team PC (Q3).** Write the steps in the README:
   - Node 22 or 24 LTS on the PC; the environment in a local `.env` for the worker that is never committed;
   - a start script that restarts the worker if it crashes (`scripts/run-worker.ps1`, a loop with no dependencies), started at Windows sign-in with Task Scheduler;
   - HTTPS through a **Cloudflare Tunnel** (`cloudflared`, installed on the PC only, not a project dependency) for the pilot; `adb reverse` for development;
   - Windows sleep turned off during SMS hours (05:00–21:00);
   - `GET /healthz` to check it from a phone browser.
6. Local development: `npm run worker:dev`, then `npx tsx scripts/fake-gateway.ts`.

**Tests** (Jest `shared` project, fake deps)

| File | Cases |
| --- | --- |
| `cycle.test.ts` | No check-ins → nothing queued; 3 waiting at SMB on R4 with two R4 devices → two rows, different sequence numbers and MACs, each valid with its own key; a change of 1 → nothing; a split route → two rows per device with consecutive sequence numbers; outside hours → nothing; a device on R3 gets nothing for R4 |
| `http.test.ts` | No token → 401; a wrong token → 401; pull returns at most `max`; result `failed` re-queues until the attempt limit; heartbeat updates; `/healthz` needs no token and returns no data; a 5 KB body → 413 |
| `health.test.ts` | A heartbeat gap of 5 min 1 s → one alert; a repeat within the hour → no new alert; a 6 % failure ratio → alert; p90 latency 61 s → alert |
| `mask.test.ts` | `+639171234567` → `+63917•••4567`; non-numbers unchanged |

**Device scripts**

| ID | Script | Expected |
| --- | --- | --- |
| DR6-M1 | Worker and fake gateway on the PC, against the live project; the commuter emulator (signed in, Demo data off) checks in at SMB on R4 | Within 40 s the fake gateway prints one message per active R4 test device, with SMB:1; `sms-sign`'s validator (or the driver emulator via `adb emu sms send`) accepts it |
| DR6-M2 | End the check-in ("I boarded") | A `cleared` message follows (SMB:0) within the next cycle |
| DR6-M3 | Stop the fake gateway for 6 minutes | One `gateway_heartbeat` row in `ops_alerts`, visible in the dashboard |
| DR6-M4 | Leave a check-in for 12 min with no gateway | Queued rows become `expired` after 10 min; no backlog is sent when the gateway returns |

**Accept.** DR6-M1 to M4 pass; the worker logs show no full number, key or token (search the log file for `+639` followed by 9 digits).

**Approvals.**
- `npm install --save-dev esbuild` (dev only).
- Running the worker against the live project (it uses the service role key).
- Installing `cloudflared` on the team PC and creating the tunnel (Q3).

---

### DR7: Gateway app and the first end-to-end run (PRD S9)

**Goal.** A dedicated gateway phone pulls from the worker, sends each message by SMS, reports results and heartbeats from a foreground service that runs for days. Commuter check-in to driver heatmap works end to end on real phones.

**Needs.** DR5 (the `tunton-sms` sender), DR6 deployed or reachable. The gateway phone and SIM (DR0). Q4.

**Files**

| File | |
| --- | --- |
| `modules/tunton-sms/.../GatewayService.kt` | new: foreground service, type **`specialUse`** with a `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` explanation (see note); loop: pull every `GATEWAY_PULL_S` → for each message send, wait for the sent result (≤ `GATEWAY_SENT_TIMEOUT_S`), post the result, wait `GATEWAY_SEND_GAP_MS` → heartbeat every `GATEWAY_HEARTBEAT_S`; delivery reports posted when they arrive; backoff (10 s, 30 s, 60 s, 120 s cap) when the worker is unreachable |
| `.../WorkerClient.kt` | HTTPS with the OkHttp already bundled by React Native; bearer token from `SecretStore` |
| `.../GatewayStore.kt` | Worker URL, gateway id, token (encrypted), chosen SIM, counters for today, last 100 events (masked numbers) |
| `.../GatewayBootReceiver.kt` | Restarts the service after reboot if set up and enabled |
| `TuntonSmsModule.kt` | chg: `gatewaySetup(json)`, `gatewayStart()`, `gatewayStop()`, `gatewayStatus()`, `gatewayEvents()`, event `onGatewayStatus` |
| `plugins/withGatewayAndroid.js` | chg: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`, `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS`, `CAMERA`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`; the service and receiver; in **development builds only**, a network security config allowing cleartext to `localhost` (for `adb reverse`) |
| `src/gateway/app/setup.tsx` | new: scan the gateway QR → permissions (SMS, notifications) → battery optimisation exemption → choose SIM → "Send test SMS" to a team number → start |
| `src/gateway/app/index.tsx` | chg: service running; worker reachable; last pull; sent, delivered and failed today; last error; battery and charging (`expo-battery`); SIM; Start/Stop behind the PIN |
| `src/gateway/app/log.tsx` | new: the last 100 events |
| `src/gateway/state/gatewayStore.ts` | new: non-secret fields only |

**Note on the service type.** Android 14 requires a declared foreground service type. Android 15 limits `dataSync` services to about 6 hours a day and stops them from starting at boot. A gateway runs all day, so it uses `specialUse`. That type is acceptable here because the gateway is a sideloaded APK on one team phone (PRD 15.2), not a Play Store app. Check this against the phone's Android version in DR7-M4.

**Tasks**

1. The service and client. All network and SMS work happens in Kotlin, because a JavaScript timer stops when the screen is off. JavaScript only sets up, starts, stops and displays.
2. Setup flow and status screens.
3. **Phone preparation** (written into runbook 11.3):
   1. Turn off battery optimisation for the app.
   2. Keep it on the charger.
   3. Turn on auto time.
   4. Turn off the screen lock, or use pinning.
   5. Turn off Messages notifications, so sent copies don't pile up.
   6. **Raise Android's outgoing-SMS limiter:**
      ```
      adb shell settings put global sms_outgoing_check_max_count 2000
      adb shell settings put global sms_outgoing_check_interval_ms 1800000
      ```
      Read both back with `settings get`. Check on the device that it works; some vendors ignore it, so DR7-M3 measures it.
4. **End to end.** Commuter app check-in → worker (the team PC, through `adb reverse tcp:8787 tcp:8787` or the Cloudflare Tunnel) → gateway → driver phone.

**Tests**

- Jest `gatewaySetup.test.tsx` (module mocked): an `http://` worker URL is refused in a release config; an expired QR is refused; Start is disabled until the SMS permission is granted.
- JUnit `BackoffTest.kt`: the backoff sequence and cap.

**Device scripts**

| ID | Script | Expected |
| --- | --- | --- |
| DR7-M1 | Set up the gateway from its QR; "Send test SMS" to a team phone | Arrives; the result shows Sent, then Delivered |
| DR7-M2 | **End to end:** commuter phone checks in at a stop on the driver's route | The driver heatmap shows it; record the time from tapping Check in to the heatmap update over 20 trials; **p90 ≤ 60 s** (PRD 13) |
| DR7-M3 | Queue 80 messages in 10 min (a script check-ins and clears on a test route) | All sent without an Android "allow sending many messages?" prompt; if the prompt appears, the limiter setting did not take: record the vendor |
| DR7-M4 | Gateway screen off for 8 h on the charger | Heartbeats continuous in `gateways.last_heartbeat_at`; no alert |
| DR7-M5 | Turn on airplane mode on the gateway for 10 min during demand | Alert after 5 min; messages expire after 10 min; after reconnect only fresh messages are sent |
| DR7-M6 | Reboot the gateway | The service resumes without opening the app; record the time |
| DR7-M7 | Remove the SIM for 2 min | Sends fail with an error code; re-queued; resume after the SIM returns; failure alert if over 5 % |

**Accept.** DR7-M1 to M4 and M6 pass; M2's p90 is recorded (passing or not, as PRD 0.2 S10 requires).

**Approvals.**
- Gateway development and preview builds.
- The Cloudflare Tunnel on the team PC (if not done in DR6).
- The `adb shell settings` commands on the gateway phone.

---

### DR8: Commuter boarding detection (PRD S7, without the verification window)

**Goal.** When a commuter opens Relay inside a multicab, the app hears the beacon, applies the presence and margin rules, asks the server whether the code is valid, and fills the vehicle and route by itself (the `useBleVehicle` slot from B4). A confirmed boarding on the route of an active check-in ends that check-in, so the driver heatmap drops (PRD 7.5 auto-cancel).

**Needs.** DR3, DR4. Two phones. Q10. The DPO note on Bluetooth scanning (DR0).

**Files**

| File | |
| --- | --- |
| `modules/tunton-beacon/.../BeaconScanner.kt` | new: `ScanFilter` on the service UUID; `SCAN_MODE_LOW_LATENCY` while the Relay panel is open, `LOW_POWER` otherwise while armed; stops after `ARMED_SCAN_MIN`; emits `{ payloadHex, rssi, atMs }` |
| `TuntonBeaconModule.kt` | chg: `startScan(options)`, `stopScan()`, event `onBeacon` |
| `plugins/withCommuterBle.js` | new: `BLUETOOTH_SCAN` **without** `neverForLocation` (with that flag Android filters beacons out of results), `BLUETOOTH` and `BLUETOOTH_ADMIN` with `maxSdkVersion` 30. Scanning on Android 11 and older also needs location, which the commuter app already asks for with consent (G0) |
| `app.config.js` | chg: the commuter variant adds `withCommuterBle` |
| `supabase/migrations/20261014000000_beacon_verify.sql` | new: `verify_beacon(payload_hex text)` (security definer; decodes, finds the vehicle by short id, reads the secret from Vault, checks with `extensions.hmac(…, 'sha256')` at offsets −1 to +1; returns `vehicle_id, route_id, plate` or raises `beacon_expired`, `beacon_invalid` or `unknown_vehicle`; at most 30 calls a minute per user); `post_report` gains an optional `beacon text` argument stored as `feed_posts.beacon_ok boolean` |
| `src/services/beacon.ts` | new: the `verify_beacon` port |
| `src/features/report/useBleVehicle.ts` | chg: arms the scan when the Relay panel opens; feeds readings to `shared/beacon/presence`; on `one` calls `verify_beacon` once per vehicle per slot; returns the `BleVehicle` |
| `src/features/report/ReportSheet.tsx` | chg: the Bluetooth card (already laid out in B4) shows "On R4 · ABC 123" and hides the manual pickers; `ambiguous` shows "Two multicabs nearby: pick yours" with the manual pickers |
| `src/features/checkin/…` | chg: a verified boarding on the route of the active check-in calls `end_check_in` |
| Permission explainer | chg: a "Nearby devices" explainer before the system prompt (PRD 4.2); declining keeps the manual pickers |
| `src/strings/en.ts`, `docs/device-tests.md` | chg |

**Tests**

- `migration.test.ts`: `verify_beacon` is security definer, granted to `authenticated` only, and the SQL constants match the config.
- Live `driverSide.test.ts`: **the shared vectors' payloads at offset 0 are accepted and at offset ±2 are rejected by the real function** (the server clock is fixed by computing the payload from `now()` in the test); an unknown short id → `unknown_vehicle`.
- Jest `useBleVehicle.test.ts` (module and port mocked): presence after 3 s → verify called once; a second slot → verified again; ambiguous → manual; verify failure → manual with a message; the panel closing stops the scan.

**Device scripts**

| ID | Script | Expected |
| --- | --- | --- |
| DR8-M1 | Phone B (commuter, signed in, live data) opens Relay 1 m from phone A (driver) | The Bluetooth card shows the vehicle within **10 s** (PRD S7 acceptance); the manual pickers are hidden |
| DR8-M2 | Replay: take a payload from DR4-M3 that is 3 minutes old and call `verify_beacon` with it | `beacon_expired` (PRD S7: two or more slots old rejected) |
| DR8-M3 | Two driver phones side by side, B between them | Ambiguous → manual pickers; moving B next to one gives `one` |
| DR8-M4 | B checked in on R4 at a stop; open Relay next to the R4 driver phone | The check-in ends; the next heatmap message to the driver shows the count lower |
| DR8-M5 | Decline Nearby devices | The manual pickers work as before |

**Accept.** DR8-M1, M2 and M5 pass; M3 and M4 recorded.

**Approvals.**
- `npx supabase db push` for `20261014000000_beacon_verify.sql`.
- A commuter development build (new permissions; this is the R1b rebuild named in the master plan §5).

---

### DR9: Hardening, field experiments and pilot readiness (PRD S10, driver parts)

**Goal.** Thresholds measured, not assumed; the three apps signed and checksummed; runbooks rehearsed; the pilot can start.

**Needs.** DR4 to DR8. Vehicles, the cooperative's agreement and the written SMS terms (DR0).

**Field experiments** (PRD 17.1; each gets a script in `device-tests.md` and a results table)

| # | Experiment | Driver-side focus | Output |
| --- | --- | --- | --- |
| E1 | BLE RSSI inside a multicab | Driver phone mounted on the dashboard; commuter phones at 5 seats in pocket, bag and hand; windows open and closed; ≥ 300 samples each; `BEACON_TX_POWER` low, medium and high | `RSSI_PRESENCE_THRESHOLD_DBM`, `RSSI_SMOOTHING_ALPHA`, `BEACON_TX_POWER` |
| E2 | Terminal collision | 2 to 4 same-route multicabs side by side at SM City | `RSSI_MARGIN_DB`; the ambiguous rate |
| E4-D | Driver phone heat and battery | 8 h on the dashboard charger in daytime sun, beacon on, screen on with keep-awake vs. dimmed | Whether the screen stays on; charger requirements |
| E5-D | Background survival | Driver beacon service and gateway service on every phone brand in use, 12 h screen-off | The vendor setup guide (runbook 11.2) |
| E7 | SMS path, 7 days | Gateway in production mode, all driver phones, the chosen primary encoding | Delivery ≥ 98 %, p90 latency ≤ 60 s (PRD 13, 17.3); the volume actually sent and its cost |

**Release tasks**

1. Release signing for `com.tunton.driver` and `com.tunton.gateway` (EAS-managed keystores; `release-driver` and `release-gateway` profiles). Publish the SHA-256 checksum of every APK given to the cooperative (PRD 15.2).
2. Adaptive icons with a "D" and "G" badge so the three apps are told apart.
3. `check-apk-permissions` on all three release APKs.
4. Driver phone set-up (runbook 11.2), on every pilot phone.
5. The driver information sheet and the cooperative onboarding session (PRD 4.3).
6. The post-pilot driver survey (PRD 3.3: "changed at least one dispatch decision").

**Accept.** E1, E2 and E7 measured and recorded, even if a target is missed (PRD 0.2 S10); release APKs signed and checksummed; runbooks 11.1 to 11.7 rehearsed once each.

**Approvals.** Every release build; any change to thresholds (they are config constants, changed in one commit with the measurement cited).

---

## 10. Order, dependencies and effort

```text
DR0 (paperwork, phones, SIMs) ─────────────────────────────────────────────▶ DR9
DR1 ─▶ DR2 ─▶ DR3 ─▶ DR4 ─▶ DR5 ─▶ DR6 ─▶ DR7 ─▶ DR9
                      │                          ▲
                      └────────▶ DR8 ────────────┘
```

| Step | Agent effort (working days, estimate) | Waits mostly on | Can overlap with |
| --- | --- | --- | --- |
| DR0 | — | Purchases, carrier, cooperative, DPO | Everything |
| DR1 | 1–2 | Router spike, builds | DR0 |
| DR2 | 2 | — | DR0 |
| DR3 | 2 | `db push` approval | DR2's tests |
| DR4 | 3–4 | Two phones | DR6's pure code |
| DR5 | 3 | SIMs; the carrier spike | DR6 |
| DR6 | 3 | Team PC set-up and tunnel | DR5 |
| DR7 | 3–4 | Gateway phone and SIM | DR8 |
| DR8 | 3 | Two phones; DPO note | DR7 |
| DR9 | 2–3 weeks elapsed | Vehicles, cooperative, 7-day trial | — |

**Critical path for a demonstrable driver heatmap:** DR1 → DR2 → DR3 → DR5 → DR6 → DR7. The beacon (DR4, DR8) can be shown separately, with two phones and no SIM.

**Order challenge.** If phones arrive before SIMs, do DR4 before DR5 as listed. If SIMs arrive first, DR5's receiver and carrier spike can run right after DR3. The spike is the single biggest unknown (PRD 16 risk 4), so it should not wait.

---

## 11. Runbooks (operating the system)

These are written in full into `docs/BACKEND_SETUP.md` (worker and database) and `docs/PARTNER_BUILD_GUIDE.md` (phones) as the steps land. The outline is fixed here.

### 11.1 Provision a driver phone

1. On the admin PC: `npx tsx scripts/provision-driver.ts --vehicle <id> --plate "<plate>" --route <R#> --phone <number>`. Enter the admin PIN when asked.
2. On the phone: install the signed driver APK (check its checksum). Open it, scan the QR from the PC screen, confirm the vehicle and grant each permission.
3. Self-test: the beacon is seen by a commuter test phone (or nRF Connect); a test SMS from the gateway arrives (`provision-driver.ts` queues one).
4. Phone set-up (11.2). Mount it in the vehicle; check that it charges.
5. Record the device id, vehicle and date in the pilot log. Close the terminal so the QR is gone.

### 11.2 Driver phone set-up (once per phone)

1. Turn on auto date and time and auto time zone (the clock check depends on it).
2. Turn off battery optimisation for Tunton Driver, plus the vendor-specific steps from E5-D (auto-start, "protected apps" and so on).
3. Turn off notifications for the Messages app.
4. Screen: stay awake while charging (developer option) or the app's keep-awake; brightness set for daylight.
5. Optional: Android screen pinning on Tunton Driver.

### 11.3 Gateway phone set-up and daily check

- **Set-up:** DR7 task 3, plus the QR and setup flow.
- **Daily** (two minutes): open the gateway status screen; check that "sent today" is rising during service hours, failures are under 5 %, the battery is charging and the SIM has load. Check `ops_alerts` in the Supabase dashboard.

### 11.4 Re-provision a driver phone (sequence resync, new phone, factory reset)

Run `provision-driver.ts` again for the same vehicle with `--replace`. This retires the old device and creates a new one with a new key and sequence. Scan the new QR on the phone (admin → Re-provision). The old QR and key stop working at once.

### 11.5 Lost or stolen driver phone

1. `npx tsx scripts/retire-device.ts DRV-xxxx`: the worker stops texting it within one cycle, and the vehicle's beacon secret is replaced, so the old phone's codes stop validating at once.
2. Provision a replacement phone (11.1) with the new QR.
3. Record the incident; if the phone held a pilot participant's number, follow the breach procedure in PRD 15.1.

### 11.6 Gateway outage

| Symptom | Action |
| --- | --- |
| `gateway_heartbeat` alert | Check power and the network on the gateway phone; reopen the app; the service restarts. Messages older than 10 min are dropped by design; fresh ones flow on recovery. |
| `failure_ratio` alert | Check SIM load and signal; switch to the backup SIM in setup; if the carrier is blocking, stop sending and contact the carrier (PRD 16 risk 3) |
| `latency_p90` alert | Check carrier congestion; consider fewer messages (`SMS_DISPATCH_INTERVAL_MIN`) |
| Worker down (`/healthz` fails) | Check the team PC: on, awake, online, tunnel running; restart with `scripts/run-worker.ps1` (runbook 11.7). Driver heatmaps grey after 15 min, as designed. |

### 11.7 Team PC as the worker host (Q3)

- **Before each pilot day:** PC on and plugged in; signed in to Windows; internet up; the worker window open (started by Task Scheduler); the tunnel running; `https://<tunnel>/healthz` opens on a phone.
- **Windows settings, once:** sleep "never" while plugged in; Windows Update active hours 05:00–21:00 so it never restarts during SMS hours.
- **If the PC must go off:** do it after 21:00. Messages that queue meanwhile expire after 10 minutes, and drivers' heatmaps grey after 15, so nothing wrong is shown.
- **Moving off the PC later:** copy `services/sms-worker/dist/worker.cjs` and its environment to any Node 22/24 host, point the tunnel or a new URL at it, and re-provision the gateway with the new worker URL (`provision-gateway.ts --rotate`).

---

## 12. Risks specific to the driver side

| # | Risk | Likelihood | Impact | Mitigation | Early signal |
| --- | --- | --- | --- | --- | --- |
| R1 | The carrier filters port-addressed data SMS (PRD 16 risk 4) | Medium | Medium | Carrier spike in DR5; the text fallback with Messages notifications off | DR5-M5 receives nothing |
| R2 | A cheap driver phone cannot advertise BLE | Medium | High | Check with nRF Connect before buying in bulk; the DR4 self-test refuses it | DR4-M8 |
| R3 | Android's outgoing-SMS limiter or a vendor rule blocks volume | Medium | High | The limiter setting; `GATEWAY_SEND_GAP_MS`; a second gateway phone later | DR7-M3 prompt |
| R4 | Foreground service rules (Android 14 and 15) or vendor killers stop the beacon or gateway | High | High | Correct service types; boot receivers; E5-D vendor guide; heartbeat alerts for the gateway | DR4-M4, DR7-M4 |
| R5 | SMS volume or cost exceeds the plan (PRD 16 risk 3) | Medium | High | Written terms; the dispatch rule; operating hours; measured in E7 | Daily sent count |
| R6 | Driver phone clock drifts | Low | Medium | Auto time; drift check from the SMSC time; warning on the strip | `driftStatus = warn` |
| R7 | Driver phone numbers held by the project (personal data) | Certain | Medium | Service-role-only table; masked logs; DPO review; deleted at pilot end | DPO findings |
| R8 | MapLibre is slow on the low-end driver phone | Medium | Low | Static map with gestures off; the list works alone; a "list only" switch in admin if needed | DR4/DR5 frame drops |
| R9 | The team PC sleeps, restarts for updates or loses its connection (Q3) | Medium | High | Sleep off during SMS hours; Windows Update active hours set to 05:00–21:00; auto-restart script; the bundle can move to any Node host unchanged | `/healthz` gaps; heartbeat rows stop |
| R13 | Problems go unnoticed (dashboard-only alerts, Q9) | Medium | Medium | The daily check (runbook 11.3) on every pilot day, by a named person | `ops_alerts` rows older than a day, unresolved |
| R10 | Driver distraction (PRD 15.3) | Low | High | No required interaction; admin behind the PIN | Driver feedback |
| R11 | The router-root spike fails (Q2) | Medium | Low | The single-tree fallback in DR1 task 1 | DR1 spike |
| R12 | SIMs deactivate (no load) | Medium | Medium | A load schedule in the pilot log; the gateway daily check | Delivery failures to one phone |

---

## 13. Traceability to the PRD

| PRD | Requirement | Step | Verified by |
| --- | --- | --- | --- |
| 0.2 S6 | A second phone sees the service UUID; the payload changes every 60 s | DR4 | DR4-M2 |
| 0.2 S7 | A code ≥ 2 slots old rejected by the server; a valid one accepted; prompt within 10 s | DR2, DR8 | `beaconCode.test.ts`, live test, DR8-M1, DR8-M2 |
| 0.2 S9 | The worker emits a correctly signed message | DR2, DR6 | `cycle.test.ts`, DR6-M1 |
| 0.2 S9 | The driver app drops a bad signature, old sequence or wrong sender | DR5 | DR5-M2 |
| 0.2 S9 | The heatmap greys after 15 min | DR5 | DR5-M3 |
| 0.2 S1 | Beacon code valid in its slot ± 1, invalid ≥ 2 away | DR2 | `beaconCode.test.ts` |
| 8.2 | Rotating HMAC payload, server holds the secret | DR2, DR3, DR4, DR8 | As above |
| 8.2, 14 | Clock drift > 90 s warns | DR2, DR5 | `driverDrift.test.ts` |
| 9.2 | Advertiser in a foreground service; restarts after reboot and Bluetooth toggle | DR4 | DR4-M5, M6 |
| 9.3 | Data SMS primary, text fallback; sender whitelist; signature and sequence | DR5 | DR5-M1 to M5 |
| 9.4 | Static map, glowing nodes by band, large text, status strip | DR5 | DR5 screens, E4-D |
| 9.5 | One-time QR provisioning, self-test, rotation on loss | DR3, DR4 | DR4-M1, runbook 11.5 |
| 9.6 | Gateway pulls from the worker over HTTPS; dispatch policy; health monitoring | DR6, DR7 | DR6, DR7 scripts |
| 6.2 | One-way driver channel | DR1 (lint), DR4, DR5 | Lint; `check-apk-permissions` (no location, no Supabase) |
| 7.5 | Verified boarding cancels the check-in | DR8 | DR8-M4 |
| 13 | SMS p90 ≤ 60 s; delivery ≥ 98 % over 7 days | DR7, DR9 | DR7-M2, E7 |
| 13 | Codes older than 2 slots rejected in 100 % of tests | DR2, DR8 | Unit and live tests |
| 15.2 | Driver and gateway as signed APKs with published checksums | DR9 | Release task 1 |
| 15.3 | No interactive tasks for the driver while moving | DR4, DR5 | Screen review |

---

## 14. Approvals checklist

Every item needs Emjay's explicit word before it runs (master plan decisions 23 and 24, AGENTS.md).

| Step | Kind | Exact command or action |
| --- | --- | --- |
| DR1 | Prebuild | `node scripts/with-variant.js <commuter\|driver\|gateway> -- npx expo prebuild --clean --platform android` |
| DR1 | Local build | `node scripts/with-variant.js <variant> -- npx expo run:android` |
| DR3 | Dev dependency | `npm install --save-dev qrcode-terminal` |
| DR3 | Live database | `npx supabase db push --dry-run`, then `npx supabase db push` (`20261013000000_driver_side.sql`) |
| DR3 | Live database | Paste the `sms_outbox` and `ops_alerts` retention jobs into the SQL editor |
| DR4 | Native module | `npx create-expo-module@latest --local` (`tunton-beacon`) |
| DR4 | Dependencies | `npx expo install expo-camera expo-keep-awake expo-battery` |
| DR4 | Build | `npx eas-cli@latest build --profile development-driver --platform android` (or local) |
| DR5 | Native module | `npx create-expo-module@latest --local` (`tunton-sms`) |
| DR5 | Builds | `development-driver`, `development-gateway` |
| DR6 | Dev dependency | `npm install --save-dev esbuild` |
| DR6 | Live service | Run the worker with the service role key on the team PC; install `cloudflared` and create the tunnel |
| DR7 | Builds | `development-gateway`, `preview-gateway` |
| DR7 | Device setting | `adb shell settings put global sms_outgoing_check_max_count 2000` (and the interval) on the gateway phone |
| DR8 | Live database | `npx supabase db push` (`20261014000000_beacon_verify.sql`) |
| DR8 | Build | Commuter development build with Bluetooth scanning (R1b) |
| DR9 | Release builds | `release-driver`, `release-gateway` and the commuter preview |
| Any | Push | Only when Emjay writes "push" and names what |
