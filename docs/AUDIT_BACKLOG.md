# Audit backlog

Everything Emjay has not verified personally, kept current at every step. Each item says what to check, exactly how, and what to expect. An item leaves this list only when Emjay confirms it; the agent's own runs are recorded in `docs/device-tests.md` and do not close an item.

Last updated: 2026-10-03, after Audit 2 and its decisions (before UX2).

**Coming change:** UX2 replaces the Map, Plan and Profile tabs with Live, Check-in and My Ride (the fare is part of My Ride; there is no Fare tab), and Profile with a Settings sheet (plan v2, Revision 2). Items 3, 4, 8, 10, 20, 22 to 30 and 32 describe UX1 screens. They are rewritten for the new screens in each UX2 part; until then, check them against the UX1 build only if you want to.

**Before any emulator check**

- Start the `Pixel_7` emulator and the dev server (`npx expo start --dev-client`), then press `a`.
- If a red screen or a blank screen appears at launch, force-stop the app and open it again: `adb shell am force-stop com.tunton.app`.
- Development builds show a line starting with `DEV` at the top left of the Map tab.
- The round grey gear button at the top right belongs to the development client, not to the app. It does not exist in a release build.
- The first launch after an install or after `adb shell pm clear com.tunton.app` opens the introduction (item 28) before the tabs.

## Summary

| # | Step | Item | Needs | Status |
| --- | --- | --- | --- | --- |
| 1 | S2 | 10-minute pan and zoom soak, Map and Plan tabs | Emulator, 10 minutes | Open |
| 2 | S2 | Zoom to level 18 and how the stretched map looks | Emulator | Open |
| 3 | S3 | Senior Citizen and PWD discounts | Emulator | Open |
| 4 | S3 | "No trip found" message | Emulator | Open |
| 5 | S3 | Outbound and Return switches, amber stop highlight | Emulator | Confirmed by Emjay on 2026-10-03; listed for the final audit |
| 6 | S3 | 250 ms benchmark on a real 3 GB phone | A physical phone | Open, blocked on hardware |
| 7 | S3 | Flat-map snapping: what it does and its accuracy | Command | Open |
| 8 | S3 | Plan tab end to end (not yet tested by Emjay) | Emulator | Open |
| 9 | S3 | Trip planning in airplane mode | Emulator | Open |
| 10 | S3 | Classification survives a restart and stays on the device | Emulator, command | Open |
| 11 | S2 | Pan limits and the blank strip at the edges | Emulator | Pan confirmed by Emjay; edge appearance open |
| 12 | S2 | Odd straight-edged dark shapes when zoomed out | Emulator | Open, cause unconfirmed |
| 13 | S2 | Tile copy on a fresh install | Emulator, command | Open |
| 14 | S0 | Start-up patch: no red screen over many launches | Emulator | Open |
| 15 | S0 | App on a physical Android phone | A physical phone | Open, blocked on hardware |
| 16 | S0 | Partner's build on his own PC | Partner | Open |
| 17 | S4 | Database security rules on the live project | Live project | Open, waits for S4 part 2 |
| 18 | S4 | Ingest function running on Supabase | Live project | Open, waits for S4 part 2 |
| 19 | S4 | Sign-in screen and Profile account card | Emulator, live project | Open, waits for S4 part 2 |
| 20 | S4 | Profile tab without backend keys | Emulator | Open |
| 21 | All | Unit tests, type-check and lint | Command | Open |
| 22 | UX1 | Plan: pinned points named from the nearest stop | Emulator | Open |
| 23 | UX1 | Plan: camera fits both points, map can be made taller | Emulator | Open |
| 24 | UX1 | Plan: dashed guides, amber ride, green and red markers | Emulator | Open |
| 25 | UX1 | Plan: failure messages with numbers and the two fix buttons | Emulator | Open |
| 26 | UX1 | Plan: fare breakdown arithmetic | Emulator, command | Open |
| 27 | UX1 | Map: tappable stops, stop card, whole-route button, legend, "Offline ready" | Emulator | Open |
| 28 | UX1 | Introduction on first launch, skip, and replay from Profile | Emulator | Open |
| 29 | UX1 | Avatars: 12 presets, stored on the phone only | Emulator, command | Open |
| 30 | UX1 | About screen | Emulator | Open |
| 31 | UX1 | Text contrast and the new error colour | Command, emulator | Open |
| 32 | UX1 | Larger system font size | Emulator | Open |
| 33 | UX1 | Development-only controls hidden in a release build | Release build | Open, needs a release build |
| 34 | UX1 | Loading screen, and the first-launch "database is locked" fix | Emulator, command | Open |
| 35 | UX1 | Launcher icon and splash screen are still the Expo defaults | Decision, native rebuild | Open, waits for Emjay |
| 36 | UX1 | All on-screen text comes from one strings file | Command | Open |
| 37 | Audit 2 | Read `docs/AUDIT_2.md` and check its claims you care about | Reading, commands | Open |
| 38 | Audit 2 | DESIGN.md: the choices between its front matter and its prose | Reading | Open |
| 39 | Audit 2 | Decisions recorded as you gave them | Reading | Open |
| 40 | Audit 2 | `braces` advisory recorded as deferred | Command | Open |
| 41 | UX2 | Native crash on one launch (`SIGSEGV` in `MountingCoordinator::pullTransaction`) | Emulator, over many launches | Open, cause unknown |
| 42 | UX2 | Swipe the Live sheet to peek, half and expanded by hand | Emulator (mouse) | Open |
| 43 | UX2 | Flick speed: does a quick flick always go to the next point? | Emulator (mouse), later a phone | Open |
| 44 | UX2 | Map stays usable above the sheet; floating pill and button follow the edge | Emulator | Open |
| 45 | UX2 | Chevron and TalkBack expand and collapse actions | Emulator, TalkBack | Open |
| 46 | UX2 | Light and Dark from Settings, including the map and route line | Emulator | Open |
| 47 | UX2 | Three tabs and the Settings sheet; the interim Check-in and My Ride tabs | Emulator | Open |
| 48 | UX2 | My Ride: fare as the big number, quick fare-type chip agrees with Settings | Emulator, command | Open, after part 3 |

