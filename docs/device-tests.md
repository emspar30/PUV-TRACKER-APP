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
| 2026-10-04 | Merged app on `main` (Emjay's test) | `Pixel_7` emulator (x86_64) | 34 | Old debug APK from 2026-10-02 23:48 (R1a **not** built), Emjay's Metro server | **Pass** for everything tested; location pending | Run and reported by Emjay. **Pass:** app opens; My Ride IMA to DEO; sheet dragging; Light and Dark; Settings avatars (own set plus Shuffle). **Not tested:** saved settings after the upgrade. **Expected behaviour:** replaying the intro offers no avatar choice. This is by design (D3: the avatar is assigned automatically; Shuffle is in Settings). **Pending, to be supplied by Emjay:** Locate me, blue dot, deny and manual pin, outside the map. |
| 2026-10-04 | UX3-M1 to M4 | `Pixel_7` emulator (x86_64) | 34 | Old APK (2026-10-02), Emjay's Metro server | **Pass** | Run by the agent. Live: clean map, "Pick a route"; R4 showed the line, stops, "No data", Show whole route, direction chips, and the greeting hid. Check-in: the line and station chips after R4. My Ride: clean; IMA to DEO drew only the amber ride and the pins (₱26.50, Student); Clear removed it. **Fixed during the run:** "Pick a route" was shown twice; the route was framed before the sheet rose, so picking a route no longer opens the sheet. **Note:** at expanded, the chevron sits under the dev client's floating gear (development builds only). |
| 2026-10-04 | RR1-M1 to M3, render before and after | `Pixel_7` emulator (x86_64) | 34 | Old APK (2026-10-02), Emjay's Metro server | **Pass** | Run by the agent. The three chips; R3 green with no stops; R4 return leg with stops; R5 return leg; others faint. DEO → RCA ₱36.00 (student); swapped: "Wrong direction for this route". Check-in R3: "No stations on this route yet". **Frame stats (`dumpsys gfxinfo`, scripted swipes and double-tap zoom, R4 selected; emulator, not representative of a phone; counts only the app's UI frames, not the MapLibre surface):** before 12 and 14 frames, janky 92 % and 100 %, p90 42 and 53 ms, p95 48 and 65 ms; after 13 and 13 frames, janky 100 %, p90 61 and 53 ms, p95 65 and 57 ms (within noise). |
| 2026-10-05 | Tiles v2: upgrade, fresh install, offline, render | `Pixel_7` emulator (x86_64) | 34 | Old APK (2026-10-02), Emjay's Metro server | **Pass** | Run by the agent. **Upgrade:** the phone had `butuan.v1.pmtiles`. After the new JavaScript loaded, `[tiles] installed butuan.v2.pmtiles in 4311 ms`, and the folder then held only v2, so v1 was removed after v2 was in place. **Fresh install** after `pm clear`: installed in 3025 ms. In a development build the copy includes fetching 3.7 MB from Metro; a release build reads it from the APK (faster, unverified). **Offline:** airplane mode on (`airplane_mode_on` 1, ping "Network is unreachable"), bundle through `adb reverse`; the map and R4 drew; airplane mode turned off again afterwards. R5's northern end now has map under it. **Frame stats** (same method, R4 selected; emulator, not representative of a phone): 13 and 18 frames, janky 100 % and 89 %, p90 65 and 53 ms, p95 69 and 77 ms (within the noise of RR1's 48 to 77 ms). |
| 2026-10-05 | RR1 single-leg routes draw solid | `Pixel_7` emulator (x86_64) | 34 | Old APK, Emjay's Metro server | **Pass** | Run by the agent. R4: solid teal line with arrows (no pale band); sheet shows a Return chip and a "Partial" chip; the legend swatch is solid. R3 and R5 faint at 8 %. |
| 2026-10-05 | AF1-M1 text cleanup and first-run hints | `Pixel_7` emulator (x86_64) | 34 | Old APK, Emjay's Metro server | **Pass** | Run by the agent after a cold restart. **Live:** at half, the hint "Pick a route to see it" with an X; R4 then showed Return and Partial chips, the six stop chips and "Details" (legend hidden); no "No data from riders" line, no stops list; one "Sample data" chip in the header. **Check-in:** hint "Pick your route, then station"; R4 and DEO gave "Check in at DEO"; no "Waiting" heading or sign-in line; the "No data" count pill sits below the station chips. **My Ride:** "Sample data" chip under From and To (header), hint "Where are you going?"; DEO to RCA then Clear: the hint did not come back. **Restart:** after X on the Live hint and a force-stop, Live and My Ride showed no hint and Check-in still did. **Not checked:** `pm clear` (fresh install), TalkBack reading the count pill, dark theme. |
| 2026-10-05 | LB1a-M1 offline glyph proof | `Pixel_7` emulator (x86_64) | 34 | Old APK, Emjay's Metro server restarted with `--clear` (for the `pbf` asset type) | **Pass** | Run by the agent with `MAP_LABEL_PROOF_DEV` on. First launch: `[glyphs] installed (6 files) in 1991 ms` (development build, files fetched from Metro); next launches `already-installed in 26 ms`. "Butuan" drawn at the city centre at zoom 10.8 in Light and in Dark. **Offline:** airplane mode on (`airplane_mode_on` 1, ping "Network is unreachable"), cold restart (bundle through `adb reverse`): the label drew in Dark, then in Light after switching; airplane mode turned off afterwards and ping answered. Folder names with spaces worked. **Note:** the first attempt failed with "Unable to resolve module …0-255.pbf" because Metro had not yet been restarted. |
| 2026-10-05 | AF2-M1 Demo switch; backlog 68 | `Pixel_7` emulator (x86_64) | 34 | Old APK, Emjay's Metro server | **Pass** | Run by the agent. Settings shows "Demo data" with On selected by default; Off and On both selected and stayed after closing Settings. Nothing visible changes yet (vehicles come in AF3). **Backlog 68:** reproduced on a Fast Refresh of `RouteDataProvider.tsx` ("The route data could not be loaded … NativeDatabase.execAsync … NullPointerException"), and "Try again" failed as before. After the fix (each open gets its own connection, `useNewConnection`, and the previous handle is closed first), the app recovered on the next Fast Refresh, and two more Fast Refreshes of the same file kept the route data. After that Fast Refresh, Settings was left as the only screen ("GO_BACK was not handled"), development only; a cold restart cleared it. |
| 2026-10-05 | AF3-M1 demo vehicles on Live; 50-marker stress | `Pixel_7` emulator (x86_64) | 34 | Old APK, Emjay's Metro server | **Pass** | Run by the agent. **R4 picked:** header chip "Demo" (replacing "Sample data"), pill "Live", 2 markers in the route colour with seat-tier rings, heading cones and a "DEMO" badge; one greyed (the route's silent vehicle, Stale). Over 45 s at zoom 13 the moving vehicle advanced along the line in its direction, the cone pointing ahead; the silent one stayed put. No vehicles before a route is picked (UX3). **Demo data off:** R4 showed no vehicles, "No data" and "Sample data"; back on restored them. **Stress** (`DEMO_STRESS_DEV`, 50 markers on R4, set back to off afterwards): all three seat tiers visible. **Frame stats** (`dumpsys gfxinfo`, the RR1 swipe and double-tap script from the whole-route view; **emulator, not representative of a phone**; UI frames only): normal demo 15 and 22 frames, janky 67 % and 59 %, p50 17 ms, p90 250 and 27 ms, p95 400 and 32 ms; a third run right after a cold start was much worse (p50 85 ms, p95 550 ms), so the spread is mostly emulator noise. 50 markers: 14 and 16 frames, janky 86 % and 88 %, p50 25 and 21 ms, p90 46 and 48 ms, p95 69 and 48 ms. Memory (PSS): 683 MB with normal demo after a cold start, 794 MB with 50 markers after use (development build; not comparable runs). Markers update their GeoJSON data once a second; the layers are never remounted. The PRD target (55 FPS with 50 markers) is still to be measured on the partner's phone. **Found and fixed:** Live kept refreshing vehicles while another tab was in front, which made the emulator slow to respond to taps; vehicles now refresh only while Live is in front. |
| 2026-10-05 | LB1 licences screen | `Pixel_7` emulator (x86_64) | 34 | Old APK, Emjay's Metro server | **Pass** | Run by the agent. Settings → About shows the one-line Noto Sans credit and a "Licences" row; Licences shows "Map data", "© OpenStreetMap contributors" with the ODbL note, "Noto Sans (map labels)", "Copyright 2022 The Noto Project Authors" and the full OFL 1.1 text. |
| 2026-10-05 | RR2 first-pass snapping and Draft chips | `Pixel_7` emulator (x86_64) | 34 | Old APK, Emjay's Metro server | **Pass** | Run by the agent. My Ride, DEO to RCA (Student): "Board near DEO", "Get off near RCA", a "Draft" chip, **₱28.00** (13.05 km; before RR2 the planner took the second pass of RCA on the trace's tail, 18.64 km, ₱45.00 regular, ₱36.00 Student). "All routes" shows "Draft" on every route card. The stored lines are unchanged (no `--write`). |
| 2026-10-05 | My Ride direction messages | `Pixel_7` emulator (x86_64) | 34 | Old APK, Emjay's Metro server | **Pass** | Run by the agent. MCA to DEO: "R4 · this way isn't mapped yet", no Swap button in the card (the header's swap icon stays). The "wrong direction" and "different routes" cases are covered by unit tests only (no such pair exists in today's data). |
| 2026-10-07 | R1a build | `Pixel_7` emulator (x86_64) | 34 | R1a: `expo-system-ui`, `expo-splash-screen`, new icons; Expo patch updates (`expo` 57.0.27, `expo-asset` 57.0.19, `expo-constants` 57.0.21, `expo-linking` 57.0.12, `expo-router` 57.0.25, `expo-sqlite` 57.0.4) | **Built and running** | Built by Emjay (`prebuild --platform android --clean`, `run:android`). Agent's check: `android/` regenerated 2026-10-07, APK `lastUpdateTime` 2026-10-07 12:15:32, `expo install --check` up to date, `expo-doctor` 21/21. |
| — | ST1 smoke test | `Pixel_7` emulator; partner's Poco X6 Pro | 34; 36 | R1a | **Pending manual QA** (Emjay, 2026-10-07) | The seven checks (cold starts and splash, crash log, tabs and skeletons, consent and blue dot, withdraw, 28 m Fake GPS at check-in, live R4 markers and ETA) are to be run by hand, on the emulator and on the partner's phone. |
| — | PC1-M1 to M8 | `Pixel_7` emulator; a physical phone for M4 | 34; — | R1a plus the PC1 JavaScript (no rebuild) | **Not run yet** | Compliance batch of 2026-10-08 (STATUS row 6o). The Energy migration is pushed, so M7 applies to live data too |
| — | RR3-M1 to M5 | `Pixel_7` emulator | 34 | R1a plus the RR3 JavaScript (no rebuild) | **Not run yet** | Real route data, version 6 (STATUS row 6p) |
| 2026-10-08 | Emulator QA: C1, RP1, N1, SB2, B-batches, PC1, RR3 | `Pixel_7` emulator | 34 | R1a plus `523319f` JavaScript | **Partly passed; 16 findings** | Agent's run, ~14 minutes, Demo data on, then off and signed in as the team test account. Findings EQ-1 to EQ-16 below, for ST2. Live check-in not completed (EQ-16) |
| | S2-M3 ten minute soak (without GPS) | | | | not run yet | Needs ten minutes of panning and zooming by hand. No crash was reported during Emjay's shorter manual check. |
| | S2-M2 blue dot, S2-M4 permission denied | | | | deferred (GPS-free order) | Plan Revision 1. |
| 2026-10-12 | DR4-M1 to M9 | Two physical Android phones: phone A (driver), phone B (nRF Connect) | not recorded | EAS `preview-driver` build `5161a334` | **Pass** (Emjay) | QR setup, Nearby devices and notifications, "Beacon on". Phone B (nRF Connect, no UUID filter on Android: found as the nameless, non-connectable device next to it) showed the service UUID `45ca985d-065a-488b-b652-af6ec6cf1b4e`; PRD 0.2 S6 acceptance met. Emjay reports the other checks passed too. Not recorded: phone models and Android versions, M4's battery drop and temperature, M6's time to resume (ask before the field tests) |
| 2026-10-12 | DR5-M1 (one phone) | Xiaomi/POCO 2311DRK48G, Android 16 (HyperOS), driver and gateway apps on the same phone and SIM (sending to its own number) | not recorded | EAS `preview-driver` `1ca117e7`, `preview-gateway` `f24d8954` | **Pass** (Emjay) | Data SMS sent by the carrier test, received while the driver app was in the background, accepted; counts on the map and list. First try dropped as `wrong_sender`: the phone still had its DR4 setup (DRV-0001); set up again with `dev-driver-qr.ts`. Both apps needed their SMS permission allowed (restricted setting on Android 16). **Beacon bug found** (from DR4): the app crashed on "Turn beacon on" (`IllegalArgumentException: callback instance already associated with advertising`, two service starts 40 ms apart), and after the app was swiped from the recent apps (`SwipeUpClean`, which kills the beacon service on this phone) the strip said "Beacon starting" for ever. Fixed in code, to verify on the next driver build |
| 2026-10-13 | Beacon fix (backlog 101) | Xiaomi/POCO 2311DRK48G, Android 16 (HyperOS) | not recorded | EAS `development-driver` `2349c793` | **Pass** (Emjay) | Admin: beacon off and on; the app swiped away from the recent apps and reopened; Bluetooth off. Emjay: "it seems to work fine". The strip's exact words ("Beacon restarting", "Bluetooth is off") and how long the restart took were not recorded |
| 2026-10-14 | DR6-M1 to M5 and After | No phone: worker (`npm run worker:dev`, `SMS_PRIMARY_ENCODING=data`) and `fake-gateway.ts` on the team PC, against the live project, 11:16 to 12:18 Manila | — | Code at `2449a8e` | **Pass**, all five and After | Run by the agent with the owner's approval; times UTC. The active R4 phone is **DRV-0002** (`+63995•••6412`), not DRV-0001. **M1:** check-in 03:17:16, `queued` (`first`) 03:17:45, printed 03:17:55 (39 s), all 18 R4 stops with `SMB:1`, `[valid for DRV-0002]`. **M2:** `--end` 03:18:16, `cleared` 03:18:44, `SMB:0` printed 03:18:52, then nothing. **M5** (`--fail 3`): #25 printed and failed at 11:24:18, :29 and :40, then stayed `failed` (attempts 3, error `fake`). **M4:** gateway stopped 03:26; #26 queued 03:29:45 was still `queued` past its `expires_at` (expiry is applied by `worker_claim`, at the next pull) and became `expired` when the gateway came back at 03:40:26; #27 (03:35:15, under 10 min old) and newer ones were sent; nothing older. This also recorded a `latency_p90` alert (p90 316 s, 3 samples), correct for the outage. **M3:** the worker raised a `gateway_heartbeat` alert at start-up for **GW-01** (active, never seen), which holds the one-per-kind-per-hour window, so GW-99's gap (last heartbeat 03:41:38) was recorded at 04:17:15, the first cycle after the hour (`ops_alerts` 15, listing GW-01 and GW-99); GW-01 gave one alert per hour, not one per cycle. **After:** `--retire` (GW-99 off); no `+639` followed by 9 digits, key or token in the worker or gateway output. **Observed:** a check-in right after a `cleared` message is a change of 1, below `SMS_DISPATCH_MIN_CHANGE` (2), so it waits for the 5-minute `interval` (M5's check-in at 03:20:38 was queued at 03:24:14); by design (PRD 9.6), but it affects DR7-M2's timing (backlog 113). Queue to delivery took 4 to 11 s whenever the gateway was up |
| 2026-10-17 | DR8-M1, M2, M4, M5 and the "Also" row | **Phone A** (driver): Xiaomi/POCO 2311DRK48G, Android 16, `development-driver` `2349c793`, set up with the real code DRV-0003 (R4, TEST 001, short id 1). **Phone B** (commuter): HONOR X8c (ABR-LX2), Android 15, TNT SIM, `development` `e447a702` (#9), team test account, Demo data off. Both on USB, JavaScript from this PC's dev servers | 35, 36 | As named | **Pass**: M1, M2, M4 (check-in half), M5, location off, Bluetooth off, the 15-minute stop. **Not run**: M3 (needs a second driver phone), M4's SMS half (DR7, SIM load) | Run by the agent through `adb` (taps, screen dumps, screenshots), the owner placing the phones. **M1:** the explainer, then Android's "find, connect to, and determine the relative position of nearby devices" prompt; Allow. With the phones about a metre apart on the desk the smoothed signal sat at **−65.5 to −67 dBm**, just under the presence threshold (stronger than −65), so nothing was found in 32 s while the scan itself delivered 197 results in 69 s (`dumpsys bluetooth_manager`). **Side by side: −46 to −48 dBm**, found in **8.5, 8.6, 8.6 and 6.6 s** from the Relay tap (screen read every 2 to 3 s), one server check each; the card "Found by Bluetooth · R4 · TEST 001" with the Route pickers hidden. A relay sent from it: post 372, vehicle `R4-TEST-01` filled in from the beacon, `beacon_ok` true. **M2:** a real code from phone A, 2 slots old, through `verify_beacon` as the test account: `beacon_expired`; the newest code at the same moment: `ok`. **M4:** simulated location at SMB, checked in (every route, R4 included): the server counted 1 waiting at SMB on R4; Relay next to phone A: "Found by Bluetooth", then the notice "Boarded R4 · TEST 001 · Your check-in has ended"; the server then counted nobody waiting. **M5:** "Not now" left the pickers and a "Find my multicab by Bluetooth" link; refused once: the same; refused twice (Android then blocks the prompt): "Nearby devices is off for Tunton…" with Open settings, which opens Tunton's app info page; the pickers work throughout. **Also:** location setting off: "Turn on your phone's location…"; Bluetooth off: "Bluetooth is off…". 15-minute stop: the first try was interrupted (phone B was picked up and another app opened, so Tunton went to the background and its scan stopped, as designed); **rerun 14:24:18 to 14:39:59 with phone A's Bluetooth off and Tunton in front throughout (checked every minute): "Stopped looking for your multicab…", and no Tunton scan left in `dumpsys bluetooth_manager`** (the native `ARMED_SCAN_MIN` timer). **Findings:** (1) the −65 dBm threshold (PRD 10.1, a starting hypothesis) is barely reached at about a metre on this pair; inside a multicab it would often miss (E1 decides; backlog 117). (2) The introduction's step 4 still says "Nearby multicab detection: Coming later". (3) The location consent text does not mention that Bluetooth scanning relies on location (DPO review). (4) Turning Bluetooth or location on while the panel is open does not restart the search: close and reopen Relay. (5) A development warning, "Can't perform a React state update…", on the first welcome screen. (6) Phone B's SIM is TNT: a Smart/TNT receiver for the carrier test (DR5-M5) |
| 2026-10-17 | DR7-M2 end to end (3 trials), cross-network Globe → TNT, driver UI with real counts | **Gateway:** Xiaomi/POCO 2311DRK48G, Android 16, `development-gateway` `3f7b77d8`, GW-01, Globe SIM (loaded), worker on this PC over USB (`adb reverse tcp:8787`). **Commuter and driver:** HONOR X8c, Android 15, TNT SIM, commuter `development` `e447a702` and `development-driver` `2349c793`, driver set up as DRV-0004 (vehicle `R4-TEST-01`, TEST 001; see note) | 36, 35 | As named; worker `SMS_PRIMARY_ENCODING=data` | **Pass**: a real check-in reached the driver map by a real data SMS from Globe to TNT, 4 of 4 delivered | Run by the agent through `adb`, the owner entering the PINs. **Trials (UTC, check-in tap → worker queued → gateway sent → delivery report):** (1) check-in 07:35:37 → `first` 07:35:44 → 07:35:51 → **07:35:52, 15 s**; (2) "I boarded" 07:39:44 → `cleared` 07:40:14 → 07:40:24 → **07:40:25, 41 s** (the next 30 s cycle); (3) check-in again 07:41:30 → **`new_stop`** 07:41:44 → 07:41:51 → **07:41:52, 22 s** (the 2026-10-15 rule, live: before it this waited up to 5 min); then Cancel → `cleared` → delivered 07:43:21. All four `sms_outbox` rows `delivered`, 1 attempt each. **Driver app (HONOR):** "Updated just now", "Clock OK", SM City Butuan with the green glow on the map, the "MOST WAITING · SM City Butuan · 1" card, the list "SM City Butuan: 1 waiting"; after `cleared`: the card and glow gone, every stop 0. Worker log: no `+639` and 9 digits. **Setup notes:** the driver's SMS permission is a restricted setting on Android 15; on MagicOS the fix is a red "The app has been restricted — Remove restriction?" banner on App info (no ⋮ menu), then the lock-screen PIN; the provisioning command was run with `R4-TEST-01 --replace`, so the Xiaomi's DRV-0003 was retired (it needs a new code to be a driver again). **Findings:** (1) the gateway's service had been killed by the phone and the home screen said "Starting…" with nothing restarting it (backlog 119); Stop then Start sending fixed it; (2) on the HONOR's screen the zoom-in button sits under the plate card, so the zoomed-in discs could not be opened, and "Updated just now" is cut short in the strip (backlog 120); (3) a stop with 0 shows "0" twice (the count and the band chip), by the current design (120); (4) the driver setup says "riders' phones" (118). Not done: DR7-M1's "Send test", M3 to M7, the 20-trial p90 |
| 2026-10-18 | Backlog 119, 120, 118 (3) fixes, JavaScript only | **Xiaomi** 2311DRK48G, Android 16, `development-gateway` `3f7b77d8` (GW-01); **HONOR** X8c (ABR-LX2), Android 15, `development-driver` (DRV-0004, R4, TEST 001) and `development` `e447a702` (#9, team test account). JavaScript from this PC's dev servers (8081 to 8083), 00:29 to 00:41 Manila | 35, 36 | Code after `66178ab` (uncommitted at the time) | **Pass** as far as run | Run by the agent through `adb`. **119:** the Xiaomi's gateway process was gone; its store had `enabled` false and the event log ended "Gateway stopped" at 2026-10-17 15:54, so an admin Stop: the home said "Stopped" and started nothing (correct). **00:47 to 00:50 (owner gave the admin PIN):** Start sending (event "Gateway started" 00:47:48); `am stopservice` is refused for this service, from the shell and as the app; `am force-stop`, then the app opened: "Gateway started" at 00:49:22 with no tap (the home's restart), then "Cannot reach the worker"; Stop sending afterwards. **120:** on the HONOR (360 × 804 dp) the four map buttons stand in two columns below the plate card; the strip's labels wrap ("No update for 529 min", "67% · Charging"); at night the list shows ranges, so the 0 row with an exact count was not seen. **118 (3):** Relay with location and Bluetooth off (both had been turned off on the phone since 2026-10-17): "Turn on your phone's location…"; `cmd location set-location-enabled true`: "Bluetooth is off…" within 4 s; `cmd bluetooth_manager enable`: "Looking for your multicab…" and Tunton's scanner registered; Bluetooth off then on during the search: "Bluetooth is off…", then "Looking…" again; closing the panel removed the scanner. Location and Bluetooth left on. **Also:** the driver home showed an old keep-awake rejection (backlog 121, fixed); reloading the commuter build failed in native code (121), a force stop and cold start worked; Google's Location Accuracy prompt declined. **Later:** `LOCATION_CONSENT_VERSION` 2 on the HONOR: Settings, Location said "Not agreed · Tap to read the notice"; the notice shows the Bluetooth sentence; I agree (back to "Agreed · Android allows it"). 118 (4): the Xiaomi's unused commuter app cleared (owner) and opened at the welcome: no warning; the warning's earlier stacks in `.expo/dev/logs/start.log` point at expo-router's `useLinking` |
| 2026-10-18 | DR7-M2 (3 trials, stopped by the owner) and DR5-M5 (reduced) | **Gateway:** Xiaomi 2311DRK48G, Android 16, `development-gateway` `3f7b77d8`, GW-01, the owner's **personal** Globe SIM. **Driver:** HONOR X8c, Android 15, TNT SIM, `development-driver` (DRV-0004). Worker on this PC (`adb reverse tcp:8787`) for DR7 only | 36, 35 | Code at `99a7b53` (24/7 SMS hours) | **DR7:** 3 of 20, then stopped (owner: task dropped). **DR5-M5:** 13 of 13 arrived intact | **DR7-M2**, 01:11 to 01:17 Manila, `dev-checkin.ts` at SMB on R4 and `--end`, one trial every 150 s: check-in to the driver's "Most waiting" card **32.9, 27.4, 19.0 s**; end to card gone 18.8, 20.2, 30.0 s; `sms_outbox` 34 to 39 all `delivered`, 1 attempt, queue to delivery 4 to 13 s. Too few for a p90. **DR5-M5:** see the DR5-M5 table (8 data, 5 text, one a minute). **Owner, 2026-10-18:** the gateway SIM is personal: send few texts, spaced, with varied content (different stops for check-in tests). Worker and gateway service stopped afterwards; the Xiaomi's stay-awake turned off |
| 2026-10-18 | Backlog 120 (0 row) and 118 (1), daytime | HONOR X8c, Android 15, `development-driver` (DRV-0004) and `development` `e447a702`; JavaScript from this PC (8081, 8082), 11:53 to 12:06 Manila | 35 | Code at `721b589` | **Pass** | **120:** no new SMS: the driver's last heatmap (01:17, all zero) is stale but shows exact counts by day: "Taligaman 0", "Antongalon 0", no band chip, the counts in one column; the stale notice "No update for 640 min" above. **118 (1):** `tunton://onboarding` (same screen as Replay), Continue to step 4: "Nearby multicab detection · Finds the multicab you board, by Bluetooth · In Relay"; Arrival alerts still "Coming later"; left with Back (no Finish). **Also:** the driver app's reload hit backlog 121 (2) again; cold start worked; the HONOR's Bluetooth had been turned off on the phone again |
| 2026-10-18 | DR5-M3 (recorded) and backlog 112 (Stitch screens), no SMS | HONOR X8c, Android 15, `development-driver` (DRV-0004); JavaScript from this PC (8082), 12:09 to 12:13 Manila; Bluetooth turned on for the test (owner) | 35 | Code at `33a7166` | **Pass** (DR5-M3); 112 partly | **DR5-M3:** no message since 01:17 (owner stopped SMS tests): the map's dots grey, the route line faded, the list greyed, "No update for 640/652 min" in the strip and the notice "These counts are old. They may have changed."; never "no one waiting". The 15-minute edge itself is unit-tested (`driverHeatmap.test.ts`, stale at 15:00.0). **112:** see backlog 112 for what matched; the zoom-in button (120) now opens the discs. **Found:** "Turn beacon off" clipped to "Turn beacon" (backlog 123). **Incident:** while entering the admin PIN, digit taps computed from a screenshot landed on the Home button and then the dock, which opened Google Messages on the phone (the inbox list only: one TNT promo thread); closed at once with Home, nothing opened or sent. Afterwards every tap position was read from the screen dump |
| 2026-10-18 | DR5-M6 | HONOR X8c, Android 15, `development-driver` (DRV-0004); the owner texted "hello" from the Xiaomi (an ordinary SMS, not through the gateway app) | 35 | Code at `0b624a3` | **Pass** (Tunton side) | The SMS reached the HONOR at 12:17:10 Manila (`SMS_RECEIVED`, handled by the default SMS app, Google Messages; the agent did not open Messages: the owner's mother's phone). The driver app's Admin afterwards: still 10 accepted, 0 waiting in the inbox, old_sequence 13, newest log entry 01:57:49: the message was not stored, counted or shown. The Messages side ("shows it as usual") is for the owner to confirm on the phone |
| 2026-10-18 | DR5-M4 | **Driver:** HONOR X8c, Android 15, `development-driver` (DRV-0004). **Gateway:** Xiaomi 2311DRK48G, `development-gateway`, Carrier test (service stopped), the owner's Globe SIM | 35, 36 | Code at `35b28a0` | **Pass** (as scripted) | The driver app swiped away from Recents at 12:26:50 Manila (no driver activity left; the process stayed for the beacon's foreground service). One data SMS from the Carrier test at 12:27:04 (sequence 5122, older than the phone's 9 on purpose, so the worker's counter is untouched): sent 1.4 s, delivered 2.4 s. The app reopened at about 12:27:20: Admin showed "12:27:06 · data · old_sequence", old_sequence 14 (was 13), 0 waiting in the inbox. The counts did not change because the message was rejected by design (old sequence); an accepted one would have moved the phone ahead of the worker. Not covered: a fully stopped app (Force stop), which the script excludes. **1 SMS** |

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
| S0 | App installs and opens on a physical Android 8.0+ phone | Passed for the **partner's own code** on his Poco X6 Pro (partner section). Pending for the merged app (ST1). |
| S2 blue dot | The dot follows a real walk | Covered only for the **blue dot of the partner's own code** (partner section). Pending for the merged app (ST1-P1). |
| PC1 offline banner | Airplane mode on a real phone shows the banner within 30 s and it clears after reconnecting (PRD 14) | Pending (PC1-M4) |

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

## UX3 route lines only when a route is selected

Press `r` in the Metro terminal first, to load the new JavaScript. No rebuild is needed.

| Script | Tab | Action | Expected |
| --- | --- | --- | --- |
| UX3-M1 | Live | Open the app | No route line and no stop dots on the map. "Pick a route" in the pill. Chips R3, R4 and R5 in the sheet header (since RR1). No "Show whole route" button (Locate me stays). |
| UX3-M2 | Live | Tap the R4 chip | The R4 line (since RR1 only the return leg, drawn as the pale dashed band) and its six stops, framed above the sheet. Pill "No data". "Show whole route" appears. The greeting card hides. In the sheet: only a **Return** chip (R4 has no outbound), the legend, the stops. Tap R4 again: everything clears. |
| UX3-M3 | Check-in | Open, then tap R4 | Nothing at first ("Pick a route"). After R4: the line and the six station dots in the route colour; station chips appear. Tap R4 again: clears. |
| UX3-M4 | My Ride | From **DEO**, To **RCA**; then Clear; then tap the R4 card in "All routes" | No line before. The trip shows only the amber ride segment and the green and red pins. Clear removes it. The R4 card shows the route (card highlighted); tapping it again hides it. (IMA to DEO now says "Wrong direction": see RR1.) |

## RR1 real route lines

Press `r` in the Metro terminal. The first launch after the update replaces the route rows (data version 3) without clearing app data. If "The route data could not be loaded" appears, force-stop and reopen (backlog 68).

| Script | Action | Expected |
| --- | --- | --- |
| RR1-M1 | Live: tap R3, then R4, then R5 | **R3:** a road-following green line Libertad to Ampayon, both directions overlapping, no stops. **R4:** the return leg De Oro to R. Calo with the six stops. **R5:** the return leg Santo Niño to J C Aquino Ave, no stops; its northern end lies past the tiles (blank map there). The other routes are faint (8 %). |
| RR1-M2 | My Ride: plan the trips below | As in the table |
| RR1-M3 | Check-in: tap R3, then R5 | "No stations on this route yet" |
| RR1-M4 | Light and Dark | Each line readable on both map themes; badges R3 green, R4 teal, R5 orange |

**Trips on R4 (stored direction: De Oro → R. Calo).** Stop order along the line: DEO, MCA, JCA, IMA, TSO, RCA.

| Trip | Result |
| --- | --- |
| DEO → RCA | Works: 18.6 km, ₱45.00 regular (₱36.00 student) |
| DEO → JCA, DEO → MCA, MCA → IMA, JCA → TSO, IMA → RCA | Work |
| IMA → DEO, RCA → anything earlier, TSO → IMA, JCA → MCA | **"Wrong direction for this route"**: the outbound leg is not provided yet |

## PC1 compliance batch (2026-10-08)

Press `r` in the Metro terminal; no rebuild is needed. **Never run PC1-M2 with the shared test account** (`TEST_WRITER_*`): deleting it breaks the live tests. Use a new throwaway account made with Sign up.

| Script | Action | Expected |
| --- | --- | --- |
| PC1-M1 | Signed out: Menu, Settings, Privacy, **Delete account**, then Delete | The dialog says only this phone is cleared. After Delete: the introduction opens; handle, avatar, places, rides and settings are gone; a short "Account deleted" notice |
| PC1-M2 | Sign up a throwaway account, sign in, make one check-in; then airplane mode on, Delete account, Delete | "Account not deleted"; the phone still has the profile and the session. Airplane mode off, Delete again: "Deleting…", then the introduction and "Account deleted". Signing in again with that email and password fails |
| PC1-M3 | Settings, Privacy: tap **Privacy questions**, then **Request my data** | An email app opens addressed to `emspar30@gmail.com` with the subject "Tunton privacy question" or "Tunton data request". With no email app: a dialog with the address |
| PC1-M4 | Demo data off. Airplane mode on (or `adb shell svc wifi disable` and `svc data disable` on the emulator); wait up to 30 s; visit every tab; then turn the network back on | "Offline · Live updates paused" under the top bar on every tab; the map, My Rides and fares keep working. Back online: the banner goes within 30 s or on return to the app. With Demo data on the banner never shows |
| PC1-M5 | Demo data off, signed in as the team test account; `npx tsx scripts/sim-ingest.ts --parked`; simulated stop MCA; tap a test vehicle | The card shows "Prototype data, unverified" and "x.x km from you". With Demo data on, a demo vehicle shows "Demo · …" and the distance, never "unverified" |
| PC1-M6 | Same as M5, then Track | No ETA pill on the card (it read "~212 min" before). Tracking says "ETA unavailable" with "x.x km by road". By day with a moving `sim-ingest` vehicle: no ETA while it is more than 10 km by road away or slower than 5 km/h; an ETA once it is closer and moving |
| PC1-M7 | Look at the top bar, Profile, and the Relay form with GPS on; Track a vehicle with Demo data on | No Energy in the top bar; no Tracking Energy card on Profile; no Energy rows in General history; the Relay GPS line reads "Shows your multicab on the live map until your stop". Tracking starts without a "Not enough Energy" dialog. On live data the same once the Energy migration is pushed |
| PC1-M8 | My Rides: plan MCA to DEO | Under "Estimate": "Does not replace the official fare" |

## RR3 real routes and stops (2026-10-08)

Press `r` in the Metro terminal. The first launch replaces the stored route rows (data version 6) without clearing app data.

| Script | Action | Expected |
| --- | --- | --- |
| RR3-M1 | Map: open the route list | Six routes: "Route 1 (Bancasi - Downtown)" (blue), "Route 2 (Bancasi - Langihan)" (pink), R3, R4, R5, "Route 14 (Robinsons - De Oro)" (yellow). Each line follows the roads; R1 and R2 run Bancasi round downtown and back; R14 stops at Taligaman |
| RR3-M2 | Check-in: All, then each route chip | Station dots on the roads, in the route colour. No dot at Dumalagan, Tiniwisan, De Oro, Santo Niño, Bridgetown or Mahay (left out until corrected) |
| RR3-M3 | My Rides: NIS → LIB; TAL → FSU; LAN → LBT; ROB → TAL; then TAL → ROB | R3, R4, R5 and R14 trips with a fare; TAL → ROB says the route does not go that way (R14's return is not traced) |
| RR3-M4 | Demo data on: Map, R1 and R14 | Demo vehicles drive the new lines; R1 goes round without jumping back; R14 turns at both ends (stand-in return) |
| RR3-M5 | Demo settings: simulated location on | The commuter is at SM City (`SMB`); a device that had MCA saved also lands at SM City |

## DR1 three apps from one codebase (2026-10-12)

Each variant is its own Android project: run its prebuild before building it (the package name differs), and `npm run prebuild:commuter` before going back to the commuter app. Metro for the driver app runs on port 8082, the gateway on 8083.

| Script | Action | Expected |
| --- | --- | --- |
| DR1-M1 | `npm run prebuild:driver`, `npm run android:driver`; the same for gateway; then `npm run prebuild:commuter`, `npm run android` | Three icons with three names on one emulator: Tunton APP, Tunton Driver, Tunton Gateway. The commuter app opens to the Map tab as before (spot-check ST1). The driver app shows "Tunton Driver" and "Not set up yet"; the gateway app "Tunton Gateway" and "Not set up yet". Each keeps working after the others are installed |
| DR1-M2 | `npx tsx scripts/check-apk-permissions.ts <variant> <file>` for each app, with its APK (needs Android SDK build-tools) or `android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml` right after that variant's local build | No FORBIDDEN or MISSING line. UNREVIEWED lines are reviewed and added to `scripts/variant-permissions.json`. The commuter list equals the R1a build's. The driver and gateway apps have no location permission |

**Agent's checks without a native build (2026-10-12):** `npx expo export --platform android --no-bytecode --no-minify` per variant, into a scratch folder. The driver bundle holds the driver screens only; the gateway bundle the gateway screens only; neither holds the Supabase client or the commuter screens (8.3 MB each against the commuter's 14 MB, unminified). The commuter bundle holds no driver or gateway screen. The first driver bundle **did** hold the Supabase client, pulled in through the `@/components` barrel (its top bar reads the session); fixed by importing `@/components/Screen` directly, and now caught by `variantBoundaries.test.ts` and lint.

## DR4 driver phone setup and beacon (2026-10-12)

Needs: a driver build that includes the beacon (a `preview-driver` EAS build made after DR4), phone A as the driver phone, phone B with the free "nRF Connect" app, and the PC with `SUPABASE_SERVICE_ROLE_KEY` in `.env`. The setup QR: `npx tsx scripts/provision-driver.ts --vehicle R4-TEST-01 --plate "TEST 001" --route R4 --phone <phone A's number> --gateway-number <any team number>` (until the gateway exists, DR7). The beacon service UUID is `45ca985d-065a-488b-b652-af6ec6cf1b4e`.

| Script | Action | Expected |
| --- | --- | --- |
| DR4-M1 | Phone A: open Tunton Driver, Allow camera, scan the QR; confirm TEST 001, Route 4; Continue, allow Nearby devices and notifications | "Beacon on"; a "Tunton beacon on" notification; Done shows the home: the status strip (beacon, battery), TEST 001, Route 4 |
| DR4-M2 | Phone B: nRF Connect, Scanner, filter by the UUID above | A device with that service UUID; its service data is 9 bytes starting `01 00 01` (version 1, short id 1 for the first test vehicle); the last 6 bytes **change within 60 s, at each minute boundary** (PRD 0.2 S6) |
| DR4-M3 | Phone A: hold the status strip 3 s, enter the admin PIN; read "Code … · slot …"; within the minute run `npx tsx scripts/decode-beacon.ts` (DR8) or compare with phone B | The same 18-character code as phone B shows. A code copied 3 minutes earlier must fail the server check in DR8 |
| DR4-M4 | Phone A screen off for 30 minutes | Phone B sees the beacon the whole time; record the battery drop and how warm the phone is |
| DR4-M5 | Phone A: Bluetooth off for 1 minute, then on | The strip says "Bluetooth is off"; within 10 s of turning it on, "Beacon on" and phone B sees it again |
| DR4-M6 | Restart phone A and unlock it, without opening the app | Phone B sees the beacon again; record the time it took |
| DR4-M7 | Phone A: Settings, Apps, Tunton Driver, Force stop | Record what happens (expected: the beacon stops until the app is opened; opening it starts the beacon again) |
| DR4-M8 | A phone that cannot advertise, if one is at hand | Setup stops with "This phone cannot act as a beacon" |
| DR4-M9 | Admin: Turn beacon off, then on; then Set up again | Off: phone B stops seeing it; on: back. Set up again returns to the scan screen; the old QR is refused once expired (15 min) |

## DR5 heatmap by SMS and the carrier test (2026-10-12)

Needs: `preview-driver` build `1ca117e7` and `preview-gateway` build `f24d8954` (2026-10-12), or later ones (the gateway build has the carrier test: `EXPO_PUBLIC_CARRIER_TEST=1`), **phone A** (driver) with a SIM, **phone G** (gateway) with a **Smart/TNT** SIM, and a third, personal phone for M2 and M6. No SMS worker yet (DR6): phone G's carrier test sends signed test messages itself.

Set-up: on the PC, `npx tsx scripts/dev-driver-qr.ts --route R4 --gateway-number <phone G's number>` (it asks for an admin PIN, saves nothing, and prints the development SMS key). On phone A: Admin, Set up again (if set up in DR4), scan the code, confirm, allow Nearby devices and notifications, then **Allow text messages**. If Android refuses without a prompt, it is a restricted setting: Open settings, ⋮ (top right), Allow restricted settings, back, Try again (note it, backlog 97). On phone G: Tunton Gateway, Carrier test, Allow SMS and Phone; type phone A's number and the SMS key; route R4.

| ID | Script | Expected |
| --- | --- | --- |
| DR5-M1 | Phone G: Send data (1 message), then Send text (1) | Within seconds phone A's list shows counts for R4's stops and the map's nodes glow by band; the strip says "Updated just now" and, after a message, "Clock OK" (or how far off it is); Admin shows "data · accepted" and "text · accepted" with their sequence numbers |
| DR5-M2 | Phone G, mode `repeat`, then `bad_signature`, then `old_time`, each Send text. Personal phone: text phone A `HM2\|R4\|0001\|1200\|SMB:3\|00000000` | Phone A's counts do not change; Admin, Dropped by reason: `old_sequence 1`, `bad_signature 1`, `stale_time 1`, `wrong_sender 1` (PRD 0.2 S9) |
| DR5-M3 | Send nothing for 15 min (phone A stays on the home screen) | The map and list turn grey, "No update for 15 min" and "These counts are old" (PRD 0.2 S9); never "no one waiting" |
| DR5-M4 | Phone A: close the app (swipe it away, not Force stop). Phone G: Send data. Wait 10 s, open the app | The new counts appear at once (the native inbox kept the message) |
| DR5-M5 | Carrier test, mode `normal`, phone G on Smart/TNT: (1) 20 data SMS (How many 20); (2) 20 text SMS; (3) data with Extra stops raised until a message no longer arrives (the size line shows its bytes); (4) only if some driver SIMs are not Smart/TNT: 5 data SMS to such a SIM | Record in the table below. The result chooses DR6's primary path (`SMS_PRIMARY_ENCODING`) with Emjay, and confirms `DATA_SMS_MAX_BYTES` (133) |
| DR5-M6 | Personal phone: text phone A an ordinary message ("Hello") | Phone A's Messages app shows it as usual; Tunton shows nothing, Admin's log and inbox count do not change |

**DR5-M5 results** (fill in on the day; latency = phone G's send time to phone A's Admin log time, both clocks set automatically):

| Test | Sent | Sent OK (phone G) | Delivered report | Arrived in Tunton (phone A Admin) | Shown in phone A's Messages app or notifications | Latency, typical and worst | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Data SMS, **Globe** gateway to **TNT** driver SIM (2026-10-18; owner cut the run to protect the personal SIM) | 8 | 8 of 8 (1.2 to 1.5 s) | 8 of 8 (2.5 to 2.9 s after send) | **8 of 8**, all `old_sequence` (on purpose: signature valid, the phone's sequence untouched) | No | 2 s typical, 3 s worst (send time on the Xiaomi to receive time on the HONOR, whole seconds; clocks within 1 s) | Mode normal, how many 1, one a minute 01:42 to 01:52 Manila; sequence 5109 up, so the driver (last 9) treats them as old |
| Text SMS, **Globe** gateway to **TNT** driver SIM (2026-10-18) | 5 | 5 of 5 (1.2 to 1.4 s) | 5 of 5 (2.4 to 2.7 s) | **5 of 5**, all `old_sequence` (signature valid: the carrier did not alter the text) | Yes, by design: a message icon appeared in the HONOR's status bar (personal phone: contents not read) | 2 s typical, 3 s worst | 156 septets, one SMS each; 01:53 to 01:57 Manila |
| Largest data SMS that arrived | — | Not run (owner: 10 texts only) | | bytes: (120 sent fine) | | | `DATA_SMS_MAX_BYTES` (133) still unconfirmed on the carrier |
| Data SMS to another network (optional) | 5 | Not run | | | | | Globe → TNT is itself cross-network; Smart (non-TNT) and DITO untested |

## DR6 SMS worker with a fake gateway (2026-10-13)

No phones: the worker and a stand-in gateway run on the PC, against the live project. ~~Between 05:00 and 21:00 Manila only~~: since 2026-10-18 (owner) the worker sends at any hour. Needs: `.env` with `SUPABASE_SERVICE_ROLE_KEY` and the `TEST_*` accounts; `services/sms-worker/.env` with `SMS_PRIMARY_ENCODING=data`; an active R4 driver phone in the database (DRV-0001 from DR4, or set one up with `provision-driver.ts`). Three terminals:

1. `npm run worker:dev`
2. `npx tsx scripts/fake-gateway.ts`
3. the check-in commands below.

| ID | Script | Expected |
| --- | --- | --- |
| DR6-M1 | Terminal 3: `npx tsx scripts/dev-checkin.ts --route R4 --station SMB` | Within about 40 s, terminal 2 prints one message per active R4 phone, `HM2\|R4\|…\|SMB:1,…` with every R4 stop listed (zeros included), marked `[valid for DRV-…]`; terminal 1 logs `queued` with reason `first` |
| DR6-M2 | Terminal 3: `npx tsx scripts/dev-checkin.ts --end` | Within the next cycle, a message with `SMB:0` (reason `cleared`), then nothing more |
| DR6-M3 | Stop terminal 2 (Ctrl+C) for 6 minutes | Terminal 1 logs `alert recorded` with kind `gateway_heartbeat`; one row in `ops_alerts` (Supabase dashboard, Table editor) and no second one within the hour |
| DR6-M4 | With terminal 2 stopped, check in again (M1) and wait 12 minutes; then start terminal 2 | The queued messages become `expired` after 10 minutes (`sms_outbox`); terminal 2 prints no old message when it comes back, only new ones |
| DR6-M5 | `npx tsx scripts/fake-gateway.ts --fail 1`, then a check-in | The first message is reported failed and printed again on a later pull (re-queued); after 3 failures a message stays `failed` |
| After | `npx tsx scripts/fake-gateway.ts --retire`; `Select-String` the worker's output for `\+639\d{9}` | GW-99 switched off; no full phone number anywhere in the logs |

## DR7 gateway app and the first end-to-end run (2026-10-13)

Needs: a `development-gateway` build made after DR7; the worker running on the laptop (`npm run worker:dev`, DR6) and **no fake gateway** (both would take the same queue: run `npx tsx scripts/fake-gateway.ts --retire` first); load on the gateway SIM; the phone on USB with `adb reverse tcp:8787 tcp:8787`. With one phone, it is the gateway and the driver phone at once (texts to its own number, as in DR5). Gateway setup code: `npx tsx scripts/provision-gateway.ts --gateway GW-01 --phone <this phone's number> --worker-url http://localhost:8787`. The driver phone in the database must be this phone's number and its driver app set up with **that** device's code, so the keys match (`provision-driver.ts --replace` for the vehicle, then Set up again in the driver app).

| ID | Script | Expected |
| --- | --- | --- |
| DR7-M1 | Gateway app: scan, confirm, permissions, background, SIM, "Send test" to a team number, Start | The test shows Sent ✓ then Delivered ✓; the home screen says Running, and "Last check … s ago" stays under 10 s |
| DR7-M2 | **End to end:** `npx tsx scripts/dev-checkin.ts --route R4 --station SMB` (any hour since 2026-10-18) | Within about 40 s the gateway log shows `pull`, then `sent` and `delivered`; the driver app shows SMB with 1 waiting. Record the time from the check-in command to the driver update, 20 times; **p90 ≤ 60 s** (PRD 13). PRD 13 measures the gateway's delivery latency (`sms_outbox` `created_at` to `delivered_at`): record that too. Since 2026-10-15 a check-in at a stop the driver last saw empty is sent at the next cycle (`new_stop`), so a trial can start once the previous `--end` has sent its `cleared` text; before that rule, a lone check-in waited up to 5 minutes (DR6 run, 2026-10-14) |
| DR7-M3 | 80 messages in 10 minutes (alternate a check-in and `--end` every 15 s on R4) | All sent, no Android "allow sending many messages?" prompt. If it appears, the limiter setting did not take (runbook 11.3 step 4): record the phone |
| DR7-M4 | Gateway screen off for 8 h on the charger | `gateways.last_heartbeat_at` keeps moving; no `gateway_heartbeat` alert |
| DR7-M5 | Airplane mode on the gateway for 10 min while someone is checked in | An alert after 5 min; the queued texts expire after 10 min; after reconnecting only fresh ones are sent |
| DR7-M6 | Restart the gateway phone, unlock it, do not open the app | The "Tunton gateway on" notification comes back and sending resumes; record the time |
| DR7-M7 | Take the SIM out for 2 minutes during demand | Sends fail with an error code and go back to the queue; they resume when the SIM is back; a failure alert if over 5 % |

## DR8 commuter boarding detection (2026-10-14)

Needs: `20261014000000_beacon_verify.sql` pushed (backlog 114); a commuter `development` build made after DR8 (EAS build #9, backlog 115) on **phone B**, signed in, Demo data off, location consent and permission given, location on; **phone A** running the driver app with a **real** setup code (`provision-driver.ts`; a `dev-driver-qr.ts` code answers `unknown_vehicle`), beacon on. For M3, a second driver phone with its own real code on the same route.

| ID | Script | Expected |
| --- | --- | --- |
| DR8-M1 | B: open Relay 1 m from A. The first time: the explainer ("Find your multicab by Bluetooth"), Continue, allow Nearby devices | Within **10 s** of opening Relay (PRD S7) the card shows "Found by Bluetooth" with A's route badge and plate; the Route and vehicle pickers are hidden. Record the time. Send a relay: the post's `beacon_ok` is true (dashboard, `feed_posts`) |
| DR8-M2 | Replay: an A code from its Admin log (or `lastPayloadHex`) 3 minutes old, through `verify_beacon` (SQL editor as a signed-in user, or the live suite) | Status `beacon_expired` (PRD S7: two or more slots old rejected) |
| DR8-M3 | Two driver phones side by side, B between them | "Two multicabs nearby. Pick yours below." with the pickers; moving B next to one gives "Found by Bluetooth" for that one |
| DR8-M4 | B checks in on A's route at a stop, then opens Relay next to A | The toast "Boarded R… · plate" and the check-in ends (the Check-in tab is free again); the next heatmap message to A shows the stop's count lower |
| DR8-M5 | B, fresh install or Nearby devices revoked: open Relay, "Not now"; then Continue and Deny | The pickers work as before; "Not now" leaves a "Find my multicab by Bluetooth" link; after Deny twice, "Nearby devices is off for Tunton" with Open settings |
| Also | Location off on B; Bluetooth off on B; the panel open for 15 min | "Turn on your phone's location…"; "Bluetooth is off…"; "Stopped looking…" (the scan ends after `ARMED_SCAN_MIN`). Record whether results arrive at all on B with location off but Nearby devices on (Android 12+): the code assumes they do not |

## Emulator QA findings (2026-10-08, for ST2)

Agent's run on the `Pixel_7` emulator (API 34), build R1a with the JavaScript at `523319f`. Seen working: the bundle refreshed (Energy hidden in the top bar and Profile); six routes on the real lines with demo vehicles; vehicle card with ETA, "km from you" and Demo label; tracking free, with ETA, "km by road" and the stop strip; demo check-in with countdown, tab dot and Cancel; live sign-in; live relay without GPS ("Update relayed", First relay badge) shown in Crowdsource with Trusted and "Near SM City Butuan"; Profile badges and places; Settings Privacy rows (contact address shown, the email link opens Gmail); My Rides SMB to BAN on R1, 6.2 km, ₱16.75 Student (₱21.00 regular); a saved old demo stop (MCA) falls back to SM City.

| # | Severity | Where | Finding |
| --- | --- | --- | --- |
| EQ-1 | Major | My Rides fare card (`features/ride/RideCards.tsx`) | No "Estimate" label and no "Does not replace the official fare" (PRD 7.2, 15.3). PC1 put the disclaimer in `RideResult.tsx`, whose fare view is no longer used |
| EQ-2 | Major (confirm on a phone) | Whole app after ~14 min | Touches stopped working (tabs, card); then the map drew only its top half. Native heap 673 MB, total 908 MB PSS. Log: "Can't cancel already finished gesture" just before. The emulator draws GL in software, which counts in that heap, so the partner's phone must confirm (`adb shell dumpsys meminfo com.tunton.app` after 15 minutes of use) |
| EQ-3 | Major | Check-in on live data | The collapsed station card did not expand again after a Cancel, so a live check-in could not be made in this run (linked to EQ-2 or not: retest after a restart) |
| EQ-4 | Medium | Route list, Check-in and Relay chips, Crowdsource filter | Routes sorted as text: R1, R14, R2, R3 … R14 should come last |
| EQ-5 | Medium | Tracking panel | "2 seats open" in green for 14/16 taken, while the vehicle card uses the red Full tier for the same vehicle (13 or more taken is Full, PRD 7.3) |
| EQ-6 | Medium | Profile, Your rides | "Reports 0" after a relay, while the badges count it (First relay earned, Helping hand 1/5). Also the label says Reports where the app says relays |
| EQ-7 | Medium | Crowdsource | The user's own post shows the Flag button instead of "You" |
| EQ-8 | Medium | Profile | The skeleton stayed about 5 to 8 s (expected 0.9 s, `SKELETON_LONG_MS`) |
| EQ-9 | Low | Check-in, first open | The map took about 10 s to draw; meanwhile the screen was light beige in Dark mode (white status text on it) |
| EQ-10 | Low | Check-in, active card | Six route badges stack in a tall column beside the station name |
| EQ-11 | Low | Check-in | A blank dark strip between the top bar and the map; the card covers most station dots, and the camera does not frame the chosen station in the free space |
| EQ-12 | Low | Map, tracking | The commuter's own marker (YOU) sits under the round buttons at the right edge |
| EQ-13 | Low | Route names | Every route card reads "…, outbound"; R3 to R5 names use "Ampayon-Libertad" without the spaces of the new names |
| EQ-14 | Low | Toast over dialog | "Badge earned" toast is drawn under the dialog's dimmed backdrop |
| EQ-15 | Low | Demo settings, Stand at | No chip selected when the saved stop is an old code (MCA); SM City is used but not shown as chosen |
| EQ-16 | Low | Profile, Your places | Places saved before RR3 keep the old placeholder codes (TSO, IMA) |

**ST2 part 1 (2026-10-08).** Fixed: EQ-1 (Estimate pill and disclaimer on the fare card the app uses, `RideCards.tsx`; the unused `RideResult` trip card removed, so the quick fare-type chip that only it used is no longer referenced), EQ-4 (`compareRouteCodes`: R1 to R5, then R14, everywhere), EQ-5 (tracking seats tile in the seat-tier colour), EQ-6 (Profile counts check-ins and relays as the badges do; label "Relays"), EQ-7 (the new post id from `post_report` marks the user's own posts "You"), EQ-9 (the theme canvas covers the map until its style loads), EQ-10 (pinged routes in one wrapping row), EQ-12 (camera keeps clear of the round buttons on the right), EQ-13 (route list without ", outbound"), EQ-14 (toasts drawn above dialogs), EQ-15 (the stop in use shown as chosen), EQ-16 (places saved as old stops move to a current stop within 150 m, else stay as a map point "Near …"). Seen on the emulator after a restart: EQ-1, EQ-4, EQ-13. Held for the phone: EQ-2, EQ-3, and EQ-8 (a 0.9 s timer that ran 5 to 8 s means the JavaScript thread was busy, so it belongs with EQ-2). EQ-11: the strip is the edge of the offline tiles when zoomed out (B8); framing the chosen station is a low-priority enhancement (Emjay, 2026-10-08). The quick fare-type chip stays out: the fare type is set in Profile (Emjay, 2026-10-08).

Not app bugs: the grey gear button on every screen is the Expo development menu (not in user builds); a MapLibre "glClientWaitSync failed" console error at launch comes from the emulator's GL. Switches look half drawn on this emulator (check on a phone).

## Partner's phone results (merged from b21b0c1)

Copied from the partner's commit `b21b0c1` (John Paul Palaran) at the merge on 2026-10-04, unchanged. They were run on **his** code: his Map, Plan and Profile tabs, the straight placeholder lines (route data version 1 at first, then his road-following trace, which the merge keeps only as a candidate). The script names (S0-M1, S2-M0 to S2-M2, S3-M1 to S3-M4) refer to his versions of the scripts. They show that the native build, the offline map, the foreground blue dot and the fares work on a real phone; they do **not** test the merged app, which needs a new development build (see `docs/MERGE_RESULT.md`).

**What carries over to the merged app:** only the blue dot of his own code (a foreground location watch that follows a walk). The merge kept that code almost unchanged. His map, fare and benchmark results ran his own screens and planner, which the merge replaced with ours.

| Date | Script | Device or emulator | Android API | Build | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | S0-M1 | Poco X6 Pro (physical phone) | 36 (Android 16) | EAS Build `13591f67-84b7-4802-8e44-292b3aa4fd78`, `development` profile, finished 11:43 PM | **Pass** | Reported by the phone's owner: APK installed, app loaded from `npx expo start`, the Map, Plan and Profile tabs showed, and the app reopened to the tab screen after closing. First successful Android build of this project, so the native modules (including MapLibre React Native 11.4.1) compile against React Native 0.86.3. Build included `expo-system-ui`. |
| 2026-10-03 | S2-M0 | Poco X6 Pro (physical phone) | 36 (Android 16) | EAS Build `13591f67-84b7-4802-8e44-292b3aa4fd78`, `development` profile, code from the dev server | **Pass** | Reported by the phone's owner: the map displayed on the Map tab. MapLibre on Android reads the local PMTiles file through `pmtiles://file://`, so PMTiles is the tile format for v0. Step 3 (zooming in to see streets and buildings) was not reported separately. |
| 2026-10-03 | S2-M2 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build | **Partly run** (no pass or fail) | Reported: the owner's location showed as a dot on the map. Not yet reported: the explainer card before the system prompt, the dot moving over a 100 m walk, and the follow and re-center button. |
| 2026-10-03 | S2-M1 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build | **Pass** | Reported: with Wi-Fi and mobile data off and the app already open, the map kept working while zooming in and out. Opening the app from cold with no network failed with "cannot connect to the development server". That is expected for a development build, which loads its code from the PC, and is not a map failure; the cold-start check is `S2-M5`. |
| 2026-10-03 | S2-M2 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build | **Pass** (dot follows the phone) | Reported: walking along the street, the blue dot moved, updating roughly every 5 s (the app asks for an update every 2 s or 5 m; at walking pace the 5 m rule sets the rhythm). Distance walked not recorded. Not reported: step 1 (explainer card before the system prompt) and step 5 (follow stops on drag, re-center button). |
| 2026-10-03 | S3-M1 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build, code from the dev server | **Pass** for steps 1 to 4; step 5 open | Reported: Tandang Sora to M. Calo and Tandang Sora to De Oro gave the expected estimates (₱15.00 and ₱33.00). Step 5: "My location" did not give a trip although the owner was beside the road of the route. Under investigation; the placeholder line is straight segments between stops, not the road (see S3 report). |
| 2026-10-03 | S3-M2 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build | **Pass** | Reported: fares exactly as expected (₱33.00 regular, ₱26.50 discounted). Student was still selected after closing and reopening the app. |
| 2026-10-03 | S3-M3 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build (development, so slower than a release build) | **Pass** (p95 within 250 ms) | Reported: p50 0.65 ms, p95 0.72 ms. One run reported (the script asks for three). Phone RAM not recorded. The PRD target is for a 3 GB phone. |
| 2026-10-03 | S3-M4 | Poco X6 Pro (physical phone) | 36 (Android 16) | Same build | **Pass** (steps 1 and 2) | Reported: M. Calo to Tandang Sora used the return line, 1.24 km. Steps 3 and 4 not reported separately. |
