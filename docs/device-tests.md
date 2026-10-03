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
| 2026-10-03 | S3 checkpoint: route line styling and stop dots | `Pixel_7` emulator (x86_64) | 34 | Same build (no rebuild) | **Pass**. Emjay confirmed all four checks on 2026-10-03: outline, dashes and arrows; the direction switches; the amber stop highlight; the six dots. | Run by the agent. Log: `[map] status: loaded`, no MapLibre or JavaScript error. The map opened at zoom 11.11 framed on the whole route. A screenshot at zoom 14.4 near the De Oro end shows: the line with a dark outline, the return direction as white dashes over the outbound colour, direction arrows alternating east and west, a white stop dot at the end point, and under the map the panel with "Route R4", an amber "Placeholder data" note, Outbound and Return switches and the stop list. Not checked by the agent: switching a direction off, selecting a stop, and the arrows at other zoom levels. |
| 2026-10-03 | S3-M1 offline plan | `Pixel_7` emulator (x86_64) | 34 | Debug APK from 2026-10-02 11:48 PM (no rebuild) | **Pass** | Run by the agent. Airplane mode on (`airplane_mode_on` = 1, ping "Network is unreachable"), app reopened through `localhost:8081` over `adb reverse`. On the Plan tab: origin set by picking stop IMA, destination set by tapping the map. Result: walk under 10 m, ride Route R4 (outbound) for 8.9 km, walk 100 m; fare shown with "Estimate only". No JavaScript or MapLibre error and no unhandled rejection in the log. The origin was set by hand; the emulator's location was not used (GPS-free order). |
| 2026-10-03 | S3-M2 discount | `Pixel_7` emulator (x86_64) | 34 | Same build | **Pass** for Regular and Student; Senior Citizen and PWD not tapped | Run by the agent. Same 8.9 km trip: Regular ₱25.00 (15 + 5 x 2). After choosing Student in Profile: ₱20.00, with "Student discount applied. Regular fare ₱25.00." After a force-stop and relaunch, Profile still showed Student selected. The other two discounted classes use the same multiplier and are covered by unit tests. |
| 2026-10-03 | S3-M3 on-device benchmark | `Pixel_7` emulator (`sdk_gphone64_x86_64`, about 2.5 GB RAM) on the development PC (Intel i5-13420H) | 34 | Same build, development mode | **Pass**: p95 0.033 to 0.048 ms against a budget of 250 ms | Run by the agent, three runs of 1,000 trips each with the development-only button on the Plan tab: p50 0.019 ms; p95 0.033, 0.048 and 0.045 ms; maximum 1.2 to 1.6 ms. 74 of 1,000 random pairs produced a trip; the rest were rejected as too far from the line, which is the cheaper path. An x86 emulator on a laptop CPU is much faster than a 3 GB phone, so this does **not** prove the PRD target on the reference device. The placeholder line has only 6 points; see the unit benchmark for 400 and 2,000 points. |
| 2026-10-03 | S3-M4 destination behind | `Pixel_7` emulator (x86_64) | 34 | Same build | **Pass** | Run by the agent. After swapping origin and destination of the trip above, the itinerary changed to "Ride Route R4 (return) for 8.9 km" with the same fare. No crash. The "no trip in this direction" message was not seen on the device, because with the placeholder data every pair is servable in one direction; it is covered by unit tests. |
| 2026-10-03 | S4 part 1: app still runs with the backend code, no keys set | `Pixel_7` emulator (x86_64) | 34 | Same build (no rebuild), no `.env` | **Pass** | Run by the agent. The app launched, the map loaded and the log had no error. The Profile tab shows a "Team account" card reading "The backend is not set up on this build, so live vehicle positions are unavailable." The sign-in screen and everything that talks to Supabase are untested until S4 part 2. Correction: the S3 report said the emulator's classification had been set back to Regular; that tap had not registered and it was still Student. It was set to Regular in this run and checked on a screenshot. |
| 2026-10-03 | UX1 polish pass (scripts UX1-M1 to M5) | `Pixel_7` emulator (x86_64) | 34 | Debug APK from 2026-10-02 11:48 PM (no rebuild), no `.env` | **Pass**, after one fault was fixed | Run by the agent through `adb` taps and screenshots. **Fault found:** the first launch after `pm clear` showed "The route data could not be loaded ... database is locked"; the log had `Running "main"` twice, nine seconds apart. Fixed by retrying a locked database; the next launch after `pm clear` was clean. **Seen working:** introduction steps 1 to 3, with Student and an avatar chosen on step 2 and shown in Profile afterwards; "Start using the app" opened the Map tab; replay from Profile and Skip returned to Profile. Map tab: "Offline ready", legend, tapping the De Oro dot gave a card "Stop DEO ... 12.8 km from the start of the outbound line" and an amber dot; after a pan, "Show whole route" returned the view to zoom 11.11 centred on the route. Plan tab: a pinned origin read "Near MCA, 480 m from the route" with coordinates beneath; with a destination the camera fitted both pins, dotted guides and an amber ride were drawn, and the bar read "5.4 km ride, about ₱15.25"; the breakdown read ₱15.00, + ₱4.00, ₱19.00, - ₱3.80, + ₱0.05, total ₱15.25; a destination 2.6 km away gave "No trip found" with that distance and both fix buttons (the buttons themselves were pressed in an earlier run and produced a trip). About screen complete. At font scale 1.3 the Map and Plan tabs wrapped with nothing cut off. **Not checked:** stop list taps and direction switches on the Map tab after the restyle, Profile and the introduction at the larger font, a release build, and the tile-copy failure screen. `pm clear` erased the classification and avatar previously saved on the emulator; it now holds Student and the amber circle. Font scale was set back to 1.0. |
| 2026-10-03 | UX2 part 1: theme system and light map style | `Pixel_7` emulator (x86_64) | 34 | Debug APK from 2026-10-02 11:48 PM (no rebuild), Emjay's running Metro server | **Pass on the second launch; one native crash on the first** | Run by the agent. **First launch after a force-stop, 13:48:** the app quit about 3 s after `Running "main"` with `Fatal signal 11 (SIGSEGV)` in `facebook::react::MountingCoordinator::pullTransaction` (React Native's Fabric renderer, native code). There was no JavaScript error before it. **Second launch, 13:49:** the map loaded (`[map] status: loaded`) and the app stayed up. Seen: light theme by default, light map with soft blue water, the Route 4 line in `#00796b` with dark return arrows, stops as white dots with a grey outline, dark status-bar icons, themed panels on the Map and Plan tabs. The cause of the crash is **unknown**: it did not repeat, and nothing changed between the two launches. It is listed in the audit backlog. Not checked: the dark theme (its switch arrives in UX2 part 2). |
| 2026-10-03 | UX2 part 2: four tabs, Settings sheet, bottom sheet on Live (`UX2-S1` to `S8`) | `Pixel_7` emulator (x86_64), 1080 x 2400, density 420 | 34 | Same APK (no rebuild), Emjay's Metro server | **Pass**, with the flick results below | Run by the agent with `adb shell input swipe` and the pointer-location overlay on. `S1` slow drag up from peek: half. `S2` fast flick up from half: expanded in 4 of 6 tries. The other two show `velocity 0` or `451 dp/s` in the `[sheet]` log, with only 27 to 77 dp of the 133 dp swipe tracked: the emulator's injected events arrived late. After the average-speed fallback was added, 1 of 4 still failed this way. `S3` fast flick down from expanded: half, in 6 of 6. `S4` slow drag down from half: peek. `S5` chevron: peek to half, and expanded to peek. `S6` pan above the half-open sheet: the map moved (`[map] view` changed) and the sheet stayed. `S7` "Show whole route": the route was framed above the sheet. `S8` theme: Settings opened from the avatar button, and Dark and Light switched every screen. **Two faults found and fixed:** (1) after a theme switch the route line disappeared, because the map reloaded its style without the route layers; the map is now remounted per theme. (2) After coming down from expanded, the sheet content stayed scrolled; it now returns to the top. Early in the run some taps landed on tabs or stops that were not the target. With the overlay on, taps landed where intended; the earlier confusion came from swipes released over stop rows and the map while the sheet was not where the script expected. **Not tested:** TalkBack's expand and collapse actions, two-finger gestures while dragging, a small screen (only unit-tested), and a phone. |
| 2026-10-03 | UX2 part 3: My Ride with the fare | `Pixel_7` emulator (x86_64) | 34 | Same APK (no rebuild), Emjay's Metro server | **Pass** | Run by the agent. IMA to DEO from the stop chips: amber ride, green and red markers, "Board near IMA", "Get off near DEO", ₱26.50 as Student. The quick chip set to Regular: ₱33.00, and Settings then showed Regular (shared value). Details: ₱15.00 + ₱18.00, no discount, no rounding. A map tap far from the line gave "To is too far from route · 3.4 km", Walking limit 500 m; "Move pin to the route" then gave ₱31.00. At expanded the sheet covers the avatar button, so Settings opens from peek or half. |
| 2026-10-03 | UX2 parts 4 and 5: Check-in, introduction, About | — | — | — | **Not run** | Emjay's Metro server was not running when these parts were finished, and the agent does not start one. Covered by unit tests only (check-in lifecycle, verifyCheckIn, tabs, fare type). To check by hand: audit backlog items 49 to 51. |
| 2026-10-03 | UX2 fix: avatar button reachable at every snap point | `Pixel_7` emulator (x86_64) | 34 | Same APK, Emjay's Metro server | **Pass** | Run by the agent. Live sheet dragged to expanded: the sheet now stops just below the avatar button (it reserves the status bar, 8 dp, the 48 dp button and 8 dp), and tapping the avatar opened Settings. Unit tests check the same clearance on 560 to 1280 dp screens. |
| 2026-10-03 | F1: onboarding v2, greeting and avatars (`F1-M1` to `M4`) | `Pixel_7` emulator (x86_64) | 34 | Same APK (no rebuild), Emjay's Metro server | **Pass**, one first-launch observation | Run by the agent after `pm clear`. Four steps shown ("Step 1 of 4" to 4). Female picked avatar 9 (ponytail, Female set); then Male kept it (no re-roll). Live: "Evening! Where are we off to?" at 19:25 Manila, with the chosen destination chips. Chip TSO opened My Ride with To = TSO and From active; From = IMA then gave "Board near IMA" and ₱15.00. Settings: all 12 avatars drawn; Shuffle moved to avatar 2 (Male set). After a force-stop: same avatar, same chips, greeting shown again; X hid it. **Observed:** on the very first launch after `pm clear` the route was framed too high (top edge of the screen); every later launch framed it correctly. Some of the agent's chained taps landed on stale coordinates and changed the theme and avatar in Settings; they were set back by hand. |
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