## Items

### 1. Ten-minute pan and zoom soak (S2-M3), Map and Plan tabs

- **Why:** the plan requires no crash over a 10 minute session. Nobody has run it. It is not a blocker for S4.
- **How:** note the time. For 10 minutes: pan and pinch-zoom the Map tab about once a minute; switch to the Plan tab, set an origin and destination, pan its map; switch tabs back and forth at least four times; toggle Outbound and Return a few times.
- **Expected:** no crash, no red error screen, no frozen map. Both maps keep drawing.
- **Record:** start and end times in the results log of `docs/device-tests.md`.

### 2. Zoom up to level 18

- **Why:** the zoom allowance was raised from 2 to 4 levels at Emjay's request. The new maximum has not been checked by hand. Tiles stop at level 14, so levels 15 to 18 stretch the same data.
- **How:** on the Map tab, double-tap repeatedly near a stop in town until zooming stops. Read the zoom on the `DEV` line.
- **Expected:** zoom stops at 18.00. Roads and buildings stay sharp (they are shapes, not pictures) but show no extra detail; lines look thick and simple. The route line and stop dots grow with zoom and stay crisp.
- **Decide:** whether 18 is useful, or whether it should come down. It is one constant, `MAP_OVERZOOM_LEVELS`.

### 3. Senior Citizen and PWD discounts

- **Why:** on the emulator the agent tapped only Regular and Student. The other two use the same multiplier and are covered by unit tests, but were not seen on screen.
- **How:** Plan tab: tap stop IMA, then tap the map near the east end of the line. Note the fare. Profile tab: choose Senior Citizen; return to Plan. Repeat with Person with Disability, then Regular.
- **Expected:** for an 8.9 km ride, Regular shows ₱25.00; Senior Citizen and PWD each show ₱20.00. Tap "Show how this was worked out": the discount line names the class ("Senior Citizen discount (20% off)") and the regular fare line reads ₱25.00. In general the discounted fare is 80% of regular, rounded to the nearest ₱0.25.

