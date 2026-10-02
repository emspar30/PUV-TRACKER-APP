# Agent Prompt: Audit the existing project, then plan Prototype v0

You are working in an **existing** Expo / React Native project (folder `Capstoneerr`) on **Windows** (PowerShell, VS Code, Android Studio emulator). Dependencies were already installed with `npm install`, which took about an hour. **Do not re-scaffold, do not reinstall, and do not delete `node_modules` or the lockfile.**

Your job in this session has **two phases and then a hard stop**:

1. **Phase A: Audit** the existing project against the new PRD.
2. **Phase B: Plan** Prototype v0 (steps S0 to S5) on top of what already exists.
3. **Stop and wait for my written approval.** Do not write or change application code until I approve.

---

## 0. Ground rules (read first)

- **No code changes in this session.** You may only create or overwrite these two files:
  - `docs/AUDIT.md` (Phase A output)
  - `docs/IMPLEMENTATION_PLAN_v2.md` (Phase B output)
- **Do not run `npm install`, `npx expo install`, `npx expo prebuild`, or any command that modifies `node_modules`, `package.json`, `package-lock.json`, `app.json` or native folders.** Read-only commands are fine (`npm ls`, `npm outdated`, `npx tsc --noEmit`, `git status`, listing files, reading files).
- **Never run two installs at once** in this folder. Another `npm install` may be running in the user's terminal.
- Windows notes: use PowerShell syntax. If a script is blocked by execution policy, report it as a finding instead of changing system settings.
- **Never invent official data** (fares, route geometry, carrier behavior). Use the placeholders defined in the PRD and mark them `TODO(placeholder)`.
- **Never commit secrets.** Supabase keys, vehicle secrets and SMS keys belong in environment variables or `.env` files that are git-ignored.
- If something is unclear or missing, **list it as a question** in the plan. Do not guess.

---

## 1. Source documents

| File | Role |
| --- | --- |
| `docs/PRD.md` | **New PRD v2.0. The only source of truth.** Read it fully. **Section 0 is the build guide and overrides later sections for the prototype.** Section 0.7 defines Prototype v0. Section 12.5 has the Route 4 placeholder data. |
| `docs/PRD_v1_old.md` | The old v1.0 PRD the project was started from. Use it only to understand why existing code looks the way it does. Where it conflicts with `docs/PRD.md`, the new PRD wins. |
| `IMPLEMENTATION_PLAN.md` (project root) | Old plan, written from v1. Treat as outdated. Your new plan replaces it. |
| `AGENTS.md`, `CLAUDE.md` | Existing agent instructions. Read them. Report any conflicts with `docs/PRD.md` but do not edit them. |

If `docs/PRD.md` or `docs/PRD_v1_old.md` does not exist, **stop and tell me** which file is missing and where you looked.

---

## 2. Product context (short version)

A commuter app for **Butuan City multicab (PUV) transit**, built as a thesis project. Commuters get live PUV positions, seat availability and **offline** routing and fare estimates. Locations come only from riders' phones (passenger relay), so drivers pay no data cost.

**Prototype v0 scope (from PRD Section 0.7):**

- **Android only.** No iOS code, config, docs or dependencies.
- **Route 4 (De Oro) only.** Code must read route data from the database so other routes can be added later as data, but nothing else is built now.
- **Placeholder data** from PRD section 12.5: five candidate stops (RCA, MCA, JCA, TSO, IMA), a `DEO` end point, and a placeholder GeoJSON polyline for outbound and return.
- **Stack (fixed by the PRD):** React Native with Expo and TypeScript, **Expo dev client (not Expo Go)**, MapLibre, `expo-location`, SQLite, Turf.js, Zustand, Supabase (Postgres, Realtime, Edge Functions, row-level security).
- **Build now:** S0 to S5 only (see section 5 below).
- **Do not build now:** BLE advertising or scanning, boarding detection, verification window, route snap, mock-location rejection, Play Integrity, relay baton, check-in, SMS worker, gateway app, driver app heatmap, Energy, Trust, flags, ETA, admin console.
- **Prototype v0 stays private.** Verification is off, so only team-allowlisted accounts may write telemetry.

---

## 3. Phase A: Audit the existing project

Inspect the real project, not assumptions. Read at least:

- `package.json`, `package-lock.json` (top level only), `app.json` / `app.config.*`, `tsconfig.json`, `.gitignore`
- everything under `src/` and `assets/`
- `AGENTS.md`, `CLAUDE.md`, `IMPLEMENTATION_PLAN.md`
- any `android/` or `ios/` folders if present (report if `ios/` exists)
- test configuration, if any (Jest, Vitest, etc.)
- environment files (report names only, never print secret values)

