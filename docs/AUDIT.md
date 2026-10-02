# Audit of existing project vs PRD v2.0

Date: 2026-10-02
Audited by: Claude (Opus 5.5) running as the Claude Code agent. Read-only session: no installs, no code or config changes.

## 1. Summary

The project is a bare Expo SDK 57 scaffold with a UI shell written for PRD v1.0: a theme, three Bento primitives and five placeholder tab screens. Only the four template packages are installed, so the app cannot start: `package.json` points its entry at `expo-router/entry`, which is not installed, and the type-check fails with 6 errors. Nothing of the v2.0 stack exists yet (no dev client, MapLibre, location, SQLite, Turf, Zustand, Supabase, test runner or lint). The biggest conflicts with PRD v2.0 are the iOS configuration in `app.json`, the five-tab layout (multi-route "Routes" and out-of-scope "CrowdFeed"), and the old plan's dependency list (BLE, sensors, bottom sheet). The biggest risks are the very slow npm registry connection (the base install took about two hours), an Android toolchain that is only partly set up (Java 25 on PATH, `ANDROID_HOME` unset, API 36 platform and NDK not downloaded), and no Supabase tooling or project yet. No installed package conflicts with the PRD, so nothing needs uninstalling.

**Correction to the finding I was asked to record.** The existing `src/` code imports exactly **three** packages that are not installed: `expo-router`, `lucide-react-native` and `react-native-safe-area-context`. MapLibre, SQLite, Turf and Zustand are **not** imported anywhere in `src/`; they are missing from the PRD stack, not broken imports. Both lists are given in full in section 3.

## 2. Inventory

Status meanings: *working* = complete and resolves today; *partly done* = code is complete but cannot compile or run until packages are installed; *stub* = placeholder only.

| Area | File or folder | Status (working / partly done / stub) | Notes |
| --- | --- | --- | --- |
| Theme tokens | `src/theme/index.ts` | working | Colors, 8pt spacing, radii, typography, `MIN_TOUCH_TARGET = 48`. Imports only a type from `react-native`. Matches the v2.0 design system (section 1 of the PRD). |
| Bento grid | `src/components/BentoGrid.tsx` | working (never rendered) | Measures its width and gives column widths to cards through context. Type-checks. Never run on a device. |
| Bento card | `src/components/BentoCard.tsx` | working (never rendered) | Surface tile with `span`. Type-checks. Never run on a device. |
| Screen wrapper | `src/components/Screen.tsx` | partly done | Imports `react-native-safe-area-context`, which is not installed. |
| Component barrel | `src/components/index.ts` | working | Re-exports the three primitives. |
| Root layout | `src/app/_layout.tsx` | partly done | Expo Router `Stack`; `expo-router` not installed. |
| Tab navigator | `src/app/(tabs)/_layout.tsx` | partly done | Five tabs (Tracker, Routes, Fare, CrowdFeed, Profile); `expo-router` and `lucide-react-native` not installed. Tab set conflicts with v0 scope. |
| Tab screens | `src/app/(tabs)/index.tsx`, `routes.tsx`, `fare.tsx`, `crowdfeed.tsx`, `profile.tsx` | stub | Identical blank Bento layouts. No feature logic. |
| State | none | missing | No store exists. `zustand` not installed. |
| Data layer | none | missing | No SQLite, no seed data, no Supabase client. |
| Shared pure logic | none | missing | No config, fare, geometry, SMS or RSSI code. |
| Tests | none | missing | No test files, no Jest config. `npm test` would fail: `jest` is not installed. |
| Lint | none | missing | No ESLint config or script. `AGENTS.md` requires lint before a task is done. |
| App config | `app.json` | partly done | Name, slug, scheme, dark mode, Android package set. No plugins, no permissions, no min SDK, and an `ios` block. |
| TypeScript config | `tsconfig.json` | working | Strict mode, `@/*` alias to `src/*`. |
| Git ignore | `.gitignore` | partly done | Ignores `.env*.local` only. A plain `.env` would **not** be ignored. Ignores `/android` and `/ios`. |
| Assets | `assets/` | working | Six template images (icon, adaptive icon layers, splash, favicon). Expo template art, not project branding. No map tiles, style or fonts. |
| Native folders | `android/`, `ios/` | absent | Neither exists. Prebuild has never run. No `ios/` folder. |
| Env files | none | absent | No `.env*` files exist. |
| Git | none | absent | The folder is not a git repository, so `git status` and `git log` fail with "fatal: not a git repository". |
| Agent docs | `AGENTS.md`, `CLAUDE.md` | working | Expo template guidance. Conflicts listed in section 4. |
| Old plan | `IMPLEMENTATION_PLAN.md` | outdated | Written from v1.0. All boxes unchecked. Verdicts in section 5. |
| Backend | `supabase/` | absent | No migrations, functions or project link. |