### 4. "No trip found" message

- **Why:** the placeholder return line is the outbound line reversed, so swapping two points always finds a trip. The message cannot be triggered that way and was not seen on the device. Unit tests cover all three reasons.
- **How:** Plan tab: tap the map more than 500 m away from the cyan line for the origin (for example well south of the line), then tap a point on the line for the destination. Then try the other way round.
- **Expected:** a card titled "No trip found". Since UX1 the message gives the measured distance, for example "The origin is 4.2 km from the route. The walking limit is 500 m.", and two buttons (item 25). No crash, and no fare shown.
- **Not reachable with placeholder data:** "the destination is not ahead of the origin". It will become reachable when the real outbound and return paths differ.

### 5. Outbound and Return switches, amber stop highlight

- **Status:** Emjay confirmed all four checkpoint checks on 2026-10-03. Kept here so the final audit covers it.
- **How:** Map tab: tap Outbound to hide it, then Return. Tap a stop in the list under the map.
- **Expected:** with Outbound off, a lighter band with white dashes and white arrows remains. With Return off, a solid cyan line with cyan arrows remains. The tapped stop's dot turns amber and larger; tapping it again clears it.

### 6. The 250 ms benchmark on a real 3 GB phone

- **Why:** PRD 3.3 sets the target on a low-end phone with 3 GB RAM. So far it has run only on the development PC and the emulator, both much faster than such a phone.
- **Figures so far (plan plus fare, 1,000 trips, 95th percentile):** development PC: 0.03 ms on a 4-point line, 0.7 ms on 400 points, 3.1 ms on 2,000 points. Emulator, placeholder Route 4: 0.03 to 0.05 ms.
- **How, when a phone is available:** install the dev build on it, open the Plan tab, scroll to the bottom, tap "DEV Run routing benchmark (1000 trips)" three times.
- **Expected:** p95 of 250 ms or less. Record the phone model, RAM and Android version. Repeat after the real route geometry is imported, because the placeholder line has only 6 points.

### 7. Flat-map snapping: what it does and its measured accuracy

- **What it is:** `projectOntoLine` in `src/shared/geo/line.ts` finds the point on a route line nearest to a tapped point, and how far along the line it is. Routing, fares and stop ordering all depend on it.
- **What changed:** the first version used the mapping library's geodesic search (it treats the earth as a sphere). It took 134 ms at p95 on a 2,000-point line on the development PC, which would miss the 250 ms target on a phone. It was replaced by a flat-map projection: each segment is treated as a straight line on a flat map centred on the point. Distances along the line still use true ground distance between the line's points.
- **Measured against the old method** (2,000 random points within 600 m of each line):

| Line | Largest difference along the line | Largest difference in distance from the line |
| --- | --- | --- |
| Placeholder Route 4 (6 points, one 11 km segment) | 0.13 m | 0.41 m |
| Straight test line (4 points) | 0.02 m | 0.03 m |
| Winding test line (400 points) | 0.03 m | under 0.001 m |

- **Why the first row is the worst:** on one 11 km straight segment the flat map and the sphere drift apart most. Real traced routes have short segments, like the third row.
- **Effect on fares:** the fare changes at whole kilometres, so a 0.13 m difference matters only for a trip within 13 cm of a kilometre boundary.
- **How to check:** run `npx jest src/shared/__tests__/snapAccuracy.test.ts` and read the three `[snap accuracy]` lines. The test fails if the difference exceeds 2 m along the line or 1 m from it.
- **Speed after the change:** run `npx jest src/shared/__tests__/routing.bench.test.ts` and read the `[routing benchmark]` lines.

### 8. Plan tab end to end

- **Why:** Emjay approved S3 without testing it.
- **How:** Plan tab. (a) Tap a stop in the list, then tap the map near the line. (b) Tap the swap button. (c) Tap the X button. (d) Tap the Destination field, pick a stop, then tap the Origin field and tap the map.
- **Expected:** (a) the origin field fills, the highlight moves to Destination, then three steps appear (walk, ride Route R4, walk), the ride is drawn in amber, and a fare appears with "Estimate only" and an amber placeholder note. (b) The trip flips to the other direction with the same distance. (c) Both fields clear. (d) Each field fills according to which one is highlighted.