Run read-only checks where useful: `npm ls --depth=0`, `npx tsc --noEmit`, `git status`, `git log --oneline -n 20`. If a check fails, report the error text and continue.

### 3.1 Questions the audit must answer

1. **What exists and works?** Screens, navigation, theme, components, state, data layer. Mark each as *working*, *partly done*, or *stub*.
2. **What does the project assume about the stack?** Expo SDK version, router type, whether it targets Expo Go or a dev client, New Architecture on or off, and which package versions are installed.
3. **Which packages are installed and which are missing** for the PRD stack? Check each of: `expo-dev-client`, a MapLibre React Native package, `expo-location`, `expo-sqlite`, Turf.js (modular `@turf/*` or `@turf/turf`), `zustand`, `@supabase/supabase-js`, a test runner, and any storage or crypto package needed for SMS signing later.
4. **Which installed packages conflict with the PRD?** Look for: Firebase, iOS-only packages, Google Maps SDKs or `react-native-maps`, packages for features that are out of scope for v0, duplicate navigation libraries, anything that needs Expo Go only.
5. **Which config conflicts with the PRD?** For example `ios` keys in `app.json`, an iOS bundle identifier, iOS permission strings, missing Android permission entries (fine location, notifications), missing config plugins needed by MapLibre or the dev client, a minimum Android SDK below 26.
6. **Which code conflicts with the PRD?** For example multi-route logic, hardcoded route data, thresholds hardcoded as literals, iOS branches, direct use of a backend other than Supabase, classification data sent to a server (PRD says it stays on the device), avatar photos, public rider identity on the map.
7. **Does the project's structure fit?** The PRD suggests a monorepo, but this project is a single Expo app. Do **not** propose restructuring into a monorepo today. Instead propose keeping pure logic in a folder with **no React Native imports** (for example `src/shared/`) so it can be tested with plain Node and extracted later.
8. **What from `IMPLEMENTATION_PLAN.md` is still valid?** Mark each item *keep*, *change* or *drop*.
9. **Is `npx tsc --noEmit` clean?** Report the number and kind of errors.
10. **Does the app run?** If you cannot run it, say so. Do not claim it runs without evidence.

### 3.2 Phase A output: write `docs/AUDIT.md`

Use exactly this structure:

```markdown
# Audit of existing project vs PRD v2.0

Date: <today>
Audited by: <agent>

## 1. Summary
Three to six sentences: current state, biggest conflicts, biggest risks.

## 2. Inventory
| Area | File or folder | Status (working / partly done / stub) | Notes |
| --- | --- | --- | --- |

## 3. Installed vs required packages
| Package | Installed version | Needed for | Verdict (keep / add / remove / replace) |
| --- | --- | --- | --- |

## 4. Conflicts with PRD v2.0
| # | Conflict | Where (file and line or config key) | Severity (blocker / should fix / minor) | Proposed fix |
| --- | --- | --- | --- | --- |

## 5. Keep / change / remove
| Item | Decision | Reason |
| --- | --- | --- |

## 6. One-shot dependency change list
Exact commands, grouped so I can run **one** install and **one** uninstall.
Use `npx expo install` for Expo-managed packages so versions match the SDK.
Do not run them. Only list them.

## 7. Config and native changes needed
`app.json` / config plugin changes, Android permissions, minSdk, dev client setup.
Do not apply them. Only list them.

## 8. Type-check and test status
Output summary of `npx tsc --noEmit` and any test run.

## 9. Open questions for the user
Numbered. Each question says what it blocks.
```

When Phase A is done, tell me it is done and continue straight to Phase B in the same session.

---

## 4. Phase B: Implementation plan for Prototype v0

Write `docs/IMPLEMENTATION_PLAN_v2.md`. Build on the existing code wherever it fits. Prefer **changing or extending** over rewriting. If you propose rewriting something, justify it.

### 4.1 Requirements for the plan

- Cover **S0 to S5 only**, in order. Each step must meet its acceptance criteria before the next begins.
- For **every step** list:
  1. **Goal** (one sentence)
  2. **Files to create or change** (full paths, with a one-line purpose each)
  3. **Dependencies** on earlier steps
  4. **Tests per acceptance criterion**: the test name, what it asserts, and whether it is *unit test*, *integration test* or *manual device test*
  5. **Manual test script** (numbered steps) for anything that needs the emulator or a phone
  6. **Risks and open questions**
  7. **Definition of done** (checklist)