## S3 (GPS-free order)

Origin and destination are always set by hand: tap the map, or pick a stop from the list under the map. The highlighted field is the one the next tap fills; after the origin is set, the destination field is highlighted automatically. No location permission is requested.

#### S3-M1 offline plan

1. Run `adb reverse tcp:8081 tcp:8081`, turn on airplane mode, and reopen the app through `localhost` (see S2-M1 step 4).
2. Open the Plan tab. Pick a stop for the origin, then tap the map near the route for the destination.
3. Expect three steps (walk, ride Route R4, walk), the ride drawn in amber on the map, and a fare labelled "Estimate only".
4. Turn airplane mode off.

#### S3-M2 discount

1. With a trip showing, open Profile and choose Regular. Note the fare on the Plan tab.
2. Choose Student, then Senior Citizen, then Person with Disability. Expect 80% of the regular fare each time, rounded to the nearest ₱0.25, with the regular fare shown beside it.
3. Force-stop and reopen the app. Expect the classification to be remembered.

#### S3-M3 on-device benchmark

1. On the Plan tab, scroll to the bottom and tap "DEV Run routing benchmark (1000 trips)". It appears only in development builds.
2. Run it three times. Record p50 and p95, the device or emulator model, RAM and API level.
3. The PRD target (250 ms at p95) is defined on a 3 GB phone. An emulator figure is indicative only.