### 9. Trip planning in airplane mode

- **How:** run `adb reverse tcp:8081 tcp:8081`. Turn on airplane mode in the emulator. Force-stop the app, then open it with:
  `adb shell am start -a android.intent.action.VIEW -d "exp+tunton-app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.tunton.app`
  Plan a trip as in item 8. Turn airplane mode off afterwards.
- **Expected:** both maps draw and the itinerary and fare appear exactly as when online.

### 10. Classification stays on the device and survives a restart

- **How:** choose Student in Profile, force-stop the app, reopen it, open Profile. Then run `npx jest src/shared/__tests__/privacy.test.ts`.
- **Expected:** Student is still selected. The three privacy tests pass: no code under `src/services` or `supabase/` mentions the classification, and the store that holds it imports no network code.

### 11. Pan limits and the edge of the map

- **Status:** Emjay confirmed panning works and called the behaviour acceptable.
- **Still to look at:** the limit applies to the centre of the screen. Drag the map as far west as it goes: up to half the screen then shows the area beyond the tiles, blank or partly drawn.
- **Decide at the audit:** whether that is acceptable for the defence, or whether the edge of the screen should stop at the boundary instead (more work; it depends on the zoom level).

### 12. Straight-edged dark shapes when zoomed out

- **What:** with the whole route in view (zoom about 11), several large dark shapes with straight edges cross the map.
- **Believed cause, not confirmed:** simplified water or land shapes in the low-zoom tiles of the basemap extract.
- **How:** open `assets/map/butuan.pmtiles` at https://pmtiles.io and look at zoom 10 to 12. Compare with the app.
- **Expected if the belief is right:** the same shapes appear in the viewer, as water or land-cover polygons. If they do not appear there, the app's style is drawing something wrongly and needs a fix.

### 13. Tile copy on a fresh install

- **How:** `adb shell pm clear com.tunton.app`, open the app, read the `DEV` line; force-stop and reopen; then `adb shell "run-as com.tunton.app ls -l files/map"`.
- **Expected:** the first launch opens the introduction; skip it. Then first launch `tiles: installed`, second `tiles: already-installed`, and one file `butuan.v1.pmtiles` of 1775640 bytes. `pm clear` also erases the saved classification and avatar.

### 14. Start-up patch for the navigation library

- **What:** a one-line patch to `react-native-screens` (see `docs/AUDIT.md` section 12.3) stops a red screen at launch. The agent saw 6 clean cold starts in a row after it. The bug was intermittent, so that is not proof.
- **How:** over normal use, note any launch that shows a red screen mentioning `FabricUIManager` or `RNSModule`.
- **Expected:** none. If one appears, check that `npm ci` printed `react-native-screens@4.26.2 ✔` and that the installed APK was built after the patch (2026-10-02, 11:48 PM or later).
- **Reminder:** the patch is a temporary workaround, to be re-checked on any Expo or `react-native-screens` update.

### 15. App on a physical Android phone

- **Why:** PRD 0.2 verifies S0, S2 and S5 on a physical Android 8.0+ phone. Everything so far ran on the emulator.
- **How, when a phone is available:** enable USB debugging, `adb install -r android\app\build\outputs\apk\debug\app-debug.apk`, start the dev server, open the app.
- **Expected:** the same behaviour as on the emulator. Note launch time and any difference.

### 16. Partner's build on his own PC

- **How:** he follows `docs/PARTNER_BUILD_GUIDE.md` and reports back the items in its section 8.
- **Expected:** `BUILD SUCCESSFUL` and the three tabs. His notes tell us which of the three build problems were specific to Emjay's PC and network. He needs the commits from 2026-10-02 and 2026-10-03 pushed first.

### 17. Database security rules on the live project (S4 part 2)