### Stack assumptions found in the project

| Question | Finding | Evidence |
| --- | --- | --- |
| Expo SDK | 57 (`expo` 57.0.26) | `npm ls --depth=0` |
| React Native / React | 0.86.3 / 19.2.3 | `npm ls --depth=0` |
| TypeScript | 6.0.3, strict | `npm ls`, `tsconfig.json` |
| Router | Expo Router, file-based, routes in `src/app/` | `package.json` `main`, `src/app/` |
| Expo Go or dev client | Intends a dev client (`expo start --dev-client`, `expo run:android`), but `expo-dev-client` is not installed | `package.json` scripts |
| New Architecture | No `newArchEnabled` key in `app.json`. React Native 0.86 is understood to be New Architecture only, which is what MapLibre React Native 11 requires. To be confirmed by `npx expo-doctor` in S0. | `app.json`; MapLibre docs: "From v11 onwards only the new architecture is supported" |
| Android SDK defaults | React Native 0.86 defaults: min SDK 24, target 36, compile 36, build tools 36.0.0, NDK 27.1, Kotlin 2.1.20 | `node_modules/react-native/gradle/libs.versions.toml` |
| Node | v25.8.0, npm 11.11.0. Inside Expo's supported range (`>= 25.0.0`) but not an LTS line | `node --version`, `expo` engines |

### Toolchain on this machine (affects S0)

| Item | Finding |
| --- | --- |
| Android SDK | Present at `%LOCALAPPDATA%\Android\Sdk`. Platforms installed: `android-34`, `android-37.0`. Build tools `36.0.0`. **`android-36` platform and the NDK are not installed**; Gradle will try to download them on the first build. |
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | Not set. `adb` is not on PATH. |
| Emulator | One AVD exists: `Pixel_7`. |
| Java | `java` on PATH is **Java 25.0.2**. `JAVA_HOME` is not set. Android Studio's bundled JBR exists at `C:\Program Files\Android\Android Studio\jbr`. Java 25 is newer than what Android Gradle builds are normally run on. |
| Supabase CLI, Docker, Deno | None installed. |
| Windows long paths | Enabled. |
| PowerShell execution policy | `LocalMachine: RemoteSigned`. The agent's shell runs with `Process: Bypass`. No script was blocked during this audit. |
| Network | The npm registry was very slow earlier today (40 s ping; base install took about two hours). It answered quickly during this audit. |
| Free disk | 58.8 GB on C:. |

## 3. Installed vs required packages

### 3.1 What is installed

| Package | Installed version | Needed for | Verdict (keep / add / remove / replace) |
| --- | --- | --- | --- |
| `expo` | 57.0.26 | Framework | keep |
| `react` | 19.2.3 | Framework | keep |
| `react-native` | 0.86.3 | Framework | keep |
| `expo-status-bar` | 57.0.1 | Status bar style in the root layout | keep |
| `typescript` (dev) | 6.0.3 | Type-check | keep |
| `@types/react` (dev) | 19.2.18 | Types | keep |

### 3.2 Imports in `src/` that do not resolve (complete list)

Every import statement in `src/` was listed and checked against `node_modules`.

| Missing package | Imported at | Symbols used |
| --- | --- | --- |
| `expo-router` | `src/app/_layout.tsx:1` | `Stack` |
| `expo-router` | `src/app/(tabs)/_layout.tsx:1` | `Tabs` |
| `expo-router` | `package.json:4` (`"main": "expo-router/entry"`) | App entry point. The app cannot start without it. |
| `lucide-react-native` | `src/app/(tabs)/_layout.tsx:2` | `Calculator`, `MapPin`, `Route`, `User`, `Users`, type `LucideIcon` |
| `react-native-safe-area-context` | `src/components/Screen.tsx:3` | `SafeAreaView` |

Imports that do resolve: `react`, `react-native`, `expo-status-bar`, and the local aliases `@/theme`, `@/components`, `./BentoGrid`, `./BentoCard`, `./Screen`.

Packages the three missing imports need alongside them (not imported directly, but required at build time):

| Package | Why |
| --- | --- |
| `react-native-screens`, `expo-linking`, `expo-constants` | Required companions of Expo Router |
| `react-native-svg` | Peer dependency of `lucide-react-native` |

### 3.3 PRD stack packages (all missing)

"SDK pin" is the version Expo 57 pins in `node_modules/expo/bundledNativeModules.json`; `npx expo install` selects it automatically. "Latest" is from `npm view` today.

