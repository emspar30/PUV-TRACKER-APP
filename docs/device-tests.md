# Device tests

Manual test scripts for steps that need the Android emulator or a phone (PRD 0.1 rule 6), and the log of every run.

Rules:

- A test counts as passed only if someone ran it. Record failed runs too.
- Checks that the PRD assigns to a physical phone stay listed as "pending on a phone" until one is used.

## Results log

| Date | Script | Device or emulator | Android API | Build | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | S0-M1 | `Pixel_7` emulator | 34 | Local debug build, `npx expo run:android`, started 7:39 PM | **Not completed** (stopped at 9:22 PM, no pass or fail) | Prebuild succeeded and created `android/`. Gradle 9.3.1 configured the project and began compiling the native modules. The build then waited on one download from Maven Central, believed to be `react-android-0.86.3-debug.aar` (266 MB), arriving at about 11 KB/s after two dropped attempts. No APK was produced and the app was never installed or opened. No build error occurred. Next attempt: partner builds the APK on a faster connection (`docs/PARTNER_BUILD_GUIDE.md`). |
| 2026-10-02 | S0-M1 | Poco X6 Pro (physical phone) | 36 (Android 16) | EAS Build `13591f67-84b7-4802-8e44-292b3aa4fd78`, `development` profile, finished 11:43 PM | **Pass** | Reported by the phone's owner: APK installed, app loaded from `npx expo start`, the Map, Plan and Profile tabs showed, and the app reopened to the tab screen after closing. First successful Android build of this project, so the native modules (including MapLibre React Native 11.4.1) compile against React Native 0.86.3. Build included `expo-system-ui`. |
| 2026-10-03 | S2-M0 | Poco X6 Pro (physical phone) | 36 (Android 16) | EAS Build `13591f67-84b7-4802-8e44-292b3aa4fd78`, `development` profile, code from the dev server | **Pass** | Reported by the phone's owner: the map displayed on the Map tab. MapLibre on Android reads the local PMTiles file through `pmtiles://file://`, so PMTiles is the tile format for v0. Step 3 (zooming in to see streets and buildings) was not reported separately. |
| 2026-10-03 | S2-M2 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build | **Partly run** (no pass or fail) | Reported: the owner's location showed as a dot on the map. Not yet reported: the explainer card before the system prompt, the dot moving over a 100 m walk, and the follow and re-center button. |
| 2026-10-03 | S2-M1 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build | **Pass** | Reported: with Wi-Fi and mobile data off and the app already open, the map kept working while zooming in and out. Opening the app from cold with no network failed with "cannot connect to the development server". That is expected for a development build, which loads its code from the PC, and is not a map failure; the cold-start check is `S2-M5`. |
| 2026-10-03 | S2-M2 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build | **Pass** (dot follows the phone) | Reported: walking along the street, the blue dot moved, updating roughly every 5 s (the app asks for an update every 2 s or 5 m; at walking pace the 5 m rule sets the rhythm). Distance walked not recorded. Not reported: step 1 (explainer card before the system prompt) and step 5 (follow stops on drag, re-center button). |
| 2026-10-03 | S3-M1 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build, code from the dev server | **Pass** for steps 1 to 4; step 5 open | Reported: Tandang Sora to M. Calo and Tandang Sora to De Oro gave the expected estimates (₱15.00 and ₱33.00). Step 5: "My location" did not give a trip although the owner was beside the road of the route. Under investigation; the placeholder line is straight segments between stops, not the road (see S3 report). |
| 2026-10-03 | S3-M2 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build | **Pass** | Reported: fares exactly as expected (₱33.00 regular, ₱26.50 discounted). Student was still selected after closing and reopening the app. |
| 2026-10-03 | S3-M3 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build (development, so slower than a release build) | **Pass** (p95 within 250 ms) | Reported: p50 0.65 ms, p95 0.72 ms. One run reported (the script asks for three). Phone RAM not recorded. The PRD target is for a 3 GB phone. |
| 2026-10-03 | S3-M4 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build | **Pass** (steps 1 and 2) | Reported: M. Calo to Tandang Sora used the return line, 1.24 km. Steps 3 and 4 not reported separately. |