- **Why:** the migration's Row Level Security, grants and policies have only been checked as text (`migration.test.ts`). Nothing has run against a real database, so what the database actually enforces is unproven.
- **How:** after "Supabase is ready" and the migration is applied, run `npm test` with `.env` filled in. In the dashboard, Table Editor, confirm each of the five tables shows "RLS enabled".
- **Expected:** the eight live tests in `tests/integration/supabase.test.ts` pass: an allowlisted account can send telemetry; a direct insert, update or delete on `telemetry_latest` is denied; a non-allowlisted account gets 403; a signed-out caller gets 401; clients see active vehicles only; the allowlist and audit log are unreadable; malformed packets are rejected; Realtime delivers a change.

### 18. Ingest function running on Supabase (S4 part 2)

- **Why:** the function's rules are tested through `ingestCore.ts` with fakes (22 tests). The entry file `supabase/functions/ingest/index.ts` runs in Deno and has never been executed or type-checked: Deno is not installed here, and the file is excluded from `tsc` and lint.
- **How:** after deployment, the live tests above exercise it. Also open the function's logs in the dashboard after a test run.
- **Expected:** no `ingest failed` lines in the logs; the audit log table has one row per accepted or rejected packet from the writer account and none from the outsider.

### 19. Sign-in screen and Profile account card (S4 part 2)

- **Why:** written but never run against a backend.
- **How:** with `.env` filled in and Metro restarted: Profile tab, tap Sign in, enter the writer account; then force-stop and reopen; then Sign out. Try a wrong password.
- **Expected:** "Signed in as <email>" after sign-in and still after a restart; "Not signed in" after sign-out; a red error message for a wrong password, with no crash.

### 20. Profile tab without backend keys

- **How:** before `.env` exists, open the Profile tab.
- **Expected:** the "Team account" card reads "The backend is not set up on this build, so live vehicle positions are unavailable." The classification picker, the map and trip planning all work.

### 21. Unit tests, type-check and lint