#### S3-M4 destination behind

1. With a trip showing, tap the swap button beside the fields.
2. Expect the itinerary to use the other direction of the route, or the message "No trip found" if that pair cannot be served. Never a crash.
3. Set a point more than 500 m from the line. Expect "No trip found" with the reason.

#### S2-M3 ten minute soak (without GPS)

1. For 10 minutes, pan, zoom in and zoom out about once a minute, and switch to another tab and back twice.
2. Expect no crash and no red error screen. Record the start and end times.

## UX1 (polish pass)

No location permission is requested anywhere in these scripts. The round grey gear button at the top right is the development client's, not the app's.

#### UX1-M1 first launch and introduction

1. Run `adb shell pm clear com.tunton.app` and open the app.
2. Expect a brief loading screen with the logo, then "Welcome to Tunton", step 1 of 3. Never "The route data could not be loaded".
3. Tap Next. Choose a fare classification and an avatar. Tap Next, then "Start using the app". Expect the Map tab.
4. Open Profile. Expect the same classification and avatar. Tap "Show the introduction again", then Skip. Expect to be back on Profile.

#### UX1-M2 Map tab

1. Expect "Offline ready" with a green tick, an amber placeholder note, and a legend.
2. Tap a white dot on the map, then a stop in the list. Expect a card with the stop's code, name and distance along the route, and the dot in amber. Close it with the X.
3. Pan away and tap "Show whole route". Expect the whole line back in view.