## Pending on a physical phone

| PRD step | Check | Status |
| --- | --- | --- |
| S0 | App installs and opens on a physical Android 8.0+ phone | passed 2026-10-02 on a Poco X6 Pro (see results log) |

## S0

### S0-M1 dev client launch

Runs on a physical Android phone with a cloud build (EAS Build, `development` profile in `eas.json`). No Android Studio, emulator or local Android SDK is needed.

Before you start:

- The phone runs Android 8.0 or newer (Settings, About phone).
- The phone and the PC are on the same Wi-Fi network.
- `npx eas-cli@latest whoami` prints your Expo account name. If it does not, run `npx eas-cli@latest login`.
- `node_modules` exists in the project folder. If it does not, run `npm ci`.

Steps:

1. In the project folder, run `npx eas-cli@latest build --profile development --platform android`. On the first run, answer yes when asked to create the EAS project and to generate a new Android keystore.
2. Wait for the build to finish. It runs on Expo's servers and may wait in a queue first. The terminal can be closed; the build also appears on expo.dev under the project's Builds page.
3. When the build finishes, open its QR code or install link on the phone, download the APK and install it. Allow "install unknown apps" for the browser when Android asks.
4. On the PC, run `npx expo start --dev-client`.
5. On the phone, open "Tunton APP" and scan the QR code shown in the terminal. If it cannot connect, stop the server and run `npx expo start --dev-client --tunnel` instead.
6. Expect: the app loads with no red error screen.
7. Tap each tab: Map, Plan, Profile. Expect each to show its title on the dark background.
8. Close the app and reopen it from the launcher. Expect it to open again.
9. In Android Settings, Apps, Tunton APP, note the app is installed. Note the phone's model, Android version and API level.
10. Add a row to the results log with the date, phone model, API level, the EAS build ID and result. On a pass, change the S0 row under "Pending on a physical phone" to passed.

If the build fails, open the build's page on expo.dev, copy the first error block from the failed phase into the Notes column and stop.

A new build is needed only when a native package or an `app.json` plugin or permission changes. JavaScript changes reload from the dev server.

## S2

All S2 scripts run on a physical phone with the development build from S0-M1. The plan's versions replayed a recorded GPS route in the emulator; on a phone the position tests mean going outside with it.

Before you start:

- Delete `assets/map/pmtiles` if it is still there (a 55 MB macOS program, not a map). The map file is `assets/map/butuan.pmtiles`.
- Stop the dev server if it is running, then start it with `npx expo start --dev-client --clear`. The `--clear` is needed once because `metro.config.js` is new.
- Open "Tunton APP" on the phone and connect to the dev server.
- The blue-dot tests only show a dot when the phone is inside the map area (Butuan: longitude 125.45 to 125.70, latitude 8.85 to 9.02). Outside it, the app shows "You are outside the offline map area." and no dot.

### S2-M0 local tile format

This is the first check of S2: it proves MapLibre on Android reads the local PMTiles file.

1. Open the Map tab.
2. Expect: within a few seconds the dark map of Butuan is drawn (land, the Agusan River and the bay in dark blue, roads as lighter lines). There are no text labels; that is intended in v0.
3. Zoom into the city center. Expect streets and building shapes to appear.
4. Record the result. If the screen instead shows "The offline map could not be loaded." or stays on "Preparing the offline map", or the map area is a plain dark rectangle with no roads, record a fail, copy any red error text or terminal error into Notes, and stop.

### S2-M1 offline render

1. With the app open on the Map tab and the map drawn, turn on airplane mode (Wi-Fi and mobile data both off). A "disconnected from the dev server" message may appear; dismiss it.
2. Pan to a part of the map you have not looked at yet and zoom in and out.
3. Expect: tiles keep drawing everywhere inside the Butuan box. This shows the tiles come from the file on the phone, because the phone has no network.
4. Record the result, then turn airplane mode off.

