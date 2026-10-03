# Partner merge result

- **Date:** 2026-10-04.
- **Branch:** `integrate-partner`, made from `main` at `b80aede`, with `origin/main` (`b21b0c1`) merged in.
- **Status:** `main` is unchanged. Nothing is pushed and nothing is built. It waits for Emjay's approval, then `git merge --ff-only integrate-partner` on `main`.
- **Analysis:** `docs/MERGE_ANALYSIS.md`. The rules applied are the ones Emjay approved.

## 1. What came from whom

| Area | Source | Notes |
| --- | --- | --- |
| UX, theme, strings, tabs, onboarding, profile, database layer, routing, fare, map style, tests, `jest.config.js`, `tsconfig.json`, `metro.config.js` | **ours** | All 28 conflicts were resolved as ours. His `plan.tsx` and `profile.tsx` stay deleted (UX2). |
| `src/services/location.ts`, `src/state/locationStore.ts` with its test, `src/features/map/useLocationTracking.ts` | **his** | Unchanged, except that the explainer now starts `idle` (decision 6), with one new test for that |
| `BlueDot.tsx`, `OriginPin.tsx`, `LocationExplainer.tsx` | **his, adapted** | Use our theme (`mapPaint.locationDot`, `tripOrigin`, `makeStyles`) and `strings.location` in `en.ts` |
| Location on the Live tab: `useLiveLocation.ts` (new), `(tabs)/index.tsx` | **his logic, our layout** | See section 3 |
| `OfflineMap.tsx` | ours, with his two props | `onLongPress` and `onUserMove`; a centre move may also set a zoom |
| Config | ours, plus his values | `BLUE_DOT_UPDATE_INTERVAL_S` 2, `BLUE_DOT_UPDATE_DISTANCE_M` 5 (labelled "blue dot only"), `MAP_FOLLOW_ZOOM` 16. His other constants (`MAP_BOUNDS`, `MAP_MIN_ZOOM`/`MAX_ZOOM`, `ROUTING_BENCHMARK_*`, `STATION_LINK_MAX_OFFSET_M`) were left out: nothing kept uses them. |
| Route 4 trace | **his, as a candidate** | `src/data/seed/r4.traced.candidate.ts`. Imported by nothing. The active seed and every seed test are ours and unchanged. |
| `package.json` | union | + `expo-system-ui ~57.0.4` (installed with `npx expo install`). `expo-asset ~57.0.18` is on both sides. |
| `package-lock.json` | regenerated | `npm install --package-lock-only` after `package.json` was settled. 21 lines added (`expo-system-ui`). |
| `app.json` | union, no secrets | His: `userInterfaceStyle` light, the `expo-asset` plugin. Ours for R1a: root background `#ffffff` (our canvas), adaptive-icon background `#e8f0fe`. **No `extra.eas.projectId`.** Permissions unchanged; background location still blocked. |
| Icon images | new, R1a | `assets/icon.png`, `splash-icon.png`, `android-icon-foreground/background/monochrome.png`, drawn from the in-app `Logo` (light palette) by a scratch script that uses `pngjs`, already installed as a dependency of another package. Nothing new was added. |
| Docs | both | His `S2_REPORT.md`, `S3_REPORT.md`, `route-trace.md` and the `tiles.md` note. His phone results go in a labelled section of our `device-tests.md`. `PRD_v1_old.md` and `archive/IMPLEMENTATION_PLAN_v1.md` are **kept**. G0 note added to `IMPLEMENTATION_PLAN_GPS.md`. |
| Not taken from his commit | — | `eas.json`; the EAS project ID; the `.gitignore` rule for the tile file; his Map/Plan/Profile screens, `features/plan/*`, `RouteLegend`, `layers.ts`, `ClassificationPicker`, `shared/map/offlineStyle.ts`, `assets/map/style.json`, the arrow PNGs, the `src/data/db` tests, `mapStyle.test.ts`, and his edits to `BentoCard`, `geo.test.ts` and `seed.test.ts` |

## 2. Decisions and why

| # | Decision | Why |
| --- | --- | --- |
| 1 | Only `b21b0c1` merged | Emjay's answer 1 |
| 2 | Trace kept as a candidate only | Answer 2; the import script (on hold) validates it. His `geo.test` change notes that JCA projects onto the R. Calo junction on the trace, which the validation must look at. |
| 3 | No `eas.json` and no project ID | Answer 3; both stay in `b21b0c1` in the history |
| 4 | Tile file stays tracked; his ignore rule is not taken | Answer 4 |
| 5 | His two document deletions not applied | Answer 5 |
| 6 | Explainer only on the first "Locate me" tap | Answer 6; it was shown at every start in his code |
| 7 | 2 s / 5 m for the blue dot only | Answer 7 |
| 8 | R1a prepared, not built | Answer 8. **The splash screen is not configured:** in SDK 57 that needs the `expo-splash-screen` package and plugin, a new dependency (question 1). |
| 9 | `expo-system-ui` imported nowhere | The current development build has no native module for it, so an import would crash. A test does not check this (none was asked for); `grep -r expo-system-ui src` is empty. |
| 10 | No G0 consent, gates, mock rejection or fake source | Out of scope (G0) |

