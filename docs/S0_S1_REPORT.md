# S0 and S1 report

Date: 2026-10-02. Covers the one-shot install, S0 (tooling baseline) and S1 (shared core) from `docs/IMPLEMENTATION_PLAN_v2.md`. S2 has not been started.

## Status

| Step | Status |
| --- | --- |
| One-shot install | Done, with one deviation (three packages pinned; see `docs/AUDIT.md` section 10) |
| S1 shared core | Done. All required unit tests pass. |
| S0 tooling baseline | Done, pending approval. `S0-M1` passed on the emulator at 11:28 PM on Oct 2, on the second launch (see "S0-M1 result" below). |

## Commands run and results

| Command | Result |
| --- | --- |
| `npx expo install --check` | "Dependencies are up to date" |
| `npx expo-doctor` | 21 of 21 checks passed |
| `npx tsc --noEmit` | Exit 0, no errors (was 6 errors at audit) |
| `npx expo lint` | Exit 0, no errors or warnings |
| `npx jest` | 6 suites, 88 tests, all passed |
| `npx expo config --type public` | Resolves: Android only, min SDK 26, three permissions, background location blocked |
| `npx expo run:android` (first attempt) | Started 7:39 PM, stopped by decision at 9:22 PM. No result. |
| `.\gradlew.bat app:assembleDebug` (final attempt) | `BUILD SUCCESSFUL in 8m 47s`, 533 tasks, APK 305.8 MB at 11:13 PM |
| After the gesture-handler pin: `npx tsc --noEmit`, `npx expo lint`, `npx jest`, `npx expo install --check` | All clean; 88 tests pass |

## S0-M1 build attempt (Oct 2, 2026)

| Time | Event |
| --- | --- |
| 7:39 PM | `npx expo run:android` started; `Pixel_7` emulator (API 34) booted |
| 7:39 to 8:26 PM | Prebuild created `android/`. Gradle 9.3.1 downloaded itself, installed Android SDK Platform 36, NDK 27.1.12297006 and Build-Tools 35, configured the project (min SDK 26, compile and target SDK 36) and began compiling native modules |
| 8:26 PM | Last line written to the build log: `:react-native-screens:compileDebugKotlin` |
| 8:57 PM | Hermes library (112 MB) finished downloading |
| 9:05 PM | Emulator closed to free memory |
| 9:22 PM | Build stopped. Five processes ended: the two `expo run:android` node processes, the Gradle wrapper, the Gradle daemon and the Kotlin compiler daemon |

**Cause of the stall.** The build was not hung and did not fail. A thread dump of the Gradle daemon showed one thread reading a download from Maven Central while the other workers waited for it. The file is believed to be `react-android-0.86.3-debug.aar` (266 MB): its descriptor files were in the Gradle cache but the library was not. It was arriving at about 11 KB per second, and two earlier attempts had been dropped at 2.9 MB and 10 MB and restarted from zero. At that speed the download alone would have taken about six hours. An earlier suggestion that low memory caused the stall was wrong.

**What exists now.** `android/` (generated, git-ignored), `node_modules` and 1.3 GB of finished downloads in the Gradle cache are intact. No APK was produced. The app has never been installed or opened.

**Not proven.** The build stopped before the C++ compile, linking and packaging stages, so it is still unknown whether MapLibre React Native 11.4.1 and the other native modules build cleanly against React Native 0.86.3.

**Next attempt.** At the time, the plan was for a partner to build the APK. In the end the build was completed on this PC; see below.

## S0-M1 result (Oct 2, 2026, later the same evening)

The build was completed on this PC after three separate problems were found and fixed, one behind the other. Emjay ran the builds; the agent diagnosed each failure from the logs.