Not covered by this script: starting the app from cold with no network. A development build loads its JavaScript from the PC, so a cold start in airplane mode needs a build with the JavaScript inside it. That check is `S2-M5`.

### S2-M2 blue dot follows the phone

1. On first opening the Map tab, expect the card "Show your location on the map?" before any system prompt.
2. Tap Continue, then allow location in the system prompt ("While using the app").
3. Expect: a blue dot with a white edge at your position, a faint ring showing the accuracy, and the map centering on the dot.
4. Go outside and walk at least 100 m. Expect the dot to move with you and the map to keep following.
5. Drag the map away. Expect the map to stop following and the button at the bottom right to turn white. Tap the button. Expect the map to center on the dot again and the button to turn cyan.
6. Record the result with the distance walked.

### S2-M3 ten minute soak

1. With location allowed, use the map for 10 minutes while moving (walking or riding).
2. About once a minute, pan, zoom in and zoom out. Switch to another tab and back at least twice during the run.
3. Expect no crash and no red error screen.
4. Record the start time, end time and result.

### S2-M4 permission denied

1. In Android Settings, Apps, Tunton APP, Storage, tap "Clear data". Open the app and connect to the dev server again.
2. On the explainer card tap Continue; in the system prompt tap "Don't allow".
3. Expect: the map still draws, there is no blue dot, and a notice reads "Location is off. Long-press the map to set your starting point."
4. Long-press the map. Expect an amber pin at that point. Long-press somewhere else. Expect the pin to move there.
5. Tap "Turn on" in the notice. Expect the explainer card again.
6. Clear the app's data again, open the app, and this time tap "Not now" on the explainer. Expect the same notice and reduced mode, with no system prompt shown at any point.
7. Record the result.

### S2-M5 cold start with no network (preview build)

Run this once, after S2-M0 to S2-M4 pass. It needs a second cloud build that carries the JavaScript and the tile file inside the APK.

1. Run `npx eas-cli@latest build --profile preview --platform android` and wait for it to finish.
2. Install the APK on the phone. It replaces the development build.
3. Open the app once, then force-stop it (Settings, Apps, Tunton APP, Force stop).
4. Turn on airplane mode. Open the app and go to the Map tab.
5. Expect: the map draws, and with location allowed the blue dot appears (GPS works without a network).
6. Record the result with the build ID.
7. Reinstall the development build from its page on expo.dev so that later steps can reload code from the PC.

## S3

All S3 scripts run on the phone with the development build from S0-M1. No new build is needed. Reload the app first (press `r` in the dev server terminal) so it picks up the new code.

**Route data version 2 (2026-10-03).** The Route 4 lines now follow the streets of the PRD 12.5 route description, traced from OpenStreetMap (see `docs/route-trace.md`). The app replaces the old straight-line data automatically on the first launch after the update. The expected values below are for version 2 and the placeholder fare values. Results logged before this change used version 1.

### S3-M0 route lines, direction and Plan layout

1. Open the Map tab. Expect a light map and the Route 4 lines in cyan with a dark outline, running along the streets from the Integrated Transport Terminal in Langihan, through downtown (JAQNO, R. Calo, M. Calo), along the national highway to Ampayon and down to De Oro.
2. Zoom in on a road both directions use (for example the national highway). Expect two lines side by side: the outbound line solid, the return line dashed. Expect white arrows on each line pointing the way that direction travels: outbound arrows toward De Oro, return arrows toward the terminal.
3. Expect a legend at the bottom left: "R4 outbound" with a solid swatch and "R4 return" with a dashed one.
4. If you know the route, note any street where a line goes a different way from the real jeepneys. Record the street names in Notes.
5. Open the Plan tab. Expect the map at the top with the same legend, then a trip card with "From" and "To" fields and a swap button, then the fare estimate and trip steps once a trip is planned.
6. Record the result.

### S3-M5 choosing From and To