#### UX1-M3 Plan tab guidance

1. Tap the map a little off the line. Expect "Near <stop>, <distance> from the route" and the coordinates beneath.
2. Tap a second point. Expect both pins in view, dotted guides to the line, the ride in amber, and a summary bar under the map. Tap the bar to enlarge the map and again to restore the panel.
3. Set one point more than 500 m from the line. Expect "No trip found" with the measured distance and the limit. Tap "Move ... to the route", then repeat and tap "Use stop ... as ...". Expect a trip each time.

#### UX1-M4 fare breakdown

1. With a trip showing, tap "Show how this was worked out".
2. Expect the base fare, the extra kilometres, the regular fare, the discount if any, the rounding and the total to add up, with "Estimate only" and the placeholder note still shown.

#### UX1-M5 larger text and About

1. Run `adb shell settings put system font_scale 1.3`. Look at Map, Plan, Profile and the introduction. Expect wrapped text and nothing cut off.
2. Run `adb shell settings put system font_scale 1.0`.
3. Profile, "About this app". Expect the version, the OpenStreetMap credit, the placeholder note and the list of what is stored on the phone.

## UX2 bottom sheet (Live tab)

Coordinates are for the `Pixel_7` emulator (1080 x 2400 px, density 420, so 1 dp is 2.625 px). The tab screen is about 841 dp tall, so the snap points are: peek 72 dp, half 336 dp, expanded 757 dp. The handle sits about 10 px below the sheet's top edge: at peek near y 2044, at half near y 1350, at expanded near y 246. Turn on the touch trail first with `adb shell settings put system pointer_location 1`, and off afterwards with `0`. In development builds every release is logged as `[sheet] release at <dp>, velocity <dp/s> -> <point>`: read it with `adb logcat -d -s ReactNativeJS:V | findstr sheet`.

| Script | Start | Action | Expected |
| --- | --- | --- | --- |
| UX2-S1 | peek | `adb shell input swipe 540 2044 540 1300 1500` (slow drag up) | half |
| UX2-S2 | half | `adb shell input swipe 540 1350 540 1000 100` (fast flick up) | expanded |
| UX2-S3 | expanded | `adb shell input swipe 540 246 540 600 100` (fast flick down) | half |
| UX2-S4 | half | `adb shell input swipe 540 1350 540 1950 1500` (slow drag down) | peek |
| UX2-S5 | peek | `adb shell input tap 996 2080` (chevron), then again at expanded | half, then (after one more tap) expanded, then peek |
| UX2-S6 | half | `adb shell input swipe 300 600 700 500 700` (drag on the map above the sheet) | the map pans, the sheet stays at half |
| UX2-S7 | half, map panned away | tap the round "Show whole route" button above the sheet | the whole route in view above the sheet |
| UX2-S8 | any | tap the avatar (top right), choose Dark, close; repeat with Light | every screen and the map change theme; the route line is drawn in both |

Injected flicks are not a reliable test of flick speed on this emulator (see the results log). Flick by hand with the mouse as well.

## F1 onboarding v2, greeting and avatars

Avatars are numbered 1 to 12 as TalkBack reads them ("Avatar 1"): 1 to 6 are the Male set, 7 to 12 the Female set.

| Script | Action | Expected |
| --- | --- | --- |
| F1-M1 | `adb shell pm clear com.tunton.app`, open the app | Step 1 of 4: Tunton logo, "Hi, I'm Tunton!". Next, then Female: an avatar from 7 to 12 with "Your avatar". Tap Male: the same avatar stays. Next: the four fare-type chips. Next: the six landmark chips; pick up to 3 (a fourth does nothing). Start opens Live. No permission prompt. |
| F1-M2 | Live after F1-M1 | A card above the sheet: one Tunton line for the Manila time of day and the chosen chips (or "Plan a ride" with none). Tap a chip: My Ride opens with To set and From highlighted. Pick a From: the trip and fare appear. X hides the card until the next app start. |
| F1-M3 | Avatar button, Settings | All 12 avatars in the grid. Shuffle changes the avatar within the set for the gender answer (all 12 for none). Force-stop and reopen: the avatar is unchanged. |
| F1-M4 | Settings, Replay intro, then Skip on step 1 | Returns to Settings; avatar and destinations unchanged. A fresh install that skips at step 1 still gets an avatar (from all 12). |