| Package | Installed version | Needed for | Verdict (keep / add / remove / replace) |
| --- | --- | --- | --- |
| `expo-router` | not installed (SDK pin ~57.0.24) | Navigation; existing code and entry point | add |
| `expo-linking` | not installed (~57.0.11) | Expo Router companion | add |
| `expo-constants` | not installed (~57.0.20) | Expo Router companion | add |
| `react-native-safe-area-context` | not installed (~5.7.0) | `Screen.tsx`; Expo Router | add |
| `react-native-screens` | not installed (~4.26.0) | Expo Router | add |
| `expo-dev-client` | not installed (~57.0.19) | Dev client build (S0). Expo Go cannot run MapLibre. | add |
| `expo-build-properties` | not installed (~57.0.22) | Raise Android min SDK from 24 to 26 (S0) | add |
| `@maplibre/maplibre-react-native` | not installed (latest 11.4.1; peers `expo >= 54`, `react-native >= 0.80`, `react >= 19.1`) | Offline map and live map (S2, S5) | add |
| `expo-location` | not installed (~57.0.20) | Blue dot, dev broadcast (S2, S5) | add |
| `expo-sqlite` | not installed (~57.0.3) | Route database (S3). Also provides a key-value store for on-device settings and the `localStorage` used by the Supabase auth session, so no separate storage package is needed. | add |
| `@turf/turf` | not installed (latest 7.4.0) | Routing geometry (S1, S3). Chosen over modular `@turf/*` so one install covers every function; code imports named functions only. | add |
| `zustand` | not installed (latest 5.0.15) | App state (S2 onward) | add |
| `@supabase/supabase-js` | not installed (latest 2.117.2; needs Node 22+ for scripts, satisfied) | Backend client (S4, S5), simulator script | add |
| `@noble/hashes` | not installed (latest 2.4.0) | HMAC-SHA256 for the SMS signer (S1). Pure JavaScript with no React Native or Node-only imports, so the same code runs in Jest, on the phone and later in the Node worker. | add |
| `lucide-react-native` | not installed (latest 1.49.0) | Tab and UI icons; existing code | add |
| `react-native-svg` | not installed (SDK pin 15.15.4) | Peer of `lucide-react-native` | add |
| `jest`, `jest-expo`, `@types/jest` (dev) | not installed (`jest-expo` ~57.0.5) | Test runner (S0, S1) | add |
| `@types/geojson` (dev) | not installed | Peer of MapLibre; GeoJSON types for shared code | add |
| `eslint`, `eslint-config-expo` (dev) | not installed (`eslint-config-expo` ~57.0.2) | Lint script (S0) | add |
| `tsx` (dev) | not installed (latest 4.23.15) | Run the TypeScript vehicle simulator and seed checks from Node (S5) | add |
| `supabase` (dev) | not installed (latest 2.119.0) | Supabase CLI for migrations and Edge Function deploys (S4). Downloads a binary on install. See open question 3. | add (pending question 3) |
| `expo-notifications` | not installed | Not needed in S0 to S5. Only the notification **permission** is declared now; the package waits for check-in and boarding prompts. | do not add |
| `@react-native-async-storage/async-storage` | not installed | Not needed: `expo-sqlite` covers storage. | do not add |
| `expo-crypto`, `expo-secure-store` | not installed | Not needed in v0. Device hashing and secret storage come with later steps. | do not add |

### 3.4 Packages that conflict with the PRD

None are installed. Checked and absent: `firebase`, `react-native-maps`, any Google Maps SDK, `react-native-ble-plx`, `expo-sensors`, `expo-task-manager`, `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler`, a second navigation library. No iOS-only package is installed. Nothing depends on Expo Go.

The old plan would have installed several of these (see conflict 8). The interrupted install from the earlier session never reached them.

## 4. Conflicts with PRD v2.0