1. With location allowed, open the Plan tab. Expect the From field to read "Your location" in blue with a location icon and "GPS, accurate to … m" below it.
2. Tap From. Expect a sheet from the bottom with two tabs, "Current location" and "A specific place", opened on "Current location".
3. Tap "A specific place". Expect a search box, "Pick a point on the map", and the stop list, each stop with a short name and "Served by outbound" or "Served by outbound and return".
4. Type "calo" in the search box. Expect only the R. Calo and M. Calo stops.
5. Pick "Tandang Sora Pob. (Bgy. 12)". Expect the sheet to close and From to show that stop with a pin icon, no longer "Your location".
6. Tap To, then "Pick a point on the map". Expect a teal banner over the map, "Tap the map to set your destination". Tap a point near the highway. Expect To to read "Point on the map" with its coordinates, and a trip or a distance message.
7. Tap the swap button. Expect From and To to change places.
8. Tap From, choose "Current location", then "Use my current location". Expect From to read "Your location" again.
9. Turn location off for the app (or deny it) and reopen From. Expect "Location is off…" and the "Use my current location" button greyed out.
10. Record the result.

### S3-M1 offline plan

1. With the app loaded, turn on airplane mode. Open the Plan tab.
2. Under From, pick "Tandang Sora Pob. (Bgy. 12), Butuan City". Under To, pick "8-318 M. Calo St, Butuan City".
3. Expect three steps: walk 0 m to the route, ride "Route 4 (De Oro), outbound" for 1.86 km, walk 0 m to your destination. Expect ₱15.00, labelled as an estimate, with the note that the fare values are placeholders.
4. Change To to "De Oro, near the Free Methodist Church". Expect a ride of 15.75 km, a final walk of about 160 m, and a regular fare of ₱39.00.
5. Pick "My location" under From and any stop under To. If your position is within 500 m of a route line, expect a plan with a walk to the route. If it is farther, expect "Your start is … from the nearest route. The walking limit is 500 m." with the actual distance.
6. Record the result, then turn airplane mode off.

### S3-M2 discount

1. In Profile, under Fare type, choose Regular. On the Plan tab, plan "Imadejas Pob. (Bgy. 24), Butuan City" to "De Oro, near the Free Methodist Church". Expect a 16.12 km ride and ₱41.00 with "Regular fare".
2. Choose Student, then Senior Citizen, then Person with Disability. Each time expect ₱32.75, the line "<type>: 20% discount", and "₱32.80 before rounding to the nearest ₱0.25".
3. Choose Regular again. Expect ₱41.00.
4. Choose Student. Close the app fully (swipe it away from recent apps), reopen it and connect to the dev server. Expect Profile to still show Student.
5. Record the result.

### S3-M3 on-device benchmark

1. On the Plan tab, scroll to the bottom and tap "Run routing benchmark (development)".
2. Wait for the line "1000 trips: p50 …, p95 …, max …". Run it three times.
3. Record the three p50 and p95 values, the phone model, its RAM and the API level.
4. The PRD target is 250 ms or less at p95 on a 3 GB phone. Route data version 2 has about 460 points per line instead of 6, so expect much higher times than the version 1 run (on the PC p95 went from 0.8 ms to 29 ms).

### S3-M4 destination behind

1. On the Plan tab, From "8-318 M. Calo St, Butuan City", To "553 R. Calo, Butuan City (Dunkin Donut)".
2. Expect the ride step to name "Route 4 (De Oro), return" (the destination is behind on the outbound line), 0.31 km, ₱15.00.
3. From "De Oro, near the Free Methodist Church", To "553 R. Calo, Butuan City (Dunkin Donut)". Expect the return line, 14.19 km, ₱37.00 regular.
4. From "8-318 M. Calo St, Butuan City", To "Tandang Sora Pob. (Bgy. 12), Butuan City". Expect "No route goes from your start to this destination in its direction of travel." The return path does not pass Tandang Sora, and reaching it would need a ride to the terminal and a second ride, which v0 does not plan.
5. Pick the same stop for From and To. Expect the same message and no crash.
6. Record the result.