- Keep logic that can be tested without a phone in pure TypeScript (no React Native imports): fare, geometry, SMS protocol, RSSI smoothing, config.
- **All thresholds are config constants** in one module. No magic numbers elsewhere.
- Put placeholders in one seed file (for example `src/data/seed/r4.placeholder.ts`) with `TODO(placeholder)` comments, so real data replaces them by bumping `route_data_version`.
- Do not include code in the plan. Describe it.

### 4.2 Step definitions and acceptance criteria

#### S0: Tooling and project baseline
- Goal: the existing project builds as an **Expo dev client** for Android and runs in the Android Studio emulator.
- Covers: dev client setup, Android-only config (remove or ignore iOS), min SDK 26, permissions needed for S2 to S5 only (fine location, notifications), test runner setup, lint and type-check scripts, `.env` handling, Supabase project connection (keys from env).
- Acceptance: app installs and opens in the emulator; the test command runs and passes; `npx tsc --noEmit` is clean.

#### S1: Shared core (pure TypeScript)
- Covers: config module, fare calculation, Haversine and progress-along-line helpers, SMS protocol v2 parser and signer, RSSI exponential smoothing. (Beacon codes are deferred to S6.)
- Required unit tests:
  - **Fare, regular:** 4.0 km gives ₱15.00; 4.1 km gives ₱17.00; 6.3 km gives ₱21.00; 10.0 km gives ₱27.00.
  - **Fare, discounted (multiplier 0.8):** 6.3 km gives ₱16.80 before rounding and ₱16.75 with the assumed rounding to the nearest ₱0.25. Rounding is a config setting.
  - **Fare formula:** `(base + max(0, ceil(D - baseKm)) * perKm) * M`, defaults base ₱15.00, baseKm 4.0, perKm ₱2.00. Values are placeholders to be confirmed against the official fare order.
  - **RSSI smoothing:** alpha 0.3, first reading -60 then -70 gives -63.0 (first reading initializes the average).
  - **Haversine:** distance between stops RCA (8.947459, 125.541426) and JCA (8.947506, 125.541979) is about 61 m (within 2 m).
  - **SMS parser** (format `HM2|<route>|<seq>|<HHMM>|<code>:<count>,...|<mac>`):
    - a valid message with three stations returns **all three** stations (guards against the "last repeated group only" bug);
    - a changed signature character is rejected;
    - a sequence number that is not newer (wrap-around aware) is rejected;
    - a timestamp more than 30 minutes off is rejected;
    - a wrong sender is rejected where the sender is part of the input.
    - Tests must **generate** their own signed messages with the signer. The sample MAC in the PRD is only an illustration.
  - **Seed data checks:** every placeholder stop is within the expected coordinate ranges; GeoJSON coordinates are `[longitude, latitude]`; the return line is the outbound line reversed.

#### S2: Offline map and blue dot
- Covers: MapLibre map, offline vector tile source (use a **small placeholder tile set** if the full Butuan tiles are not ready), blue dot from passive location, permission flow with a plain-language explanation first, a reduced mode if permission is denied (manual origin pin).
- Acceptance: with the emulator in airplane mode, the map renders and the dot follows simulated GPS (emulator extended controls, single point or GPX route); no crash during a 10 minute session; denying permission does not crash.

#### S3: Local route data, offline routing and fare
- Covers: SQLite schema from PRD 12.1 seeded with the R4 placeholder (two polylines, outbound and return), stations, route data version; routing engine; fare screen; commuter classification stored **on the device only** and never sent to a server; 20% discount applied only for Student, Senior Citizen, PWD.
- Routing rules: the destination must be **ahead** of the origin along the route's direction of travel; itineraries are walk, ride, walk with at most 500 m walking per leg; no transfers in v0; fare uses the route-slice distance, not the walked distance.
- Acceptance: routing plus fare returns in **250 ms or less at p95** (write a benchmark; state which device or emulator it ran on); a destination behind the origin is rejected; works fully in airplane mode; discount applies only for discounted classes.

#### S4: Minimal backend (Supabase)
- Covers: migrations for `profiles`, `vehicles`, `telemetry_latest` (columns include `verified boolean default false` and `verification_reasons jsonb`), row-level security, an ingest Edge Function, a team allowlist for writers, Realtime on `telemetry_latest`.
- Acceptance:
  - a signed-in allowlisted client can send telemetry through the ingest function;
  - a **direct insert** into `telemetry_latest` from a client is denied by security rules;
  - a non-allowlisted account cannot write;
  - a signed-in client can read active vehicles only;
  - the ingest function rejects malformed packets (packet fields: vehicle id, latitude, longitude, speed, heading, seats, timestamp).
- Do not store the commuter's fare classification in the cloud.