| # | Conflict | Where (file and line or config key) | Severity (blocker / should fix / minor) | Proposed fix |
| --- | --- | --- | --- | --- |
| 1 | App entry point is unresolvable, so the app cannot start | `package.json:4` `main: "expo-router/entry"`; `expo-router` not installed | blocker | Install the packages in section 6 |
| 2 | Three imports in `src/` do not resolve | See section 3.2 | blocker | Install the packages in section 6 |
| 3 | No dev client, so the project cannot run the PRD stack (PRD 0.4: "Expo Go will not work") | `expo-dev-client` absent; `android/` absent | blocker | Install `expo-dev-client`; build with `npx expo run:android` in S0 |
| 4 | iOS configuration present; PRD is Android only (0.1 rule 2, 3.2) | `app.json:11-14` (`ios.supportsTablet`, `ios.bundleIdentifier`) | should fix | Remove the `ios` block; add `"platforms": ["android"]` |
| 5 | iOS run script | `package.json:19` (`"ios": "expo run:ios"`) | should fix | Remove the script |
| 6 | Community feed tab is out of scope (PRD 0.6, 7.1: feed deferred to Phase 3) | `src/app/(tabs)/_layout.tsx:16`; `src/app/(tabs)/crowdfeed.tsx` | should fix | Remove the tab and delete the screen |
| 7 | "Routes" tab assumes a multi-route browser; v0 is Route 4 only | `src/app/(tabs)/_layout.tsx:14`; `src/app/(tabs)/routes.tsx` | should fix | Remove the tab; routing and fare share one "Plan" screen (see plan section 1) |
| 8 | Old plan installs out-of-scope packages: `react-native-ble-plx`, `expo-sensors`, `expo-task-manager`, `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler`, `expo-device`, `expo-crypto`, `@react-native-async-storage/async-storage` | `IMPLEMENTATION_PLAN.md` Phase 1 | should fix | Drop; superseded by section 6 here |
| 9 | Old plan uses seven routes, a v1 SQLite schema, a 12-avatar onboarding and a fare formula with literals | `IMPLEMENTATION_PLAN.md` Phases 2 to 4 | should fix | Replaced by `docs/IMPLEMENTATION_PLAN_v2.md` |
| 10 | Android min SDK would be 24; PRD requires Android 8.0 (API 26) | No `expo-build-properties` plugin in `app.json`; React Native default `minSdk = 24` | should fix | Add the plugin with `minSdkVersion: 26` |
| 11 | No Android permission entries (fine location, notifications) | `app.json` `android` block has no `permissions` | should fix | Add in S0 (section 7) |
| 12 | No config plugins for MapLibre, location, SQLite, router | `app.json` has no `plugins` key | should fix | Add in S0 (section 7) |
| 13 | Secrets rule not enforceable: plain `.env` is not ignored | `.gitignore:34` (`.env*.local` only) | should fix | Ignore `.env` and `.env.*`, keep `.env.example` tracked |
| 14 | Test script points at a runner that is not installed; no lint script | `package.json:21` (`"test": "jest"`) | should fix | Install Jest; add `lint` script and Jest config in S0 |
| 15 | Web target configured; not in the PRD | `app.json:25-27` (`web.favicon`), `assets/favicon.png` | minor | Remove the `web` block; leave the asset |
| 16 | `AGENTS.md` asks for "cross-platform compatibility" and mentions `expo run:ios` and iOS builds through EAS; the PRD forbids iOS | `AGENTS.md` lines 1, 34 and 40 | minor | Not edited, per instructions. The PRD wins. Decide in open question 9 whether to amend it. |
| 17 | `AGENTS.md` says "Run lint and typecheck before declaring any task done", but lint is not set up | `AGENTS.md` Commands section | minor | Satisfied once S0 adds ESLint |
| 18 | App name "Tunton APP" and package id `com.tunton.app` come from PRD v1.0 and an agent choice; PRD v2.0 names neither | `app.json:3`, `app.json:16` | minor | Confirm in open question 8 before the first build, because changing the package id later means a reinstall |
| 19 | Tab titled "Tracker" uses v1 wording | `src/app/(tabs)/_layout.tsx:13` | minor | Rename to "Map" when the tab set changes |
| 20 | PRD suggests a monorepo (`apps/`, `packages/shared`); the project is a single app | Repository layout | minor (accepted) | No restructure. Pure logic goes in `src/shared/` with no React Native imports, enforced by a lint rule, so it can be extracted later. |
| 21 | Not a git repository, so there is no history and the "never commit secrets" rule has nothing to act on | Project root | minor | `git init` in S0 if approved (open question 7) |

Code checks that found **no** conflict: no thresholds or fare values are hardcoded anywhere in `src/`; no route data exists in code; no iOS branches (`Platform.OS`) exist; no backend client of any kind exists; nothing sends classification, avatars or rider identity anywhere; no photo upload code exists. The only numeric literal that is not a design token is the Bento card minimum height, which is derived from the spacing token.

## 5. Keep / change / remove

### Existing files