- **How:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npx expo-doctor`.
- **Expected on 2026-10-03, after UX1:** 21 test suites, 273 tests passed and 8 skipped (the live-project tests); type-check and lint with no output. `npx expo-doctor` was last run in S4 part 1 (21 of 21 checks) and not re-run in UX1, which changed no dependency.

### 22. Plan: pinned points are named from the nearest stop

- **How:** Plan tab. Tap the map a little way off the cyan line.
- **Expected:** the Origin field reads like "Near MCA, 480 m from the route", with the coordinates in a small grey line under it. A point on a stop chip shows the stop's code and name instead.
- **Tests:** `npx jest src/shared/__tests__/planGuidance.test.ts` (fixed fixture, not the live seed).

### 23. Plan: the camera fits both points

- **How:** set an origin and a destination far apart, then swap them, then change one.
- **Expected:** each time, the map moves so both pins are in view with a margin. With one pin only, it centres on that pin. The bar under the map ("Show more of the map", or the trip summary such as "5.4 km ride, about ₱15.25") collapses the panel so the map takes most of the screen; tapping it again brings the panel back.

### 24. Plan: guides, ride and markers

- **How:** plan a trip from a point off the line.
- **Expected:** a green round marker for the origin and a red one for the destination; a dotted line from each pin to the place it joins the route, with a small amber dot there; the ride drawn as a thick amber line with a dark outline. No text is drawn on the map.

### 25. Plan: failure messages and the two fix buttons

- **How:** tap the map more than 500 m from the line for one of the points.
- **Expected:** "No trip found", then the measured distance and the limit, for example "The destination is 2.6 km from the route. The walking limit is 500 m.". Two buttons: "Move destination to the route" moves the pin to the nearest point on the line; "Use stop IMA as destination" replaces it with the nearest stop. Either one produces a trip. If both points are too far, the message names both.
- **Not reachable with placeholder data:** "wrong direction" (see item 4). It is covered by unit tests.

### 26. Plan: fare breakdown

- **How:** with a trip showing, scroll to the Fare card and tap "Show how this was worked out".
- **Expected:** rows for the base fare and its distance, the extra kilometres and their cost, the regular fare, the discount (only for a discounted class), the rounding, and the total. The "Estimate only" label and the amber placeholder note stay. Seen by the agent for a 5.4 km Student trip: ₱15.00 + ₱4.00 = ₱19.00, less ₱3.80, rounding + ₱0.05, total ₱15.25.
- **Tests:** `npx jest src/shared/__tests__/planGuidance.test.ts src/shared/__tests__/fare.test.ts`: 6.3 km regular is ₱21.00; Student is ₱16.80 before rounding and ₱16.75 after.

### 27. Map: stops, whole-route button, legend, "Offline ready"

- **How:** Map tab. Tap a white dot on the map; tap a stop in the list under the map; tap the X on the card. Pan away, then tap "Show whole route".
- **Expected:** a card with the stop's code, its name, "12.8 km from the start of the outbound line" (for DEO) and an amber "Placeholder data" line; the dot turns amber. "Show whole route" brings the full line back into view. A legend explains the solid line, the dashed line, the dots and the arrows. "Offline ready" with a green tick shows once the map file is installed.
- **Not checked by the agent:** tapping a stop in the list after UX1 (only a dot on the map was tapped), and the two direction switches after their restyle.

### 28. Introduction on first launch

- **How:** `adb shell pm clear com.tunton.app`, open the app. Go through the three screens; on a second try use Skip. Later, Profile, "Show the introduction again".
- **Expected:** three screens: welcome; fare classification and avatar; what stays on your phone. "Start using the app" or Skip opens the Map tab on a first launch and returns to Profile on a replay. Choices made on the second screen appear in Profile. No permission dialog appears at any point.

### 29. Avatars

- **How:** Profile tab: tap an avatar, force-stop and reopen. Then run `npx jest src/shared/__tests__/privacy.test.ts`.
- **Expected:** 12 presets (four shapes in three colours), no photo or upload option. The choice survives a restart. The avatar appears on Profile and in the introduction only, never on the map. The privacy tests confirm that no code under `src/services` or `supabase/` mentions the avatar or the classification.

### 30. About screen

- **How:** Profile, "About this app".
- **Expected:** app name and version; "© OpenStreetMap contributors" with a short explanation; an amber note that route and fare data are placeholders; a list of what is stored on the phone; a Back button.

### 31. Text contrast

- **How:** `npx jest src/shared/__tests__/contrast.test.ts`.
- **Measured (on the canvas, on a card):** primary text 19.18 and 16.50; grey secondary text 7.48 and 6.43; cyan 13.71 and 11.79; amber 10.98 and 9.45; green 7.56 and 6.50. All pass 4.5.
- **Two failures found and fixed:** the crimson used for error text measured 4.54 on the canvas but **3.91 on a card**. Error text now uses a lighter red, `danger` `#FF6B7A` (6.97 and 6.00); crimson stays for the destination marker, which is a shape, not text. Switched-off direction buttons were drawn at half opacity, which brought their text to 2.86; they now show an "eye off" icon instead of fading.
- **Look at:** the sign-in error message once the backend exists (item 19), which uses the new red.

### 32. Larger system font size

- **How:** `adb shell settings put system font_scale 1.3`, look at each tab, then `adb shell settings put system font_scale 1.0`.
- **Expected:** text wraps onto more lines and nothing is cut off. Stop names in the horizontal stop list are shortened with "…" after two lines; the full name is on the stop card. Checked by the agent at 1.3 on the Map and Plan tabs only.

### 33. Development-only controls in a release build

- **What:** the `DEV` line on the Map tab and the "DEV Run routing benchmark" row on the Plan tab render only when `__DEV__` is true.
- **Why open:** only development builds have been made, so nobody has seen them absent. This needs a release build, which is a native build and has not been requested.

### 34. Loading screen and the first-launch database fix

