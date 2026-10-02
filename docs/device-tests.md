# Device tests

Manual test scripts for steps that need the Android emulator or a phone (PRD 0.1 rule 6), and the log of every run.

Rules:

- A test counts as passed only if someone ran it. Record failed runs too.
- Checks that the PRD assigns to a physical phone stay listed as "pending on a phone" until one is used.

## Results log

| Date | Script | Device or emulator | Android API | Build | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | S0-M1 | `Pixel_7` emulator | 34 | Local debug build, `npx expo run:android`, started 7:39 PM | **Not completed** (stopped at 9:22 PM, no pass or fail) | Prebuild succeeded and created `android/`. Gradle 9.3.1 configured the project and began compiling the native modules. The build then waited on one download from Maven Central, believed to be `react-android-0.86.3-debug.aar` (266 MB), arriving at about 11 KB/s after two dropped attempts. No APK was produced and the app was never installed or opened. No build error occurred. Next attempt: partner builds the APK on a faster connection (`docs/PARTNER_BUILD_GUIDE.md`). |
| 2026-10-02 | S0-M1 | `Pixel_7` emulator (x86_64) | 34 | Debug APK (305.8 MB) built 11:13 PM with `.\gradlew.bat app:assembleDebug` on JDK 17; installed with `adb install`; dev server `npx expo start --dev-client` | **Pass** (on the second launch) | First launch at 11:22 PM showed a red error screen: `null cannot be cast to non-null type com.facebook.react.fabric.FabricUIManager` at `ScreensModule.setupFabric`. This is a known start-up race in `react-native-screens` (issue 4699). After `adb shell am force-stop com.tunton.app` and reopening at 11:28 PM the app opened. Map, Plan and Profile each show their title; closing and reopening from the launcher worked. Tab checks and reopen confirmed by Emjay. |
| 2026-10-02 | S0-M1 (cold-start repeat, after the `react-native-screens` patch) | `Pixel_7` emulator (x86_64) | 34 | Debug APK (307.9 MB) rebuilt 11:48 PM with the patch in `patches/`; `BUILD SUCCESSFUL in 2m 34s` | **Pass**, 6 of 6 cold starts | Run by the agent through `adb`: force-stop, launch through the dev-client link, wait for `Running "main"` in the log. No `RNSModule` / `FabricUIManager` exception and no fatal exception in any of the six. Each start took 45 to 60 s to load the JavaScript on this emulator. A screenshot after the sixth start shows the Map screen and the three tabs. Tab taps were not repeated in this run. The bug was intermittent, so six clean starts lower the odds but do not prove it is gone. |
| 2026-10-03 | S2 format test (local PMTiles) | `Pixel_7` emulator (x86_64) | 34 | Debug APK from 2026-10-02 11:48 PM (no rebuild); dev server already running | **Pass**. Emjay confirmed on 2026-10-03 that the map is visible and that panning and pinch-zooming work. | Run by the agent. `assets/map/butuan.pmtiles` (1,775,640 bytes) was copied by `adb` into the app's private storage and loaded with the style source URL `pmtiles://file:///data/user/0/com.tunton.app/files/map/butuan.pmtiles`. The app log showed `style loaded`, `rendered`, `map loaded` and no MapLibre or JavaScript error, in two launches. Screenshots: at zoom 11 the Butuan area with roads and the river; at zoom 14, centred on stop IMA, street-level roads, buildings and water. Not tested: airplane mode, panning and zooming by hand, and delivering the file from the app bundle instead of by `adb`. |
| 2026-10-03 | S2-M5 tile copy on a fresh install | `Pixel_7` emulator (x86_64) | 34 | Debug APK from 2026-10-02 11:48 PM (no rebuild); dev server restarted by Emjay at 2:34 AM with `--clear` | **Pass** | Run by the agent through `adb`. After `pm clear`, `files/map` did not exist. First launch: map loaded in about 15 s and `files/map/butuan.v1.pmtiles` was present at 1775640 bytes. Second launch: the `DEV` line read `tiles: already-installed` and the file's timestamp was unchanged, so it was not copied again. The file left by the earlier format test was gone after `pm clear`, so removal of an old copy was exercised only by unit tests. |
| 2026-10-03 | S2-M1 offline render | `Pixel_7` emulator (x86_64) | 34 | Same build | **Pass** | Run by the agent. Airplane mode on (`airplane_mode_on` = 1; a ping from the emulator returned "Network is unreachable"). App force-stopped and reopened through `localhost:8081` over `adb reverse`. Log: `[map] status: loaded`, no error. Screenshot shows the airplane icon and the map with roads and water. |
| 2026-10-03 | S2-M6 pan and zoom limits | `Pixel_7` emulator (x86_64) | 34 | Same build | **Pan: pass. Zoom: not tested.** | Run by the agent with `adb` swipes. The camera centre stopped at exactly 125.70 east, 125.45 west, 8.85 south and 9.02 north. The limit applies to the centre of the screen, so up to half a screen beyond the tile area can be visible at an edge, and that part is blank or only partly drawn. Zoom limits could not be driven through `adb` (only one double-tap registered, zoom 11.11 to 12.11); to be checked by hand. |
| 2026-10-03 | S2-M6 pan and zoom, by hand | `Pixel_7` emulator (x86_64) | 34 | Same build | **Pass** for panning and double-tap zoom, confirmed by Emjay | Emjay reported that panning works and double-tap zoom works, found the pan behaviour acceptable, and asked for more zoom. The zoom allowance was then raised from 2 to 4 levels (maximum zoom 16 to 18). The new maximum of 18 has not been checked by hand yet. |
| 2026-10-03 | S2 route line | `Pixel_7` emulator (x86_64) | 34 | Same build | **Pass** | Run by the agent after Emjay asked for the route line. Log: `[map] status: loaded`, no error. Screenshot shows the Route 4 placeholder line in the route colour, from the town stops to the De Oro end point, over the base map. The six stops are not drawn. |
| 2026-10-03 | S3 checkpoint: route line styling and stop dots | `Pixel_7` emulator (x86_64) | 34 | Same build (no rebuild) | **Pass**, pending Emjay's visual confirmation | Run by the agent. Log: `[map] status: loaded`, no MapLibre or JavaScript error. The map opened at zoom 11.11 framed on the whole route. A screenshot at zoom 14.4 near the De Oro end shows: the line with a dark outline, the return direction as white dashes over the outbound colour, direction arrows alternating east and west, a white stop dot at the end point, and under the map the panel with "Route R4", an amber "Placeholder data" note, Outbound and Return switches and the stop list. Not checked by the agent: switching a direction off, selecting a stop, and the arrows at other zoom levels. |
| | S2-M3 ten minute soak (without GPS) | | | | not run yet | Needs ten minutes of panning and zooming by hand. No crash was reported during Emjay's shorter manual check. |
| | S2-M2 blue dot, S2-M4 permission denied | | | | deferred (GPS-free order) | Plan Revision 1. |

