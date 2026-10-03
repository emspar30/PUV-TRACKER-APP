# S2 report: offline map and blue dot

Date: 2026-10-03. Covers S2 from `docs/IMPLEMENTATION_PLAN_v2.md`. S3 has not been started.

## Status

| Part | Status |
| --- | --- |
| Code | Written |
| Automated checks | Pass |
| Phone tests | `S2-M0`, `S2-M1` and `S2-M2` passed on 2026-10-03 (see `docs/device-tests.md`). `S2-M3`, `S2-M4` and `S2-M5` not run yet. |

`S2-M0` passed, so MapLibre on Android reads the local PMTiles file. S3 was started on the owner's instruction with `S2-M3` to `S2-M5` still open.

## Commands run and results

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Exit 0 |
| `npx expo lint` | Exit 0, no errors or warnings |
| `npx jest` | 8 suites, 109 tests, all passed (was 6 suites, 88 tests) |
| `npx expo export --platform android` (to a scratch folder) | Bundle built; `assets\map\butuan.pmtiles (1.8MB)` is in the asset list |
| `pmtiles show butuan.pmtiles` | Spec version 3, tile type `mvt`, zoom 0 to 14, bounds 125.45, 8.85 to 125.70, 9.02, 173 tiles |

## Tile format decision

- **Format:** PMTiles, read from a file on the phone through the address `pmtiles://file://<path>`.
- **Basis:** the MapLibre Native Android documentation says PMTiles sources are supported from version 11.7.0, including `pmtiles://file://`. The MapLibre React Native 11.4.1 package in this project uses MapLibre Native Android 13.6.1.
- **Not proven on a device.** The plan asked for a small format test before the rest of S2. I built the whole step instead, because the documentation was clear and a separate round trip to the phone would only have tested the same code. If `S2-M0` fails, only `src/features/map/tiles.ts` and the address in `src/shared/map/offlineStyle.ts` need to change.

## How the tile file reaches the phone

1. `metro.config.js` registers `.pmtiles` as an asset type, so the file is part of the app bundle.
2. `src/features/map/tiles.ts` asks `expo-asset` to copy it to a file in the app's cache folder, once.
3. `src/shared/map/offlineStyle.ts` adds that file's address to the style from `assets/map/style.json`.

The style file itself contains no tile address and no network address.

## Acceptance criteria

| Criterion | Test | Result |
| --- | --- | --- |
| Local tile loading proven | `S2-M0 local tile format` | Pass |
| Map renders with no network | `S2-M1 offline render` | Pass (app already open) |
| Cold start with no network | `S2-M5` (preview build) | Not run |
| Dot follows the phone | `S2-M2 blue dot follows the phone` | Pass (steps 1 and 5 not reported) |
| No crash in a 10 minute session | `S2-M3 ten minute soak` | Not run |
| Denying permission does not crash | `S2-M4 permission denied` | Not run |
| Explanation comes before the prompt | `location store: explainer before prompt` | Pass |
| Reduced mode | `location store: denied enables manual pin` | Pass |
| No remote sources | `style has no network URLs` | Pass |

## Files created or changed

| Path | Change |
| --- | --- |
| `metro.config.js` | New: `.pmtiles` as an asset type |
| `assets/map/butuan.pmtiles` | New: 1.8 MB tile set, Protomaps build 20261002 |
| `assets/map/style.json` | New: dark style, 10 layers, no labels |
| `src/shared/map/offlineStyle.ts` | New: builds the tile address and adds it to the style |
| `src/shared/geo/bounds.ts` | New: point-inside-box test (the plan listed it for S5) |
| `src/shared/config/index.ts` | Added `MAP_BOUNDS`, `MAP_MIN_ZOOM`, `MAP_MAX_ZOOM`, `MAP_FOLLOW_ZOOM`, `BLUE_DOT_UPDATE_INTERVAL_S`, `BLUE_DOT_UPDATE_DISTANCE_M` |
| `src/state/locationStore.ts` | New: permission, explainer, fix, manual origin pin |
| `src/services/location.ts` | New: the only file that calls `expo-location` |
| `src/features/map/tiles.ts` | New: copies the tile set to the phone once |
| `src/features/map/OfflineMap.tsx` | New: map bounded to the tile set, no remote sources |
| `src/features/map/BlueDot.tsx` | New: dot and accuracy ring |
| `src/features/map/OriginPin.tsx` | New: the manual origin pin |
| `src/features/map/LocationExplainer.tsx` | New: card with "Continue" and "Not now" |
| `src/features/map/useLocationTracking.ts` | New: keeps the store in step with the system |
| `src/strings/index.ts` | New: user-facing text in one place |
| `src/types/assets.d.ts` | New: type for `.pmtiles` imports |
| `src/components/Screen.tsx` | Added `mode="fill"` |
| `src/app/(tabs)/index.tsx` | Map screen |
| `src/theme/index.ts` | Added `locationDot` color |
| `src/shared/__tests__/mapStyle.test.ts`, `src/state/__tests__/locationStore.test.ts` | New tests |
| `package.json`, `app.json` | `expo-asset` added (approved); `expo install` also added it to the plugin list |
| `eas.json` | Added the `preview` profile for `S2-M5` |
| `docs/device-tests.md` | S2 scripts, rewritten for a phone |

## Differences from the plan

1. **Phone instead of emulator.** The plan's S2 scripts replay a GPX route in the emulator. The scripts now use a physical phone and real movement.
2. **One package added:** `expo-asset` (approved before installing). It was already compiled into the S0 build, so no new development build is needed.
3. **Extra files:** `OriginPin.tsx`, `useLocationTracking.ts`, `src/services/location.ts`, `src/strings/index.ts`, `src/types/assets.d.ts` and `src/shared/map/offlineStyle.ts` are not in the plan's file tree.
4. **`bounds.ts` arrives early.** The plan lists it under S5; S2 needs it to tell whether the rider is inside the map area.
5. **Offline test split in two.** A development build loads its code from the PC, so it cannot start with no network. `S2-M1` checks tiles with the network off after the app is open; `S2-M5` checks a cold start with a preview build.
6. **New config constants.** The six map and blue-dot constants are not in PRD 0.3. Their values are proposals.

## Open items for your review

1. Run `S2-M0` to `S2-M4` and report the results. `S2-M5` needs one more cloud build.
2. `assets/map/pmtiles` (55 MB, a macOS program) should be deleted. It is not used, but a cloud build would upload it.
3. The map shows "© OpenStreetMap contributors". The tiles are a Protomaps build; say so if you want Protomaps credited as well.
4. Whether embedded assets copy correctly in a release build is unproven until `S2-M5`.