| # | Symptom | Cause | Fix | Changes a project file? |
| --- | --- | --- | --- | --- |
| 1 | Build idle for over an hour at the Kotlin compile tasks | Maven Central redirects `react-android-0.86.3-debug.aar` (266 MB) to `repo.reactnative.dev`. From this PC that host stalls over IPv4 (0 bytes in 45 s, then 17 KB/s) but is fast over IPv6 (1.9 MB/s). Java prefers IPv4. | `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv6Addresses=true` in the build terminal. The file then downloaded in about two minutes. | No |
| 2 | `configureCMakeDebug` failed: `A restricted method in java.lang.System has been called` | Gradle was running on Java 25 (Android Studio's bundled JBR). The native-library helper prints a Java 25 warning that the Android build treats as a failure. The exact mechanism is inferred, not proven. | `JAVA_HOME` set to JDK 17 (`C:\Program Files\Java\jdk-17.0.19`) in the build terminal | No |
| 3 | `ninja: error: ... Filename longer than 260 characters` | `react-native-gesture-handler` 3.3.0 had been installed automatically as a peer of Expo Router; Expo SDK 57 pins `~2.32.0`. Version 3 adds a C++ file whose build path exceeds the limit of the SDK's Ninja 1.10.2. | `npx expo install react-native-gesture-handler` (pins `~2.32.0`) | Yes: `package.json`, `package-lock.json` |

The earlier statement in this report that the stalled download came from Maven Central on a slow connection was incomplete: the connection is fast, and the stall is specific to one host over IPv4.

**Test result.** APK installed on the `Pixel_7` emulator (API 34, x86_64) and opened with the dev server.

- First launch, 11:22 PM: red error screen from a known start-up race in `react-native-screens` 4.26.2 (issue 4699, no fix released). The library assumes React Native's UI manager is ready when the JavaScript first loads; on a slow first load it is not.
- After a force-stop and relaunch, 11:28 PM: the app opened. Map, Plan and Profile each show their title, and closing and reopening from the launcher worked. Confirmed by Emjay.

**Result: pass, with one known issue.** The red screen can recur on a cold start. The workaround is to force-stop and reopen. A one-line patch is possible but has not been applied.

**Now proven.** MapLibre React Native 11.4.1 and the other native modules compile and link against React Native 0.86.3 on JDK 17, and the app starts with them included. No map has been rendered yet, so MapLibre at run time is still untested until S2.

**Still open after S0**

- The user-level `JAVA_HOME` still points at Java 25, so a build from a new terminal fails until it is set to JDK 17.
- `expo-system-ui` is not installed (approved for after S0-M1; needs a rebuild).
- The dev launcher logs a harmless `ClassNotFoundException` for the optional `expo-splash-screen` package, which is not installed.
- A physical-phone run of S0-M1 is still pending.

## S0 acceptance criteria

| Criterion | Test | Result |
| --- | --- | --- |
| App installs and opens in the emulator | `S0-M1 dev client launch` | Pass on the second launch; known start-up issue recorded |
| Test command runs and passes | `npm test` | Pass (88 tests) |
| Config exposes every PRD 0.3 default | `config exposes every PRD 0.3 default` | Pass |
| Shared code has no React Native imports | lint rule, plus a probe file that imports `react-native` | Pass: lint is clean, and the probe was rejected as expected |
| `npx tsc --noEmit` is clean | type-check | Pass |
| Supabase connection from env | `supabase client requires env keys` | Pass. This tests the env reader only; no real connection is made until S4. |

### S0 definition of done

- [x] One-shot install finished; `expo install --check` and `expo-doctor` clean
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run lint` exits 0
- [x] `npm test` passes
- [x] `S0-M1` passes on the emulator and is recorded in `docs/device-tests.md`
- [x] No `ios` key, script or folder exists
- [x] `.env` is git-ignored; `.env.example` contains names only
- [ ] Approval received

## S1 acceptance criteria (all unit tests)

| Requirement | Result |
| --- | --- |
| Fare, regular: 4.0 km ₱15.00, 4.1 km ₱17.00, 6.3 km ₱21.00, 10.0 km ₱27.00 | Pass |
| Fare, discounted: 6.3 km ₱16.80 unrounded, ₱16.75 rounded to ₱0.25 | Pass |
| Rounding is a config setting; formula follows route parameters | Pass |
| RSSI: first reading initializes; alpha 0.3, -60 then -70 gives -63.0 | Pass |
| Haversine: RCA to JCA within 59 to 63 m | Pass |
| Progress along line: stops project in order IMA, TSO, RCA, JCA, MCA, DEO | Pass |
| SMS: three stations all returned | Pass |
| SMS: changed signature character rejected | Pass |
| SMS: not-newer sequence rejected, wrap-around accepted (window 5,000) | Pass |
| SMS: timestamp more than 30 minutes off rejected, midnight handled | Pass |
| SMS: wrong sender rejected | Pass |
| SMS tests generate their own signed messages | Yes, with a test key |
| Seed: stops in range, longitude first, return is outbound reversed, matches PRD 12.5 | Pass |

### S1 definition of done

- [x] Every test in the plan's S1 table passes
- [x] No threshold literal in `src/shared` outside `config/` (lint rule `no-magic-numbers`; it caught one literal in `haversine.ts`, now a named constant)
- [x] `src/shared` imports nothing from React, React Native or Expo
- [x] Type-check and lint clean
- [ ] Approval received

## Files created or changed

**S0**

| Path | Change |
| --- | --- |
| `package.json` | Dependencies; removed `ios` script; added `lint` script |
| `app.json` | Removed `ios` and `web`; Android only; plugins; permissions; min SDK 26 |
| `tsconfig.json` | Added `jest` and `node` types |
| `.gitignore` | Ignores `.env` and `.env.*`, keeps `.env.example` |
| `.env.example` | New: variable names only |
| `jest.config.js` | New: `shared` project (plain Node) and `app` project (`jest-expo`) |
| `eslint.config.js` | New: Expo config, import restriction and magic-number rule for `src/shared` |
| `src/app/(tabs)/_layout.tsx` | Three tabs: Map, Plan, Profile |
| `src/app/(tabs)/index.tsx` | Title changed to Map |
| `src/app/(tabs)/plan.tsx` | Renamed from `fare.tsx` |
| `src/services/supabase.ts` | New: client created on first use, keys from env |
| `src/shared/config/index.ts`, `env.ts` | New: all constants; env readers |
| `docs/device-tests.md` | New: `S0-M1` script and results log |
| `docs/tiles.md` | New: steps to make the placeholder tile set |
| `AGENTS.md` | Android only; PRD is the source of truth |
| `docs/archive/` | Old plan, agent prompt, and the two removed tab screens (saved as `.txt`) |
| `.git/` | `git init` on branch `main`. Nothing has been committed. |

**S1**

| Path | Change |
| --- | --- |
| `src/shared/fare/fare.ts` | Fare formula, rounding, discount multiplier |
| `src/shared/geo/haversine.ts` | Distance between two coordinates |
| `src/shared/geo/line.ts` | Projection onto a line, chainage, slice length, direction check |
| `src/shared/sms/protocol.ts` | HM2 signer, parser, validator |
| `src/shared/rssi/ema.ts` | Exponential smoothing |
| `src/data/seed/r4.placeholder.ts` | Route 4 placeholder stops and lines, version 1 |
| `src/shared/__tests__/*.test.ts` | Six test files, 88 tests |

**PRD**

`docs/PRD.md` received the five approved edits and a "Changes after audit" list at the end.

## Differences from the plan

1. **Three extra packages** are pinned in `package.json`: `react-dom`, `react-native-reanimated`, `react-native-worklets`. Reason and detail in `docs/AUDIT.md` section 10.1.
2. **Jest config is in `jest.config.js`**, not in `package.json`, because the plain-Node project reuses the preset's transform, which needs JavaScript.
3. **The `simulate` script was not added.** The script it would run does not exist until S5; it will be added then.
4. **The Supabase env check tests a pure reader function**, not the client itself, so it runs in plain Node. The client is exercised in S4.
5. **`haversine.test.ts` and `line.test.ts` are one file**, `geo.test.ts`.
6. **Machine setup differed from what was reported.** API 36 and the NDK were not installed when the build started; Gradle installed them. Android Studio's JBR is Java 25. See `docs/AUDIT.md` section 10.3.

## Open items for your review

1. **`S0-M1` result.** Passed on Oct 2 (see "S0-M1 result"). Decide whether the `react-native-screens` start-up issue is acceptable as a known issue or should be patched.
2. **`expo-system-ui`.** Prebuild reports that dark mode from `app.json` needs this package on Android. Install it, or leave it out?
3. **Tile set.** Steps are in `docs/tiles.md`; the file is needed before S2.
4. **First commit.** The repository is initialised but empty. Tell me if you want a first commit made.
5. **`npm audit`** reports 16 vulnerabilities (11 moderate, 5 high) in the dependency tree. I have not examined them. `npm audit fix --force` can break SDK version pins, so I did not run it.