## Known issues when running S0-M1

| Symptom | Cause | What to do |
| --- | --- | --- |
| Build sits for a long time at the Kotlin compile tasks with no output | A large library download from `repo.reactnative.dev` stalls over IPv4 on this network | In the build terminal, before building: `$env:JAVA_TOOL_OPTIONS = "-Djava.net.preferIPv6Addresses=true"` |
| `configureCMakeDebug` fails with `A restricted method in java.lang.System has been called` | Gradle is running on Java 25 | In the build terminal: `$env:JAVA_HOME = "C:\Program Files\Java\jdk-17.0.19"`, then `.\gradlew.bat --stop` and build again |
| `ninja: error: ... Filename longer than 260 characters` | `react-native-gesture-handler` 3.x was installed instead of the SDK version | Fixed in the project by pinning `~2.32.0`; run `npm ci` to get it |
| Red screen at launch mentioning `FabricUIManager` and `RNSModule` | Start-up race in `react-native-screens` | Patched in the project (`patches/react-native-screens+4.26.2.patch`, applied by `npm ci`). If it still appears, the installed APK predates the patch: rebuild. Otherwise force-stop the app and open it again, and record it here. |
| Blank dark screen after dismissing the red screen | The app is left in a broken state by the error above | Force-stop the app and open it again |

## Pending on a physical phone

| PRD step | Check | Status |
| --- | --- | --- |
| S0 | App installs and opens on a physical Android 8.0+ phone | pending on a phone |

## S0

### S0-M1 dev client launch

Before you start, in a new PowerShell window:

- `echo $env:JAVA_HOME` prints the Android Studio JBR path.
- `echo $env:ANDROID_HOME` prints the Android SDK path.
- In Android Studio, SDK Manager shows **Android 16 (API 36)** under SDK Platforms and **NDK 27.1.12297006** under SDK Tools as installed.