| Item | Decision | Reason |
| --- | --- | --- |
| `src/theme/index.ts` | keep | Matches the v2.0 design system. Emerald, amber and crimson map directly to the three occupancy states. |
| `src/components/BentoGrid.tsx`, `BentoCard.tsx`, `Screen.tsx`, `index.ts` | keep | Reusable for the Plan and Profile screens. `Screen` may gain a non-scrolling mode for the full-screen map. |
| `src/app/_layout.tsx` | change | Keep the `Stack`; add database, auth session and config providers as steps need them. |
| `src/app/(tabs)/_layout.tsx` | change | Reduce to three tabs: Map, Plan, Profile. |
| `src/app/(tabs)/index.tsx` | change | Becomes the map screen (S2, S5). |
| `src/app/(tabs)/fare.tsx` | change | Becomes the Plan screen: routing and fare (S3). |
| `src/app/(tabs)/profile.tsx` | change | Classification picker (S3) and sign-in state (S4). |
| `src/app/(tabs)/routes.tsx` | remove | Multi-route browser; v0 has one route. |
| `src/app/(tabs)/crowdfeed.tsx` | remove | Community feed is out of scope. |
| `app.json` | change | See section 7. |
| `package.json` | change | Scripts and Jest config; dependencies through section 6. |
| `tsconfig.json` | change | Add Jest types and include `supabase/functions/_shared` and `scripts`. |
| `.gitignore` | change | Ignore `.env` files. |
| `assets/` | keep | Template icons are enough for a private prototype. |
| `AGENTS.md`, `CLAUDE.md` | keep (unedited) | Conflicts recorded in section 4. |
| `IMPLEMENTATION_PLAN.md` | remove or archive | Outdated. Open question 9. |

### Items in the old `IMPLEMENTATION_PLAN.md`

| Item | Decision | Reason |
| --- | --- | --- |
| Custom dev client instead of Expo Go | keep | Same in PRD v2.0 |
| Expo Router with tabs | keep | Tab set changes |
| Theme tokens, 8pt grid, 48 dp targets, lucide icons, no emojis | keep | Same design system in v2.0 |
| `Screen`, `BentoCard`, `BentoGrid` primitives | keep | Already written |
| Five tabs including CrowdFeed and Routes | change | Three tabs for v0 |
| "Install all dependencies, Commuter and Driver, upfront" | change | Install only what S0 to S5 use |
| `react-native-ble-plx`, `expo-sensors`, `expo-task-manager`, `expo-device`, `expo-crypto` | drop | BLE, activity recognition, background tasks and device hashing are deferred |
| `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler` | drop | No v0 screen needs them |
| `@react-native-async-storage/async-storage` | drop | `expo-sqlite` key-value store replaces it |
| Zustand store with `classification` | keep | Still stored on the device only |
| 12-avatar picker and onboarding gate | drop for v0 | Not in S0 to S5 |
| `discountMultiplier` selector | change | Moves to the shared config and fare modules |
| `franchise_routes` per PRD v1 7.1 | change | Use the v2.0 schema in PRD 12.1 |
| `route_stations(id, route_id, station_name, latitude, longitude)` | change | v2.0 splits this into `stations` and `route_stations` with `seq` and `chainage_km` |
| Seven routes with straight-line placeholders and route colors | drop | Route 4 only, from PRD 12.5 |
| `findBestRoute` across seven polylines | change | Direction-aware routing on two directed Route 4 lines |
| `computeFare` with `turf.lineSlice` and `turf.length` | change | Adds base distance and rounding from config; values no longer literals |
| Fare unit tests (4.0, 4.1, 6.3 km) | keep and extend | v2.0 adds 10.0 km and rounding |
| Per-phase audit report and approval gate | keep | Same working method |

## 6. One-shot dependency change list

**Do not run these until the plan is approved.** Run from the project root in PowerShell, with no other npm process running in this folder. Scoped package names are quoted because PowerShell treats a bare `@` as an operator.

**Install (one command line; the second part runs only if the first succeeds):**

```powershell
npx expo install expo-router expo-linking expo-constants react-native-safe-area-context react-native-screens expo-dev-client expo-build-properties expo-location expo-sqlite react-native-svg lucide-react-native "@maplibre/maplibre-react-native" "@turf/turf" zustand "@supabase/supabase-js" "@noble/hashes"; if ($?) { npx expo install jest-expo jest "@types/jest" "@types/geojson" eslint eslint-config-expo tsx supabase --dev }
```

`npx expo install` picks the SDK 57 pinned version for every Expo-managed package and the latest version for the rest. Two `expo install` calls are needed because runtime and dev dependencies cannot be mixed in one call; they are chained so it is still one line and never two installs at once. If open question 3 is answered "no Supabase CLI", remove `supabase` from the second part.

**Uninstall:** none. No installed package conflicts with the PRD.

**After the install (read-only checks, also not run yet):**

```powershell
npx expo install --check
npx expo-doctor
npx tsc --noEmit
```

Expect a long run. Today's base install of four packages took about two hours on this connection, and this list is larger. Do not interrupt it and do not start a second install.

## 7. Config and native changes needed

Listed only. None applied.

**`app.json`**