## 3. Location on the Live tab

| Element | Behaviour |
| --- | --- |
| "Locate me" (round button above the sheet, above "Show whole route") | First tap: the explainer card replaces the greeting. Continue opens the system prompt (foreground only). Not now closes it. With permission: follow the dot. Denied and Android will not ask again: opens Settings. |
| Blue dot and accuracy ring | Every fix while permission is granted, in both themes (3:1 contrast tested) |
| Following | The camera eases to each new fix at zoom 16; dragging the map stops it; the button icon is primary while following |
| Location off | After the user has asked: a notice "Location is off. Long-press the map to set your starting point." with Turn on or Open settings. A long-press drops a green origin pin (in memory only). |
| Outside the map | "You are outside the offline map area." when the fix is outside the tile set's box |
| Not yet used | The manual origin is not read by My Ride yet ("Use my location" is G0) |

## 4. Checks (on `integrate-partner`)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass, no errors |
| `npx expo lint` | Pass, no problems |
| `npx jest` | Pass: **32 suites, 483 passed, 8 skipped**; before the merge (`b80aede`) 30 suites, 469 passed, 8 skipped. New: `locationStore.test.ts` (9), `bounds.test.ts` (2), the location privacy test (1), and the blue-dot contrast test (2). |
| `npx expo install --check` | "Dependencies are up to date" |
| `npx expo-doctor` | 21/21 checks passed |
| `npm` audit summary | 63 vulnerabilities (10 moderate, 53 high) over all dependencies; no fix run (standing rule). Not compared with the earlier production-only count of 38. |
| Emulator | **Not run**: Metro is stopped for the merge, and the current build lacks `expo-system-ui` |

## 5. R1a build steps

**Emjay (emulator, local build), after approving and moving `main`:**
1. Keep Metro stopped. On `main` (after `git merge --ff-only integrate-partner`), `node_modules` already has `expo-system-ui`; no install is needed in this folder.
2. Regenerate the native project from `app.json`: `npx expo prebuild --platform android --clean`. This deletes and recreates `android/`, which is generated (CNG).
3. Build and install: `npx expo run:android` (Pixel_7 emulator running).
4. Start Metro as usual: `npx expo start --dev-client`.

**Partner (phone, EAS cloud build), after Emjay pushes `main`:**
1. `git fetch`, then `git switch main` and `git pull --ff-only`. His `b21b0c1` is in the merged history, so this fast-forwards.
2. `npm ci`. The lock file changed, and our new native modules (`react-native-gesture-handler`, `expo-file-system`) and the patch (`postinstall`) are needed.
3. EAS setup is no longer in the repo. Keep a **local, uncommitted** `eas.json` (for example `git show b21b0c1:eas.json > eas.json`). `eas build` adds the project ID to `app.json` again: **do not commit that change** (question 2).
4. `npx eas-cli@latest build --profile development --platform android`, then install the APK over the old one.
5. `npx expo start --dev-client` on the PC; open the app on the phone.

## 6. What to test after the rebuild

| # | Where | Test | Expected |
| --- | --- | --- | --- |
| 1 | Both | Cold start | No crash. Light system bars. The new launcher icon (blue route with three stops on a pale blue tile), also in the themed-icon setting. |
| 2 | Both | F1 checklist (intro, greeting, avatars, Light and Dark) | As approved |
| 3 | Emulator | Live, tap "Locate me" | The explainer card, then the system prompt. No prompt at app start. |
| 4 | Emulator | Allow, then `adb emu geo fix 125.533083 8.946096` | The dot at TSO, camera follows; drag stops it, icon turns grey; tap again re-follows |
| 5 | Emulator | `pm clear`, Locate me, deny | The "Location is off" notice; long-press puts a green pin; Turn on shows the explainer again |
| 6 | Emulator | `adb emu geo fix 120.98 14.6` (Manila) | "You are outside the offline map area", no follow |
| 7 | Phone | Tests 1 to 5 outdoors in Butuan, then a 100 m walk | Dot follows about every 5 s while walking, as in his earlier test |
| 8 | Phone | The bottom sheet (drag, flick) and My Ride fare | They work on a real phone for the first time |

## 7. Questions

1. **Splash screen:** add `expo-splash-screen` (`npx expo install expo-splash-screen` and its plugin, with `assets/splash-icon.png` on `#ffffff`) to R1a? It is a new dependency, so I did not add it.
2. **EAS project ID:** with it out of `app.json`, each `eas build` writes it back. Accept a local-only change on his side, or keep it in the repo after all (it is an identifier, not a secret)?
3. Should "Use my location" on My Ride read the manual origin pin in G0?