Steps:

1. Confirm no other npm or Gradle process is running in the project folder.
2. Start the `Pixel_7` emulator from Android Studio's Device Manager.
3. In the project folder, run `npx expo run:android`. The first build downloads Gradle and Android libraries and can take a long time. Do not interrupt it.
4. Expect: the app "Tunton APP" opens on the emulator with no red error screen.
5. Tap each tab: Map, Plan, Profile. Expect each to show its title on the dark background.
6. Close the app and reopen it from the launcher. Expect it to open again.
7. In Android Settings, Apps, Tunton APP, note the app is installed. Note the emulator's Android version and API level.
8. Add a row to the results log with the date, emulator model, API level and result.

If the build fails, copy the first error block from the terminal into the Notes column and stop.

## S2

### S2 format test: local PMTiles

Purpose: prove that MapLibre React Native on Android can draw the offline tile set from local storage, before the rest of S2 is built. This is a one-off check with temporary code, not a permanent test script.

1. Confirm `assets\map\butuan.pmtiles` exists.
2. With the emulator running and the app installed, copy the file into the app's private storage:
   - `adb push assets\map\butuan.pmtiles /data/local/tmp/butuan.pmtiles`
   - `adb shell "run-as com.tunton.app sh -c 'mkdir -p files/map && cp /data/local/tmp/butuan.pmtiles files/map/butuan.pmtiles'"`
3. Open the app with the dev server running and go to the Map tab.
4. Expect: a dark map of Butuan with roads, water and buildings, a status line reading `map loaded`, and "© OpenStreetMap contributors" at the bottom left.
5. Pan and zoom. Expect tiles to keep drawing inside the area 125.45 to 125.70 east, 8.85 to 9.02 north.

Style used by the test: Protomaps basemap v4 source layers `earth`, `landuse`, `water`, `buildings`, `roads` and `boundaries`, plus a background. No labels, glyphs, sprites or remote URLs.

### S2 scripts (GPS-free order, plan Revision 1)

In a development build a line at the top left of the Map tab starts with `DEV`. It shows how the tile file was installed (`installed` or `already-installed`), the map status, and the camera's zoom and centre after the map is moved.

Deferred under Revision 1: `S2-M2 blue dot follows route` and `S2-M4 permission denied`.

#### S2-M5 tile copy on a fresh install

1. With the dev server running, clear the app's data: `adb shell pm clear com.tunton.app`.
2. Open the app (press `a` in the dev server terminal) and go to the Map tab.
3. Expect "Preparing the offline map" briefly, then the map. The `DEV` line reads `tiles: installed`.
4. Force-stop the app and open it again. Expect the `DEV` line to read `tiles: already-installed`.
5. Check the file on the device: `adb shell "run-as com.tunton.app ls -l files/map"`. Expect one file, `butuan.v1.pmtiles`, of 1775640 bytes.

#### S2-M1 offline render

The dev server is reached through `adb`, not through the emulator's network, so the app can still load its code in airplane mode. Only the map data is being tested.

1. Run `S2-M5` first so the tile file is installed.
2. Run `adb reverse tcp:8081 tcp:8081` so the app can reach the dev server on `localhost`.
3. Turn on airplane mode in the emulator's quick settings. Confirm the status bar shows the airplane icon.
4. Force-stop the app and open it through `localhost`:
   `adb shell am start -a android.intent.action.VIEW -d "exp+tunton-app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.tunton.app`
5. Expect the map to draw: roads, water and buildings. Pan and zoom; tiles keep drawing.
6. Turn airplane mode off.

#### S2-M6 pan and zoom limits

1. On the Map tab, drag the map as far as it goes in each of the four directions. After each, read the centre on the `DEV` line.
2. Expect the centre to stay inside longitude 125.45 to 125.70 and latitude 8.85 to 9.02. The limit applies to the centre of the screen, so at an edge up to half the screen shows the area beyond the tiles, which is blank or partly drawn. The map must not be draggable further than that.
3. Double-tap repeatedly to zoom in until it stops. Expect the zoom on the `DEV` line to stop at 18 (tile zoom 14 plus the allowance of 4).
4. Pinch to zoom out until it stops. Expect it to stop while the tile area still fills the screen.

#### S2-M3 ten minute soak (without GPS)

1. For 10 minutes, pan, zoom in and zoom out about once a minute, and switch to another tab and back twice.
2. Expect no crash and no red error screen. Record the start and end times.