- **What happened:** during UX1 a first launch after `pm clear` showed "The route data could not be loaded ... database is locked". The development client started the app twice a few seconds apart, and the second start found the database still locked by the first.
- **Fix:** a locked database is now retried (10 tries, 500 ms apart, both in the config module) before any error is shown, and the error screen has a "Try again" button.
- **How:** `adb shell pm clear com.tunton.app` and open the app, three times. Then `npx jest src/shared/__tests__/retry.test.ts`.
- **Expected:** a brief screen with the logo and a loading line, then the introduction. Never the error screen. The agent saw one clean first launch after the fix; the fault was timing-dependent, so one run is not proof.

### 35. Launcher icon and splash screen

- **Status:** not changed. The app icon on the home screen and the splash screen are compiled into the APK, so replacing them needs a native rebuild, which UX1 forbade. A placeholder logo drawn from vector shapes exists in the app (`src/components/Logo.tsx`) and is used on the loading screen, the introduction and the About screen.
- **Decide:** whether to rebuild for the icon and splash, and when.

### 36. One strings file

- **How:** open `src/strings/en.ts`. Search the screens for quoted sentences: `npx expo lint` passes, and a search of `src/app` and `src/features` for text inside JSX should find only `strings.` references.
- **Expected:** every sentence shown to the user is in that file, ready for a Cebuano copy. The `DEV` line and the benchmark row are development-only and are not translated.

### 37. Audit 2

- **What:** `docs/AUDIT_2.md` was written by the agent. Its statements are claims until you check them.
- **How:** read sections 1, 7, 8 and 12. To re-run its gates: `npx tsc --noEmit`, `npx expo lint`, `npm test`, `npx expo-doctor`, `npx expo install --check`, `npm audit --omit=dev`. To check the push record: `git reflog show refs/remotes/origin/main`. To check package changes: `git diff 6cdd86a HEAD -- package.json`.
- **Expected:** the same results as its section 10. Pushes only on 2026-10-02 at 19:55 and 21:28. Four package changes (`expo-asset`, `expo-file-system`, the `react-native-gesture-handler` pin, `patch-package`).

### 38. DESIGN.md: front matter against prose

- **What:** `docs/DESIGN.md` gives two sets of colours. Its YAML front matter (for example primary `#0041a2`) disagrees with its prose "Colors" section (primary `#0b57d0`). By your decision the prose is used.
- **How:** read the table at the end of Revision 2 in `docs/IMPLEMENTATION_PLAN_v2.md`.
- **Decide:** whether any choice there is not what you meant. Points to look at: the type scale comes from the front matter, because the prose gives none; corners follow the prose tiers; buttons are 48 dp, not 44 px.

### 39. Decisions recorded as you gave them

- **How:** read "Decisions after Audit 2" at the top of `docs/IMPLEMENTATION_PLAN_GPS.md`, and its new questions N1 and N2 in section 11.
- **Expected:** fifteen rows matching your message of 2026-10-03.
- **Two assumptions to confirm:**
  1. The Team account card is kept in the Settings sheet below your five rows (N1).
  2. The G1 check-in allowlist reuses `telemetry_writers` unless you want a separate list (N2).

### 40. `braces` advisory deferred

- **How:** read `docs/AUDIT.md` section 11.1, then run `npm audit --omit=dev`.
- **Expected:** 38 entries (10 moderate, 28 high), the four advisories listed there, and no fix command run.

### 41. Native crash on one launch (UX2 part 1)

- **What:** on 2026-10-03 at 13:48 the app quit about 3 seconds after starting, with `Fatal signal 11 (SIGSEGV)` in `facebook::react::MountingCoordinator::pullTransaction`. That is React Native's native renderer, not app code. The next launch worked, with nothing changed in between.
- **How:** over normal use, note any launch where the app closes by itself. After one, run `adb logcat -d | findstr /C:"Fatal signal" /C:"pullTransaction"`.
- **Expected:** none. If it repeats, record the time and what was on screen. It may be a React Native or `react-native-screens` start-up problem like item 14, and would be reported upstream rather than worked around without your approval.

### 42. Swipe the Live sheet by hand