1. Remove the `ios` block and the `web` block.
2. Add `"platforms": ["android"]`.
3. Add `plugins`:
   - `expo-router`
   - `expo-build-properties` with `android.minSdkVersion: 26`
   - `expo-location` with `isAndroidBackgroundLocationEnabled: false` and `isAndroidForegroundServiceEnabled: false` (v0 uses foreground location only)
   - `expo-sqlite`
   - `@maplibre/maplibre-react-native`
4. Add `android.permissions`: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`. The notification permission is declared now because the build guide lists it for S0; nothing in S0 to S5 sends a notification.
5. Add `android.blockedPermissions` for `ACCESS_BACKGROUND_LOCATION` so no library adds it silently before the relay step.
6. Confirm `name` and `android.package` (open question 8).

**`package.json`**

1. Remove the `ios` script.
2. Add scripts: `lint` (`expo lint`), `test` (Jest), `simulate` (vehicle simulator through `tsx`).
3. Add the Jest configuration: `jest-expo` preset, a `@/` alias mapping, and a Node-environment project for `src/shared`.

**Other config**

1. `.gitignore`: ignore `.env` and `.env.*`; keep `.env.example` tracked.
2. `.env.example` with names only: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_DEV_BROADCAST`, plus test-account variables used by the integration tests and simulator.
3. `tsconfig.json`: add `jest` to `types`; include `scripts/` and `supabase/functions/_shared/`.
4. ESLint config extending `eslint-config-expo`, with a rule that forbids `react-native`, `expo*` and `@/app` imports inside `src/shared/`.

**Native and machine setup (yours to do; I will not change system settings)**

1. Set `ANDROID_HOME` to `%LOCALAPPDATA%\Android\Sdk` and add `platform-tools` to PATH.
2. Set `JAVA_HOME` to Android Studio's JBR (`C:\Program Files\Android\Android Studio\jbr`) so Gradle does not pick up Java 25.
3. In Android Studio's SDK Manager, install the **Android 16 (API 36)** platform and **NDK 27.1.12297006**, and accept the licenses. Doing it there is more reliable on a slow connection than letting Gradle download them mid-build.
4. Confirm the `Pixel_7` AVD's system image is API 26 or newer.
5. `android/` is generated by `npx expo run:android` (prebuild). It stays git-ignored and is never edited by hand. No `ios/` folder is ever generated.

## 8. Type-check and test status

**`npx tsc --noEmit`: not clean. Exit code 2, 6 errors.**

```text
src/app/(tabs)/_layout.tsx(1,22): error TS2307: Cannot find module 'expo-router' or its corresponding type declarations.
src/app/(tabs)/_layout.tsx(2,73): error TS2307: Cannot find module 'lucide-react-native' or its corresponding type declarations.
src/app/(tabs)/_layout.tsx(41,28): error TS7031: Binding element 'color' implicitly has an 'any' type.
src/app/(tabs)/_layout.tsx(41,35): error TS7031: Binding element 'size' implicitly has an 'any' type.
src/app/_layout.tsx(1,23): error TS2307: Cannot find module 'expo-router' or its corresponding type declarations.
src/components/Screen.tsx(3,30): error TS2307: Cannot find module 'react-native-safe-area-context' or its corresponding type declarations.
```

| Kind | Count | Cause |
| --- | --- | --- |
| TS2307 module not found | 4 | The three uninstalled packages in section 3.2 |
| TS7031 implicit `any` | 2 | Knock-on: the `tabBarIcon` callback loses its parameter types because `expo-router` is missing. Expected to disappear after the install. |

Not yet proven: that the Expo Router 57 `Tabs` options and the five lucide icon names used in the tab layout exist in the versions that will be installed. That is checked by the first type-check after the install.

**Tests:** none exist and no runner is installed. `npm test` was not run because it can only fail with "jest is not recognized".

**Lint:** not configured. Not run.

**`npm ls --depth=0`:** clean. Six packages, no missing or extraneous entries.

**`git status`, `git log`:** `fatal: not a git repository (or any of the parent directories): .git`.

**Does the app run?** No, and I did not try, because running it needs a prebuild, which the ground rules forbid. The evidence that it cannot run: the entry module `expo-router/entry` is not installed, `expo-dev-client` is not installed, and there is no `android/` folder. Nothing in this project has ever been launched on an emulator or a phone.

## 9. Open questions for the user