#### S5: Live map
- Covers: live markers from Realtime, **viewport culling** (only markers inside the visible bounds are rendered), route color, heading cone, occupancy halo, coverage states, stopped bubble.
- Rules to implement:
  - Occupancy is by **seats taken** of a configurable capacity (default 16): Green 0 to 6, Amber 7 to 12, Red 13 or more.
  - Coverage states per route: **Live** (a packet in the last 90 s), **Stale** (90 s to 10 minutes, shown greyed with its age), **No data** (nothing for 10 minutes). The UI says "No data from riders right now", never "no vehicles".
  - Stopped bubble when speed is under 2 km/h across packets spanning at least 45 s, with the text "Stopped: loading or traffic".
  - Every marker shows a **"Prototype data, unverified"** badge while `ENABLE_VERIFICATION` is `false`.
- Two ways to get a marker without a multicab (both required):
  - **Vehicle simulator script** that walks the placeholder polyline at a chosen speed and sends packets using the send rule (100 m moved or 30 s elapsed, whichever is first). It must be able to stop for 60 s and go silent for 100 s.
  - **Dev broadcast screen**, visible only behind a development flag, where a team phone broadcasts its real GPS as a test vehicle on Route 4 with a fake plate.
- Acceptance: simulated vehicle shows a marker; after 100 s of silence it becomes Stale; a 60 s stop shows the bubble; with no data the route shows "No data"; markers outside the viewport are not rendered (test with a counter or a log).

### 4.3 Plug-in points for verification (build the hooks, not the checks)

The plan must include these so verification can be added later without rewrites:

1. One function `verifyReport(report)` returning a status (`unverified` or `verified`) and a list of reasons. In v0 it always returns `unverified` with reason `verification_disabled`.
2. A config flag `ENABLE_VERIFICATION`, default `false`, read in **one** place.
3. Columns `verified` and `verification_reasons` on `telemetry_latest`.
4. The "Prototype data, unverified" UI badge.
5. A `deviceIntegrity()` hook returning a placeholder result.

### 4.4 Config constants to expose (defaults from PRD Section 0.3)

Create one config module (and a server-side config table where relevant). Include at least: position send rule 100 m or 30 s; stationary 2 km/h for 45 s; liveness timeout 90 s; coverage thresholds 90 s and 10 minutes; offline buffer 60 points (used later); vehicle capacity 16; occupancy bands; fare base ₱15.00, base distance 4.0 km, per-km ₱2.00, discount multiplier 0.8, rounding nearest ₱0.25 (assumed); route snap 30 m, minimum displacement 50 m, GPS accuracy gates 30 m and 25 m, check-in radius 60 m (these last four are defined now but used later); Night Mode window 21:00 to 04:59 Asia/Manila (setting only); `ENABLE_VERIFICATION` false.

### 4.5 Output format for `docs/IMPLEMENTATION_PLAN_v2.md`

```markdown
# Implementation plan v2: Prototype v0 (S0 to S5)

## 1. Approach and assumptions
## 2. Target file tree (new and changed files only)
## 3. Dependency and config changes (one batch, linked to docs/AUDIT.md section 6 and 7)
## 4. Steps
### S0 ... (use the seven-part template from 4.1 for every step)
### S1 ...
### S2 ...
### S3 ...
### S4 ...
### S5 ...
## 5. Test strategy
Test runner, folders, how to run unit tests, how emulator and device tests are recorded in docs/device-tests.md.
## 6. Config constants table
## 7. Risks
## 8. Open questions for the user (numbered, each says what it blocks)
## 9. What is explicitly not built in v0
```

---

## 5. Things the plan must not do

- Do not add iOS support or iOS config.
- Do not add other routes or a multi-route transfer graph.
- Do not build BLE, verification, check-in, SMS, the driver app, the gateway app, Energy, Trust, flags, ETA, the community feed, the admin console, Play Integrity, or Cebuano strings.
- Do not use Firebase.
- Do not rely on Expo Go.
- Do not hardcode thresholds, fares or route data outside the config module and the seed file.
- Do not send commuter classification, avatars or rider identity to the cloud or show them on the live map.
- Do not propose a monorepo restructure for this session.

---

## 6. Final message and hard stop

When both files are written, reply with:

1. A **5 to 8 line summary** of the audit (state of the project, top three conflicts).
2. The **top blockers** I must resolve before you start (from the open questions).
3. The exact **one-shot dependency commands** from `docs/AUDIT.md` section 6, for me to review.
4. The sentence: **"Plan ready. Waiting for your approval before any code changes."**

Then **stop**. Do not start S0 until I reply with approval, for example "Approved, start S0", and any answers to the open questions.