- **How:** on the Live tab, drag the grey handle (or the "R4 IMA → DEO" row) up slowly and let go about a third of the way up the screen; then drag it to near the top; then drag it back down. Do it with the mouse in the emulator window.
- **Expected:** it settles at the nearest of three heights: a 72 dp strip (peek), about 40% of the screen (half), about 90% (expanded). It springs into place, never stops in between. At expanded the stop list scrolls; at half and peek it does not. Coming down from expanded, the content is back at its top.
- **Note:** at expanded, dragging the content down does not collapse the sheet: drag the handle or the header row instead. This is the fallback you allowed for the nested gesture.

### 43. Flick speed

- **How:** from half, flick up quickly over a short distance; from expanded, flick down quickly.
- **Expected:** a quick flick goes to the next point in its direction even when released close to the current point. The speed that counts as quick is `SHEET_FLICK_VELOCITY_DP_S` (500 dp per second) in the config. A drag also counts as quick if its average speed reaches that, because a finger that pauses before lifting reports 0.
- **Decide:** whether 500 feels right. It is one constant.

### 44. Map above the sheet

- **How:** with the sheet at half, pan and pinch the map in the part above it. Drag the sheet slowly and watch the "No data" pill and the round "Show whole route" button. Tap the button.
- **Expected:** the map moves; the sheet does not. The pill and the button ride just above the sheet's top edge and fade out as it opens fully. The button frames the whole route above the sheet. The OpenStreetMap credit is at the top left and is never covered.

### 45. Chevron and TalkBack

- **How:** tap the small chevron at the top right of the sheet four times. Then turn on TalkBack (Settings, Accessibility), focus the handle and use the "Expand" and "Collapse" actions (swipe up or down with one finger on Android's adjustable control).
- **Expected:** the chevron goes peek, half, expanded, then back to peek. TalkBack reads "Panel, Half open" and expand and collapse move one step. TalkBack was not tested by the agent.

### 46. Light and Dark

- **How:** tap the avatar at the top right, choose Dark, close the sheet; then choose Light.
- **Expected:** every screen, the sheet, the chips, the map and the route line follow. The choice survives a force-stop. The status bar icons follow; the navigation bar may not until R1 adds `expo-system-ui`.

### 47. Three tabs and Settings

- **How:** tap each tab, then the avatar button.
- **Expected:** exactly three tabs: Live (compass), Check-in (pin), My Ride (route icon). There is no Fare tab; the fare is part of My Ride.
- **For now:**
  - Check-in shows a "Coming soon" placeholder until part 4.
  - My Ride still shows the old Plan screen, with its map strip, until part 3.
- **The Settings sheet:**
  - Rows: Fare type (four chips), Theme (Light, Dark), Avatar (12), About, Replay intro, and the Team account card below them (question N1).
  - It closes with the X or by tapping the dimmed map.
  - The round grey gear that floats on the screen belongs to the development client and does not exist in a release build.

### 48. My Ride: the fare and the quick fare-type chip (after part 3)

- **How:** on My Ride, set a From and a To so a trip is found. Read the fare, then tap the fare-type chip on the result card and choose Student. Open Settings from the avatar: Fare type should read Student. Choose Regular there and return: the chip should read Regular and the fare go back up.
- **Expected:** the fare is the big number with a peso icon, a distance chip and "Estimate". "Details" shows base fare, extra km, discount, rounding and total. The chip and Settings always show the same choice. Then run `npm test`: the fare tests (6.3 km: ₱21.00 regular; ₱16.80 then ₱16.75 student), the shared-setting test and the three-tab test pass.

## What runs where (S4)

| Tests | Count | Runs | Needs the live project? |
| --- | --- | --- | --- |
| Packet validator, encoding, verification hooks (`packet.test.ts`) | 25 | `npm test`, plain Node | No |
| Ingest rules with in-memory fakes (`ingest.test.ts`) | 22 | `npm test`, plain Node | No |
| Migration text checks (`migration.test.ts`) | 22 | `npm test`, plain Node | No |
| Privacy checks (`privacy.test.ts`) | 3 | `npm test`, plain Node | No |
| Live acceptance tests (`tests/integration/supabase.test.ts`) | 8 | `npm test`, plain Node, over the network | **Yes: skipped and waiting** |
