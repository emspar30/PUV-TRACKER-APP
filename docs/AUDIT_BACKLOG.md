# Audit backlog

Everything Emjay has not verified personally, kept current at every step. Each item says what to check, exactly how, and what to expect. An item leaves this list only when Emjay confirms it; the agent's own runs are recorded in `docs/device-tests.md` and do not close an item.

Last updated: 2026-10-03, during S4 part 1.

**Before any emulator check**

- Start the `Pixel_7` emulator and the dev server (`npx expo start --dev-client`), then press `a`.
- If a red screen or a blank screen appears at launch, force-stop the app and open it again: `adb shell am force-stop com.tunton.app`.
- Development builds show a line starting with `DEV` at the top left of the Map tab.

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
- **Expected:** for an 8.9 km ride, Regular shows ₱25.00; Senior Citizen and PWD each show ₱20.00 with "discount applied. Regular fare ₱25.00." In general the discounted fare is 80% of regular, rounded to the nearest ₱0.25.

### 4. "No trip found" message

- **Why:** the placeholder return line is the outbound line reversed, so swapping two points always finds a trip. The message cannot be triggered that way and was not seen on the device. Unit tests cover all three reasons.
- **How:** Plan tab: tap the map more than 500 m away from the cyan line for the origin (for example well south of the line), then tap a point on the line for the destination. Then try the other way round.
- **Expected:** a card titled "No trip found". First case: "The origin is more than 500 m from the route." Second case: "The destination is more than 500 m from the route." No crash, and no fare shown.
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
- **Expected:** first launch `tiles: installed`, second `tiles: already-installed`, and one file `butuan.v1.pmtiles` of 1775640 bytes.

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
- **Expected on 2026-10-03:** 18 test suites, 231 tests passed and 8 skipped (the live-project tests); type-check and lint with no output; 21 of 21 doctor checks.

## What runs where (S4)

| Tests | Count | Runs | Needs the live project? |
| --- | --- | --- | --- |
| Packet validator, encoding, verification hooks (`packet.test.ts`) | 25 | `npm test`, plain Node | No |
| Ingest rules with in-memory fakes (`ingest.test.ts`) | 22 | `npm test`, plain Node | No |
| Migration text checks (`migration.test.ts`) | 22 | `npm test`, plain Node | No |
| Privacy checks (`privacy.test.ts`) | 3 | `npm test`, plain Node | No |
| Live acceptance tests (`tests/integration/supabase.test.ts`) | 8 | `npm test`, plain Node, over the network | **Yes: skipped and waiting** |