1. **Sign-in method for v0.** PRD 7.1 says Google sign-in or email magic link. The simulator script and the automated Supabase tests cannot click a magic link, and Google sign-in needs a Google Cloud setup. Do you approve **email and password accounts created by the team in the Supabase dashboard** for the private v0, with Google and magic link deferred? *Blocks S4 and S5.*
2. **Supabase project.** Is there a Supabase project yet? I need the project URL and publishable key in a local `.env` (never committed), and someone with dashboard access to create the team accounts and the allowlist. *Blocks S4.*
3. **How migrations and the Edge Function are applied.** No Supabase CLI, Docker or Deno is installed. Options: (a) add the `supabase` CLI as a dev dependency and push to the hosted project (my recommendation; needs a one-time `supabase login` by you), or (b) you paste the SQL and function code into the dashboard by hand. *Blocks S4, and decides whether `supabase` stays in the install command.*
4. **Two directions in a schema with one polyline per route.** PRD 12.5 says Route 4 is stored as two `primary_geojson` rows, but `franchise_routes` in 12.1 has `route_id` as its primary key and no direction column. Options: (a) add `route_code` and `direction` columns (my recommendation; a small additive change to 12.1), or (b) keep 12.1 exactly and encode the direction in `route_id`, for example `R4-OUT` and `R4-RET`. *Blocks S3.*
5. **Where a rider may board and alight.** PRD 7.2 computes the fare "between boarding and alighting nodes". Are riders limited to the listed stops, or can they board anywhere along the line, as multicabs usually allow? With the placeholder data the five stops sit within 1.5 km of each other and the line then runs about 11 km to De Oro with no stop. *Blocks S3 routing rules and the fare screen.*
6. **Is `DEO` a selectable stop?** PRD 12.5 lists five candidate stops and a separate `DEO` end point. If `DEO` is not a station, no placeholder ride is longer than about 1.5 km and the fare screen can never show more than the base fare. I recommend seeding it as a sixth placeholder station. *Blocks S3 seed data.*
7. **Offline tiles for S2.** I cannot invent map data. Who supplies the placeholder tile set for the Butuan bounding box, and in which format? My recommendation is a small OpenStreetMap-derived extract that you generate once (I will give exact steps), with the format (`.mbtiles` as the PRD says, or PMTiles) chosen after a short S2 test of what MapLibre React Native 11 can read from local storage. Also: may the first tile set omit text labels, so no font files are needed? *Blocks S2.*
8. **App name and Android package id.** `Tunton APP` and `com.tunton.app` are not in PRD v2.0. Confirm or replace both before the first build. *Blocks S0 (cheap to change now, a reinstall later).*
9. **Housekeeping.** May I (a) run `git init` in S0, (b) delete or archive the old `IMPLEMENTATION_PLAN.md`, `AGENT_PROMPT.md` and the two removed tab screens, and (c) amend `AGENTS.md` to say Android only? *Blocks nothing; affects S0 cleanup.*
10. **Emulator versus phone.** PRD 0.2 verifies S0, S2 and S5 on a physical Android 8.0+ phone; the build guide for this session says the emulator. I will plan for the emulator and note each physical-phone check as "later". Is a real phone available for the S3 benchmark, which the PRD defines on a 3 GB device? *Blocks only the final S3 benchmark figure.*
11. **SMS sequence wrap-around.** The sequence is four digits. The PRD says "wrap-around aware" but gives no window. I propose: a number is newer if it is 1 to 5,000 ahead of the last one, modulo 10,000, as a config constant. Confirm or correct. *Blocks one S1 unit test.*
12. **Folder name.** The prompt calls the folder `Capstoneerr`; the real folder is `Capstoneerrr`. I am assuming they are the same project. *Blocks nothing.*
13. **Packet timestamp limits.** How old, and how far in the future, may a telemetry packet's timestamp be before the ingest function rejects it? The PRD gives no value. *Blocks one S4 validation rule.*
14. **Writer audit trail.** Do you want a server-only log of which account sent each telemetry packet? It helps trace a fake marker but stores a link between an account and a location. *Blocks nothing; changes the S4 migration.*
15. **Tab layout.** Do you approve three tabs (Map, Plan, Profile) and removing the Routes and CrowdFeed screens? *Blocks S0.*

## 10. Addendum: what changed when the install was run (Oct 2, 2026)

Sections 1 to 9 describe the project as audited and are left as written. This section records where the approved install and the first build differed from them.

### 10.1 Three packages pinned beyond the approved list

The first half of the one-shot command in section 6 (runtime packages) succeeded. The second half (dev packages) failed with npm error `ERESOLVE`. Cause: Expo Router declares three companion packages as peer dependencies, and npm installed them automatically at their newest versions instead of the versions Expo SDK 57 pins. The newest `react-dom` requires a newer `react` than the SDK uses, which blocked every later install.

| Package | Version npm chose | Version pinned (SDK 57) | Why it is in the project |
| --- | --- | --- | --- |
| `react-dom` | 19.3.0 (needs `react` ^19.3.0; project has 19.2.3) | 19.2.3 | Peer dependency of Expo Router and its web-capable sub-packages. Not used by any Android code in this project. |
| `react-native-reanimated` | 4.7.0 | 4.5.1 | Peer dependency of Expo Router's navigation components. Compiled into the Android build. |
| `react-native-worklets` | 0.13.0 (outside the range `expo-modules-core` accepts) | 0.10.1 | Required by `react-native-reanimated`. Compiled into the Android build. |

Fix applied: `npx expo install react-dom react-native-reanimated react-native-worklets`, then the dev half of the section 6 command was re-run and succeeded. All three are now listed under `dependencies` in `package.json`.

This is a deviation from section 6 and from the plan's statement that no package is added without asking first. The three packages were already in `node_modules`; the change only fixed their versions and made them explicit. To undo it, remove the three lines from `package.json`, but the dev install will then fail again in the same way.

Checks after the fix: `npx expo install --check` reports "Dependencies are up to date"; `npx expo-doctor` passes 21 of 21 checks; `npm ls --depth=0` is clean.

Section 3.4 said `react-native-reanimated` was absent and section 5 marked it "drop". Both statements were true at audit time. It is now present because Expo Router requires it, not because any screen uses it.

### 10.2 Commands actually run

```powershell
npx expo install expo-router expo-linking expo-constants react-native-safe-area-context react-native-screens expo-dev-client expo-build-properties expo-location expo-sqlite react-native-svg lucide-react-native "@maplibre/maplibre-react-native" "@turf/turf" zustand "@supabase/supabase-js" "@noble/hashes"
npx expo install react-dom react-native-reanimated react-native-worklets
npx expo install jest-expo jest "@types/jest" "@types/geojson" eslint eslint-config-expo tsx supabase --dev
```

### 10.3 Corrections to the toolchain notes

- **Java.** Section 7 advised pointing `JAVA_HOME` at Android Studio's bundled JBR to avoid Java 25. That advice was wrong on this machine: the bundled JBR is itself OpenJDK 25.0.2. The project's Gradle (9.3.1) started and configured the build under it without complaint.
- **API 36 and NDK.** When the first build started, the Android SDK still had only the `android-34` and `android-37.0` platforms and no NDK. Gradle downloaded and installed Android SDK Platform 36 and NDK 27.1.12297006 itself, because the SDK licence was already accepted.
- **Environment variables.** `JAVA_HOME` and `ANDROID_HOME` are set at user level, but the VS Code session that runs the agent was started before that and does not see them. The build command sets both for itself. Restart VS Code to pick them up.
- **Network.** The registry was fast during the install (about one minute for the runtime packages), unlike the two-hour base install earlier in the day.

### 10.4 New finding from prebuild

Prebuild printed: `android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.` The `"userInterfaceStyle": "dark"` setting in `app.json` has no effect on Android without the `expo-system-ui` package. The app's screens set their own dark colors, so the visible effect is small (system dialogs and the keyboard may follow the phone's theme). Not installed; this needs your decision.

## 11. Known audit findings

Date: Oct 2, 2026. Command: `npm audit --omit=dev` (read-only; no fix command was run).

The audit lists 16 entries (11 moderate, 5 high, 0 critical). They come from three advisories. The other 13 entries are packages flagged only because they depend on one of the three.

| Advisory | Severity | Installed version | Reaches the project through | Ships in the app? |
| --- | --- | --- | --- | --- |
| `decode-uri-component`: denial of service via exponential decoding of malformed percent-encoded input. [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) | moderate | 0.2.2 | `expo-router` → `query-string` 7.1.3 | **Yes.** Expo Router's runtime imports `query-string` to parse URLs into screens and parameters. |
| `node-forge`: RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements. [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | high | 1.4.0 | `expo` → `@expo/cli` and `@expo/code-signing-certificates` | No. Command-line tooling that runs on the development PC. |
| `uuid`: missing buffer bounds check in v3/v5/v6 when a buffer is provided. [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | moderate | 7.0.3 | `expo` → `@expo/config-plugins` → `xcode` | No. Prebuild tooling that runs on the development PC. |

Notes:

- "Ships in the app" was judged from the dependency paths and from Expo Router's built files importing `query-string`. A built app bundle was not inspected.
- The one shipped finding causes a hang, not data exposure, and needs a crafted link opened through the app's `tunton://` scheme. Rated low risk for a private prototype.
- npm's suggested fixes (`expo@44.0.6`, `expo-router@5.1.11`, `@maplibre/maplibre-react-native@11.3.2`) are downgrades that would break the SDK 57 setup. The `@maplibre/maplibre-react-native` "high" entry is not a MapLibre flaw; it is flagged only because it lists `expo` as a peer.

**Decision: deferred; re-check with `npm audit --omit=dev` before any public release.** Do not run `npm audit fix` or `npm audit fix --force`. Wait for Expo to publish updated dependencies.
