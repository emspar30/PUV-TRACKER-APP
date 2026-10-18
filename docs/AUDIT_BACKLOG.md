# Audit backlog

> Closed and superseded items (numbers unchanged) are in `docs/history/AUDIT_BACKLOG_CLOSED.md`.

Everything Emjay has not verified personally, kept current at every step. Each item says what to check, exactly how, and what to expect. An item leaves this list only when Emjay confirms it; the agent's own runs are recorded in `docs/device-tests.md` and do not close an item.

Last updated: 2026-10-04, after the docs tidy-up (history files moved to `docs/history/`, closed items moved out). Next: Emjay's merge tests and the R1a build, then G0 on "start G0".

> **Emjay's emulator run, 2026-10-04 (old build, R1a skipped):**
> - Passed and closed: 42 (sheet dragging), 46 (Light and Dark), 54 (own-set avatars plus Shuffle).
> - My Ride IMA to DEO passed (item 48 stays open for the fare-type chip agreeing with Settings).
> - Replaying the intro offers no avatar choice. This is **expected behaviour** (D3: automatic assignment, Shuffle in Settings).
> - Location tests (59) are pending.
> - Saved settings after the upgrade were not tested.

> **Do not use the app outdoors or share it before G0 adds the consent screen.** Since the merge, "Locate me" asks for location permission without the consent screen that PRD 7.1 and 15.1 require (Audit 3 §3).

**Note on the UX2 commits.** The first four (`2eda9d0`, `d76f93d`, `3647293`, `9c8eb06`) were grouped by topic from one working tree, so they are not individually verified: an intermediate one may not type-check or pass the tests on its own. This matters only if someone checks out one of them. Every commit from `ebfc0a5` onwards was checked when it was made. **Check-in (49) and About (51) stay open.** The introduction (50) was replaced by F1's four-step version (52, confirmed).

**User flow v2:** approved with your answers (PRD 19.2 and 19.4; decisions now in `docs/IMPLEMENTATION_PLAN_MASTER.md` §9). **Only F1 exists** (approved 2026-10-04). F2 to F5 have not started; they come after G0.

**UX2 is done.** The tabs are Live, Check-in and My Ride; Profile is the Settings sheet behind the avatar button. Older items that described UX1 screens now map to UX2 like this:

| Old item | What it checked | Where to check it now |
| --- | --- | --- |
| 3, 10 | Senior and PWD discounts; classification survives a restart | My Ride result card: the quick fare-type chip, or Settings, Fare type (item 48) |
| 4, 25 | "No trip found" with the distance and the fix buttons | My Ride: the short failure card with the distance and "Move pin to the route" (one button now; the nearest-stop button was dropped for the text budget) |
| 8, 22, 23, 24 | Plan tab end to end: naming, camera fit, guides, ride colour | My Ride: "Near TSO" naming, both pins framed, dotted guides, amber ride |
| 26 | Fare breakdown | My Ride, "Details" (item 48) |
| 27 | Map tab: stop card, whole-route button, legend, "Offline ready" | Live tab: stop card in the sheet, the round button above the sheet, the legend in the half sheet. The "Offline ready" badge was dropped for the text budget. |
| 28 | Three-step introduction | One-screen introduction (item 50) |
| 29 | Avatars | Settings and the introduction (item 50) |
| 30 | About screen | Shorter About (item 51) |
| 20 | Profile without backend keys | Settings, Team account card |
| 32 | Larger font | Repeat on the three tabs and the sheets at font scale 1.3 |

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
| 4 | S3 | "No trip found" message | Emulator | Open |
| 6 | S3 | 250 ms benchmark on a real 3 GB phone | A physical phone | Open, blocked on hardware |
| 7 | S3 | Flat-map snapping: what it does and its accuracy | Command | Open |
| 8 | S3 | Plan tab end to end (not yet tested by Emjay) | Emulator | Open |
| 9 | S3 | Trip planning in airplane mode | Emulator | Open |
| 11 | S2 | Pan limits and the blank strip at the edges | Emulator | Pan confirmed by Emjay; edge appearance open |
| 12 | S2 | Odd straight-edged dark shapes when zoomed out | Emulator | Open, cause unconfirmed |
| 13 | S2 | Tile copy on a fresh install | Emulator, command | Open |
| 14 | S0 | Start-up patch: no red screen over many launches | Emulator | Open |
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
| 27 | UX1 | Map: tappable stops, stop card, whole-route button, legend, "Offline ready" | Emulator | Open |
| 31 | UX1 | Text contrast and the new error colour | Command, emulator | Open |
| 32 | UX1 | Larger system font size | Emulator | Open |
| 33 | UX1 | Development-only controls hidden in a release build | Release build | Open, needs a release build |
| 34 | UX1 | Loading screen, and the first-launch "database is locked" fix | Emulator, command | Open |
| 36 | UX1 | All on-screen text comes from one strings file | Command | Open |
| 38 | Audit 2 | DESIGN.md: the choices between its front matter and its prose | Reading | Open |
| 40 | Audit 2 | `braces` advisory recorded as deferred | Command | Open |
| 41 | UX2 | Native crash on one launch (`SIGSEGV` in `MountingCoordinator::pullTransaction`), observed by the agent on the emulator, cause unknown | Emulator, over many launches (ST1) | Open, cause unknown |
| 43 | UX2 | Flick speed: does a quick flick always go to the next point? | Emulator (mouse), later a phone | Open |
| 44 | UX2 | Map stays usable above the sheet; floating pill and button follow the edge | Emulator | Open |
| 45 | UX2 | Chevron and TalkBack expand and collapse actions | Emulator, TalkBack | Open |
| 47 | UX2 | Three tabs and the Settings sheet; the interim Check-in and My Ride tabs | Emulator | Open |
| 48 | UX2 | My Ride: fare as the big number, quick fare-type chip agrees with Settings | Emulator, command | Open. Emjay: IMA to DEO passed (2026-10-04). Chip-to-Settings agreement not yet confirmed. |
| 49 | UX2 | Check-in tab: 15-minute countdown, I boarded, Cancel, survives a restart | Emulator | Open, **not yet seen on the emulator** |
| 51 | UX2 | Short About screen | Emulator | Open, **not yet seen on the emulator** |
| 56 | F1 | Gender, commuter type, avatar and destinations never reach backend code | Command | Open |
| 57 | F1 | First launch after `pm clear`: the route was framed too high, once | Emulator | Open, cause unknown |
| 59 | Merge | "Locate me", explainer, blue dot, follow, location off, outside the map (MERGE_RESULT section 6, tests 3 to 6) | Emulator (old build is fine; R1a skipped for now) | **Pending: results to be supplied by Emjay** (his 2026-10-04 run did not include them) |
| 60 | Merge | R1a: new launcher icon, light system bars, no crash on start | Emulator and phone after R1a | Open |
| 61 | Merge | The merged app on the partner's phone, including the bottom sheet and the walk test | Partner's phone after his rebuild | Open |
| 62 | Merge | Splash screen: `expo-splash-screen` added (approved) | Emulator and phone after R1a | Open: check the white splash with the logo on a cold start |
| 63 | Merge | Candidate Route 4 trace: validate before activating (JCA projects onto the junction) | Import script (on hold) | Open |
| 65 | UX3 | Live: clean map until R4 is picked; line, stops, switches and "Show whole route" only then (UX3-M1, M2) | Emulator (press `r` in Metro) | Open (agent: seen on the emulator) |
| 66 | UX3 | Check-in: route first, route-coloured station dots (UX3-M3) | Emulator | Open (agent: seen on the emulator) |
| 67 | UX3 | My Ride: trip draws only the ride segment; "All routes" card toggles the route (UX3-M4) | Emulator | Open (agent: seen on the emulator) |
| 68 | RR1 | "The route data could not be loaded" (`NativeDatabase.execAsync` `NullPointerException`) after a Fast Refresh; "Try again" failed, a cold relaunch fixed it. Seen once by the agent on 2026-10-04 (old build). Likely development-only. **Fix not applied:** "Try again" already re-runs the whole open, migrate and load (the same path as the lock retry) and still failed, so a retry in that style would not help. A real fix would close the stale native database handle on reload, which is a different kind of change. **Decision (Emjay, 2026-10-05):** stays open; the proper fix is proposed when AF2 reworks the data interfaces. **Cause found in AF2 (2026-10-05):** on a Fast Refresh, expo-sqlite returns its cached native connection for the same file to the new handle; when the old JavaScript handle is released, the native side closes that shared connection, so the new handle's calls fail (and "Try again" gets the same broken connection). **Fix applied** (small, unit-tested in `repositories.test.ts`): open with `useNewConnection: true`, and close the previously opened handle (kept on `globalThis`) before opening again. Reproduced and then recovered on the emulator; three Fast Refreshes without the error. | Emulator, watch over reloads | Open: fixed, please watch for it during your own reloads |
| 69 | RR1 | Real lines for R3, R4 and R5; R3 and R5 without stops; trips in the stored direction (RR1-M1 to M4) | Emulator (press `r`) | Open (agent: seen on the emulator) |
| 70 | RR1 | Legs to supply: R4 outbound; rest of the R4 return; R5 outbound; rest of the R5 return (list in `docs/route-trace.md`). Until then the other direction says "Wrong direction for this route". | Data from Emjay | Open |
| 71 | RR1 | Frame times: the emulator's janky-frame figures are **not representative of a phone**. Repeat `adb shell dumpsys gfxinfo com.tunton.app` with a route selected and a scripted pan and zoom on the partner's phone when he tests. | Partner's phone | Open |
| 73 | RR1 | Single-leg routes (R4, R5) draw solid with arrows and show a "Partial" chip on Live and on the My Ride card; R3 keeps the dashed return beside its outbound | Emulator | Open (agent: seen on the emulator) |
| 74 | AF1 | Text cleanup: Live has no "No data from riders" line and no stops list (stop chips only); the legend sits under "Details"; Check-in shows the count pill only; one "Sample data" chip per screen, in the header; shorter location, profile and welcome text (AF1-M1: read each tab) | Emulator | Open (agent: seen on the emulator) |
| 75 | AF1 | First-run hints, one per tab: shown until X is tapped or the hinted action is done (Live: pick a route; Check-in: check in; My Ride: set From and To), then never again, also after a restart. Recheck after `pm clear` (AF10-M1) | Emulator | Open (agent: seen on the emulator, without `pm clear`) |
| 76 | LB1a | Offline glyph proof: set `MAP_LABEL_PROOF_DEV` to `true`, reload, see "Butuan" at the city centre in Light and Dark with airplane mode on; set it back. About shows the Noto Sans credit. Still to check: first-launch copy time in a **release** build (budget 300 ms; 1,991 ms in development), and the app size (+0.54 MB, over the 0.5 MB budget) | Emulator; release build later | Open (agent: seen on the emulator) |
| 77 | AF2 | Settings → "Demo data": On by default; Off removes all demo data (AF3: no vehicles, the header goes back to "Sample data"); the choice survives a restart (AF2-M1) | Emulator | Open (agent: switch seen on the emulator) |
| 78 | AF3 | Pick R3, R4 and R5 in turn and watch for 2 minutes each: 2 or 3 "DEMO" vehicles move along the line in its direction, stop at stops (Stopped shows as a white centre after 45 s), seat-tier rings vary, and one per route goes grey (Stale) and later disappears (No data) for about 11 minutes, then returns. Light and Dark. (AF3-M1) | Emulator | Open (agent: R4 seen on the emulator) |
| 79 | AF3 | 50-marker frame rate on the partner's phone: set `DEMO_STRESS_DEV` to `true` in a development build, pick R4, run the `gfxinfo` swipe script, set it back. PRD 13 target 55 FPS. Emulator numbers in `device-tests.md` are not representative. | Partner's phone | Open |
| 80 | LB1 | About → Licences: the OpenStreetMap credit with the ODbL note, "Copyright 2022 The Noto Project Authors" and the full SIL OFL 1.1 text (embedded from `assets/glyphs/glyphs-v1/OFL.txt` by `scripts/generate-font-licence.ts`; a test keeps them equal). Check it reads well and scrolls. | Emulator | Open (agent: seen on the emulator) |
| 81 | RR2 | First-pass snapping: DEO to RCA is 13.05 km (₱35.00 regular); a line that passes a stop twice uses the first pass ahead of the origin. "Draft" chips on the My Ride result and on every "All routes" card. Routing benchmark p95 on the PC: 0.026 / 1.08 / 7.67 ms (4 / 400 / 2,000 points; was 0.021 / 0.68 / 3.05), budget 250 ms. | Emulator | Open (agent: seen on the emulator) |
| 82 | RR2 | **Decision for Emjay:** the R4 trace passes the Jeepney Terminal at **157 m** (on Magsaysay St), just over the 150 m trim limit, so the importer does **not** trim R4's 4.06 km tail (R5 is 23 m away and its 2.82 km tail is trimmed in the dry run). Confirm the terminal position, or a trim point on the line, or a larger limit. | Emjay | Open |
| 83 | RR3 | Read the dry run (`npx tsx scripts/import-route.ts`) and confirm: R4 trim (82), the loops marked CONFIRM, and whether to supply per-direction files (`route_<n>_outbound.geojson`, `route_<n>_return.geojson`) or a cycle file with its turnaround. Nothing is written until "write routes". | Emjay | Open |
| 84 | My Ride | Direction messages: MCA to DEO says "R4 · this way isn't mapped yet" with no Swap; a pair served by no single route shows "No one route serves both" with the route badges near each point; "Wrong direction for this route" with Swap stays for a route whose other direction is mapped. | Emulator | Open (agent: MCA to DEO seen) |
| 85 | AF3 | Turnaround fix. **Cause of the "stopped for good" R5 vehicle:** the route's silent vehicle (DEMO 01 on the current seed): during its 11-minute quiet spell it stays at its last position (greyed, Stale, gone after 10 min), near Langihan at the end of the R5 line. It was not the end of the stored line, a stop that never ended, or a snapping or heading bug. **Fix anyway:** at a leg end a vehicle drives on to the next leg that starts within 300 m; otherwise a 30 s layover (shown as Stopped), then a restart at the first leg's start, hidden for about 1 s either side. Watch R5 for 3 minutes near its end. | Emulator | Open |
| 86 | LB1b | Labels are built (city 11, barangay and major road 13, street 15; under the route lines; 50 % while a route is selected; Settings → Map labels; 4.5:1 tested) but **not yet seen or measured**: emulator automation was stopped (2026-10-05). Before numbers: map frames p50 61 ms, p95 91–95 ms (SurfaceFlinger), UI p50 19–30 ms; emulator, not representative of a phone. To do: look at zoom 11, 13, 15 in Light and Dark, then repeat the measurement with labels on. | Emulator | Open |
| 72 | RR1 | Tracing method for the three lines, "to be confirmed by the user" in `docs/route-trace.md` | Emjay | Open |
| 64 | Merge | Dev-client crash "App react context shouldn't be created before" (`DevLauncherAppLoader`), on the old 2026-10-02 build; who observed it is not recorded | Emulator and phone after R1a (ST1-M5) | Open, cause unknown |
| 87 | DR1 | Three apps from one codebase: build and install the driver and gateway apps beside the commuter app; three icons, three names; the commuter app opens and behaves as before, the driver app shows "Tunton Driver · Not set up yet", the gateway app "Tunton Gateway · Not set up yet" (DR1-M1). Prebuild per variant first (`npm run prebuild:driver`, then `npm run android:driver`; the same for gateway; `npm run prebuild:commuter` to go back) | Emulator, approved builds | Open
| 88 | DR1 | Permission check on each built app: `npx tsx scripts/check-apk-permissions.ts <variant> <apk or merged AndroidManifest.xml>`; review every UNREVIEWED line and add the accepted ones to `allowed` in `scripts/variant-permissions.json`; the commuter list must match the R1a build's (DR1-M2) | A built APK, or a local Gradle build | Open
| 89 | DR3 | Apply the driver-side database: add `SUPABASE_SERVICE_ROLE_KEY` to `.env`; `npx supabase login`; `npx supabase link --project-ref <ref>`; `npx supabase db push --dry-run` must list **only** `20261013000000_driver_side.sql` (`energy_on` is already applied live); then `npx supabase db push`; then `npx jest tests/integration/driverSide.test.ts` passes (not "NOT RUN") | You, live project | Open (agent, 2026-10-12: linked by Emjay; dry run listed only DR3; pushed with approval, plus the fix `20261013000001_ops_alerts_kind.sql`; live tests 9/9; no test rows left; remote up to date)
| 90 | DR3 | Paste the two new retention jobs (end of `supabase/cron/retention.sql`) into the SQL Editor; Database, Cron Jobs lists `retention-sms-outbox` and `retention-ops-alerts` | You, dashboard | Open
| 91 | DR3 | Intermittent failure in the commuter-side live suite (`tests/integration/supabase.test.ts`): 1 test failed in 2 of 6 full `npx jest` runs on 2026-10-12 (it passes alone and in the other runs; first seen before the DR3 live tests ran, so not caused by them). Next time it fails, run `npx jest tests/integration > jest.log 2>&1` and look for the `●` line naming the test; a likely suspect is a timing-sensitive live test under the parallel load | Command | Open. **Captured 2026-10-12 (DR5 run):** `S4 backend, live project › realtime delivers a telemetry change` (no realtime event within its 15 s window, in a full 87-suite run); it passed alone right after, in 2.5 s. Likely Realtime delivery under the parallel load. **It failed in all three full runs on 2026-10-12 (the same test each time) and passes alone**: now a steady failure under full-suite load, not a rare one
| 92 | DR4 | Driver phone setup and beacon on two real phones: DR4-M1 to M9 in `device-tests.md` (M2 is the PRD S6 acceptance: the beacon seen by a second phone, its code changing every 60 s). Needs a `preview-driver` build made after DR4 | Two phones, a new build | **Passed by Emjay 2026-10-12** (build `5161a334`); still to note: phone models, Android versions, M4 battery and heat, M6 time to resume
| 93 | DR4 | The Kotlin code (`modules/tunton-beacon`) has not been compiled yet: this PC has no Android build tools. The first EAS build compiles it; `BeaconCodeTest` (the shared vectors in Kotlin) runs only where the SDK is installed: `cd android; .\gradlew.bat :tunton-beacon:testDebugUnitTest` after `npm run prebuild:driver` | A build; a PC with Android Studio | Open. **Compiled** in EAS build `5161a334` (preview-driver, 2026-10-12, finished); `BeaconCodeTest` still not run (EAS preview builds do not run unit tests)
| 94 | DR4 | This PC's `android/` folder is a stale **driver** prebuild from 2026-10-11 21:57 (an earlier session, with an SMS permission no current code adds). Run `npm run prebuild:commuter` (or the variant you need) before any local native build | Command | Open
| 95 | DR5 | The Kotlin code of `modules/tunton-sms` (receiver, inbox, sender) has not been compiled: this PC has no Android build tools. The next `preview-driver` or `preview-gateway` EAS build compiles it | A build | **Compiled** in EAS builds `1ca117e7` (preview-driver) and `f24d8954` (preview-gateway), 2026-10-12, both finished; it runs only on the phones (backlog 96). Close when Emjay confirms
| 96 | DR5 | Heatmap by SMS on real phones: DR5-M1 to M6 in `device-tests.md` (M2 and M3 are the PRD S9 acceptance; M5 is the carrier test that chooses data or text SMS for DR6). Builds: `preview-driver` `1ca117e7` and `preview-gateway` `f24d8954` (2026-10-12). Needs a SIM in the driver phone and a **Smart/TNT** SIM in the gateway phone | Two phones, SIMs, two builds | Open. **2026-10-17 (partial):** 4 of 4 data SMS from the Globe gateway delivered to a TNT phone in 1 to 2 s from sending (DR7 run). The formal carrier test (20 data, 20 text, the size limit) is still to run; the HONOR (TNT) can be its receiver **2026-10-18 (owner):** DR5-M5 done in reduced form (8 data, 5 text, Globe → TNT, all intact); the other-network step is dropped. **2026-10-18 (agent):** DR5-M3 and DR5-M6 pass on the HONOR (no gateway SMS); DR5-M4 passes (1 SMS, swipe-away case); DR5-M2 passes (2 SMS plus the father's phone for wrong_sender). **DR5-M1 to M6 all recorded.**
| 97 | DR5 | Android 13 and later can block the SMS permissions of an app installed from an APK file ("restricted setting"): on each driver and gateway phone, note whether the prompt appeared or the setting had to be allowed first (App info, ⋮, Allow restricted settings), with the Android version. The setup screen explains the steps | Phones | Open
| 98 | DR5 | If DR5-M5 makes **text** SMS the primary path, every heatmap text also appears in the driver phone's own Messages app (a non-default SMS app cannot stop that since Android 4.4). Decide with the result: turn off Messages notifications for the gateway number on each driver phone (plan risk R1), or keep data SMS | The carrier test result | Open **Moot 2026-10-18:** the owner kept `data` as the primary path.
| 99 | DR5 | A phone set up with `scripts/dev-driver-qr.ts` (development key, made-up vehicle `DEV-R4`, beacon id 65000, nothing in the database) must be set up again with `provision-driver.ts` before it carries passengers; its beacon validates nowhere | Before the pilot | Open. **2026-10-14:** the owner's Xiaomi is on such a code (DRV-9000 on R1), while the database's entry for it is DRV-0002 on R4: set it up again with a real code before DR7 and DR8
| 100 | DR5 | The plan wrote DR5-M1 to M4 for an emulator (`adb emu sms send`), but this PC has no Android SDK. They are written for two phones (the gateway's carrier test sends the messages); `scripts/sms-sign.ts` still prints messages for an emulator if one is set up later. An emulator has no BLE advertising, so the driver setup would stop at the beacon self-test there | Note | Open
| 101 | DR4, DR5 | Beacon fix to check on the next driver build: (1) Admin, Turn beacon off then on, several times: no crash, "Beacon on"; (2) swipe the driver app away from the recent apps, open it again: the strip says "Beacon restarting", then "Beacon on" within a few seconds; (3) Bluetooth off: the strip says "Bluetooth is off" at once. Found on Xiaomi 2311DRK48G, Android 16: two service starts 40 ms apart crashed the app, and a killed service left "Beacon starting" for ever | The next driver build | **Confirmed by Emjay 2026-10-13** on the installed `development-driver` build `2349c793`: off and on, swiped away and reopened, Bluetooth off: "it seems to work fine". The strip's exact words and times were not recorded. Close when Emjay agrees
| 102 | DR9 | Xiaomi/HyperOS kills the app **and its beacon service** when it is swiped away from the recent apps (`SwipeUpClean`), and may block the boot restart. On each Xiaomi driver phone: Settings, Apps, Tunton Driver: Autostart on, Battery saver "No restrictions"; lock the app in the recent apps (hold its card, lock). Repeat DR4-M6 (reboot) on this phone. Other brands may need their own steps (dontkillmyapp.com) | Phones, DR9 runbook | Open
| 103 | DR6 | Run the SMS worker live with the fake gateway: DR6-M1 to M5 in `device-tests.md`, **between 05:00 and 21:00 Manila**. It writes to the live project: queued texts in `sms_outbox`, `sms_dispatch_state`, the R4 phone's sequence number, `ops_alerts`, a development gateway `GW-99`, and a check-in by the team test account | Approval, daytime | **Done 2026-10-14** (owner's approval, 11:16 to 12:18 Manila): M1 to M5 and After pass (`device-tests.md` results log). GW-99 retired. Left in the live project: `sms_outbox` rows 23 to 29 for DRV-0002, `ops_alerts` 13 to 15, R4's dispatch state and DRV-0002's sequence number (last sent: 6)
| 114 | DR8 | Push `20261014000000_beacon_verify.sql` (`npx supabase db push`, dry run first; approval), then run the live suite's DR8 block (`npx jest tests/integration/driverSide.test.ts`, approval): codes at slot 0 and ±1 accepted, ±2 `beacon_expired`, forged `beacon_invalid`, unknown short id, a relay's `beacon_ok`. It checks that the live project has pgcrypto in the `extensions` schema | Approval | **Done 2026-10-15** (owner's approval): dry run listed only this migration; pushed; the live DR8 block passed 4 of 4 (`-t "DR8 boarding detection"`; the DR3 block was not re-run), and cleaned up after itself
| 115 | DR8 | EAS build #9: a `development` commuter build (new native code: the scanner; new permissions). Then `scripts/check-apk-permissions.ts` on it: the commuter APK must list `BLUETOOTH_SCAN`, `BLUETOOTH` and `BLUETOOTH_ADMIN`, and no library may add `neverForLocation`. The Kotlin of `BeaconScanner` is compiled for the first time there | Approval, build | **Done 2026-10-14:** EAS `development` build `e447a702` (#9) finished, so the scanner compiles. Its manifest, read from the APK (no `aapt2` on this PC: a small reader of the compiled manifest): `BLUETOOTH_SCAN` with no `usesPermissionFlags`, `BLUETOOTH` and `BLUETOOTH_ADMIN` to API 30; no advertise, connect, camera, microphone, SMS or background location. Not from DR8 and still unreviewed for a release (`allowed` is empty): `SYSTEM_ALERT_WINDOW`, `CHANGE_WIFI_MULTICAST_STATE`, `ACCESS_WIFI_STATE` (the development client), `ACCESS_NETWORK_STATE`, `VIBRATE`, storage to API 32, `{package}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`
| 116 | DR8 | Device tests DR8-M1 to M5 (`device-tests.md`). The driver phone must carry a **real** code (`provision-driver.ts`; the Xiaomi is on DRV-9000, backlog 99), or `verify_beacon` answers `unknown_vehicle`. Watch: whether results arrive on Android 12+ only with location on (the scan has no `neverForLocation`; the code assumes so and asks for location first), and the time from opening Relay to the card (PRD S7: within 10 s) | Phones, build | **Done 2026-10-17** (Xiaomi driver phone, HONOR X8c commuter phone): M1, M2, M4 (check-in half), M5, the location-off and Bluetooth-off messages and the 15-minute stop pass; M1 in 6.6 to 8.6 s side by side (`device-tests.md`). Not run: M3 (needs a second driver phone) and M4's SMS half (DR7). Findings in 117 and 118 **2026-10-18:** M4's SMS half passes (Xiaomi as DRV-0005, TEST 002; check-in at SJI, boarding by Bluetooth, `cleared` to both R4 phones; 4 SMS). Only M3 (needs a third driver phone) is left.
| 117 | DR8, E1 | The presence threshold `RSSI_PRESENCE_THRESHOLD_DBM` (−65, PRD 10.1, a hypothesis) is barely reached at about a metre: HONOR X8c hearing the Xiaomi (`BEACON_TX_POWER` medium) read a smoothed −65.5 to −67 dBm on a desk, −46 to −48 side by side. A commuter seated 1 to 3 m from a dashboard phone would often not be found. Measure in E1 (in a multicab, seats, pocket, bag, hand; tx power low, medium, high) before changing it; a change is one config commit citing the measurement (DR9 rule) | E1, owner | Open
| 118 | DR8 | Small fixes from the DR8 phone run: (1) the introduction's step 4 still says "Nearby multicab detection: Coming later"; (2) the location consent text does not say that the Bluetooth search relies on location (for the DPO review); (3) turning Bluetooth or the location setting on while the Relay panel is open does not restart the search (close and reopen Relay); (4) a development-only warning, "Can't perform a React state update…", on the first welcome screen; (5) the driver setup's Nearby devices line says "riders' phones" (say commuters); (6) the driver's restricted-setting steps name the ⋮ menu, which HONOR's MagicOS does not have (it shows a "Remove restriction?" banner on App info) | Agent | Open. **2026-10-18 (agent):** fixed (1) the intro row says "In Relay"; (2) the consent's "Why" names the Bluetooth search and that Android needs location for it and `LOCATION_CONSENT_VERSION` is 2 (owner, 2026-10-18), so every commuter reads the notice again: seen on the HONOR (Settings, Location: "Not agreed", the new text, I agree); (3) the open panel reads the location setting, the permission and Bluetooth every 2 s (`SETTINGS_RECHECK_MS`) and starts the search again: **seen on the HONOR**: location on, then "Bluetooth is off…", Bluetooth on, then "Looking for your multicab…"; Bluetooth off and on during the search: the same; (5) and the two other "rider" texts (the beacon notification, the commuter map's "No data from…") say commuters; (6) the step adds "No ⋮? Tap “Remove restriction” on the banner, then enter the screen lock". **(4) upstream, no app change:** `.expo/dev/logs/start.log` holds five of these since 2026-10-03, each from `expo-router/build/fork/useLinking.native.js:127` (`onUnhandledLinking` when the initial URL promise resolves before the NavigationContainer has mounted), not from Tunton's code; development only and harmless; a first launch on the Xiaomi (commuter data cleared, owner) did not show it, so it depends on timing. Report to Expo if it ever shows outside development **2026-10-18 12:05 (agent):** (1) seen on the HONOR (intro step 4: "Nearby multicab detection · Finds the multicab you board, by Bluetooth · In Relay"; left without Finish). (5) to be seen when the Xiaomi is set up as a second driver (DR8-M4; the step needs a setup QR); (6) appears only when SMS is refused, so it stays a code check. **2026-10-18 13:00:** (5) seen on the Xiaomi's setup ("Lets commuters’ phones find this multicab."). Only (6) remains, code-only.
| 119 | DR7 | **Gateway service not restarted.** When the phone kills the gateway's foreground service, the gateway home shows "Starting…" for ever and nothing starts it again (seen 2026-10-17 on the Xiaomi: the service had been gone since an earlier day; Stop then Start sending fixed it). The driver app restarts its beacon when `enabled` and not `running` (DR5 fix); the gateway should do the same, and say so ("Restarting…") | Agent | Open. **2026-10-18 (agent):** fixed: the gateway home starts the service again once each time it finds it enabled but not running with the app in front (`shouldRestartGateway`; again when the app comes back to the front; Android refuses a background start), and says "Restarting…", or "Stopped by the phone. Could not restart it…" when the start fails or SMS is off; 7 tests in `gatewaySetup.test.ts`. On the Xiaomi: a gateway the admin stopped (event log "Gateway stopped", 2026-10-17 15:54) stays "Stopped", as it should. **Seen on the Xiaomi (00:47 to 00:50):** Start sending, then `am force-stop` (process and service gone, no sticky restart), then the app opened: the event log shows "Gateway started" at 00:49:22 with nobody pressing Start; the status went on to "Cannot reach the worker" (worker off). Left stopped afterwards, as found
| 120 | Driver UI | On the HONOR X8c (1080 × 2412) the driver home's zoom-in button is under the plate card (the buttons start at a fixed place, not below the measured top group), and the strip's "Updated just now" is cut to "Updated jus…". A stop with 0 shows "0" twice (exact count and the "0" band chip): hide the chip at 0 or show only one. Check on narrow screens after the fix | Agent | Open. **2026-10-18 (agent):** fixed: where one column of map buttons is taller than the map between the panels, they stand in two (zoom on the right; default view, then names, on the left) and the route is framed clear of them; strip labels wrap to two lines; an exact 0 shows no band chip (an empty space keeps the counts in line). **Seen on the HONOR:** all four buttons below the plate card, the strip's labels whole ("No update for 529 min", "67% · Charging"). **Not seen:** a 0 row by day (needs a heatmap with exact counts) **2026-10-18 11:57 (agent):** the 0 row seen on the HONOR by day: last night's all-zero heatmap (stale) shows "Taligaman 0", "Antongalon 0" with no chip, counts in one column; no SMS needed (exact counts depend on the time now, not on the message). All three parts of 120 now seen.
| 121 | Development | (1) The driver home showed a red "Uncaught (in promise) … ExpoKeepAwake.deactivate … The current activity is no longer available" after a JavaScript reload with the app in the background overnight: releasing the keep-awake lock on unmount is refused when the activity is gone. **Fixed 2026-10-18** (`useKeepAwake(undefined, { suppressDeactivateWarnings: true })`). (2) Reloading the commuter development build that had run since the day before failed in native code (`UnsatisfiedLinkError` in `expo.modules.ui.ExpoUIModule` during `ReactInstance.destroy`); a force stop and a cold start worked. A reload of a development build only; if it recurs, report it to Expo (expo-ui) | Agent | Open **2026-10-18 11:56:** (2) recurred on the HONOR's **driver** app (reload after the old dev server was gone; the same `ExpoUIModule` teardown error, then a blank screen); a force stop and cold start worked again. Workaround for testing: cold-start instead of reloading an app whose dev server went away.
| 122 | DR6, pilot | **SMS hours are all day (owner, 2026-10-18)** so the app can be tested at any hour (`SMS_OPERATING_START_MIN` 0, `SMS_OPERATING_END_MIN` 1440; Q6 was 05:00 to 21:00). Texts still go only while someone waits (plus one `cleared`), so a quiet night sends nothing. Before the pilot, decide whether to keep 24/7 or narrow it again: PRD 9.6's volume estimate (about 170 texts a vehicle a day) assumed 14 operating hours; the gateway SIM's load; a gateway left off at night now raises its hourly heartbeat alert; the team PC must stay awake at night | Owner, before the pilot | Open
| 123 | Driver UI | On the HONOR X8c the admin screen's full-width "Turn beacon off" button shows "Turn beacon": the last word is clipped though the label has no line limit (`Button`, `typography.labelLg`). Probably Android measuring the bold label in a different font than the HONOR draws (MagicOS system font); other labels may clip the same way. Fix to try: a font with known metrics for labels, or `textBreakStrategy`/padding on Android; check on the HONOR | Agent | Open **Fixed 2026-10-18 (agent):** tried on the HONOR, none helped: `textBreakStrategy="simple"`, `fontFamily` Roboto or sans-serif-medium (MagicOS substitutes its own font for every family), `letterSpacing: 0`. Measured 314 px, drawn about 320. Fix: `Button` labels are one line with `adjustsFontSizeToFit` (Android shrinks only a label that would not fit, using the drawing measurement). **Seen:** HONOR "Turn beacon off" in full; Xiaomi unchanged. Side effect: a button label can no longer wrap to two lines; a very long one shrinks instead.
| 124 | Commuter app | Found 2026-10-18: the HONOR's commuter app was **signed out** in the morning although it was signed in at 00:38 (Relay worked). Between them it was force-stopped and cold-started several times (backlog 121 workaround) and replayed the intro. Find out whether a cold start or the intro loses the Supabase session (it should survive both). Also: right after signing in again, the tab labels still said "Check-in, needs an account" until the tab was opened (stale guest label) | Agent | Open **2026-10-18 (agent):** a force stop and cold start keep the session (tried on the HONOR), so not that. Cause found in supabase-js: outside a browser its refresh timer runs always, also in the background, and its docs ask React Native apps to call `startAutoRefresh`/`stopAutoRefresh` on AppState changes; a refresh cut off by Android in the background leaves the phone with a rotated-away token, the next try counts as reuse and the session is revoked. **Fixed:** `startSessionTracking` refreshes only while the app is in front (test `sessionStore.test.ts`); seen signed in after a cold start and a background round trip. **To confirm:** still signed in after a night in the background. The stale tab label is React Navigation's tab bar keeping the old accessibility text until a tab is opened; screen-reader text only, not changed.
| 113 | DR7 | DR7-M2 times "check-in command to driver update", but the dispatch rule (PRD 9.6) sends at once only for the day's first message or a change of 2 or more; a single check-in after a `cleared` text waits for the 5-minute interval (seen in the DR6 run: 3.5 min). The script now says to space trials 5 minutes apart and to record PRD 13's delivery latency (`created_at` to `delivered_at`) as well. Owner to say whether the 60 s target should also hold from check-in to driver (that would need a rule change, such as sending at once when a route goes from nobody waiting to someone waiting) | Owner decision | **Done 2026-10-15:** the owner chose the rule change. `new_stop`: a stop the last message showed empty that now has someone is sent at the next cycle (`src/shared/sms/dispatch.ts`, PRD 9.6 updated). DR7-M2 no longer needs 5-minute spacing; the worker picks the rule up when it is next started
| 104 | DR6 | `SMS_PRIMARY_ENCODING` is `data` for now (it reached a Smart/TNT phone in DR5-M1). Confirm or change it with the carrier test (DR5-M5, backlog 96) before the pilot | DR5-M5 | Open **2026-10-18 (agent):** the carrier test from the Globe gateway to the TNT HONOR: 8 of 8 data and 5 of 5 text SMS sent, delivered and intact, 2 to 3 s (`device-tests.md`, DR5-M5 table). Both paths work Globe → TNT; data keeps the driver's Messages app clear (text showed a notification). Owner to confirm `data`; size limit and Smart/DITO receivers not tested **Decided 2026-10-18 (owner): `data` stays the primary path** (heatmap texts in the driver's Messages app would annoy drivers); no other networks will be tested: Globe → TNT is enough.
| 105 | DR6 | `esbuild` is used through `tsx`'s own copy (0.28.2). Add it as a direct dev dependency (`npm install --save-dev esbuild`, plan approval) so `worker:build` does not depend on another package's dependency; then merge the lockfile's `libc` data back (gotcha: this PC's npm strips it) | Approval | Open
| 106 | DR6 | Sent texts stay in `sms_outbox` until the retention job runs: paste the two jobs (backlog 90) before the pilot | You, dashboard | Open
| 107 | DR6 | Team PC: Task Scheduler start at sign-in, sleep off during SMS hours, Cloudflare Tunnel (`cloudflared`, approval) for the pilot; `services/sms-worker/README.md`, "Team PC" | The team PC | Open
| 108 | DR7 | The Kotlin of the gateway service (`GatewayService`, `WorkerClient`, `GatewayStore`, `GatewayBootReceiver`) has not been compiled: the next gateway EAS build compiles it. `BackoffTest` runs only where the Android SDK is installed | A build | **Compiled** in EAS `development-gateway` build `3f7b77d8` (2026-10-13, finished); `BackoffTest` not run (no SDK here)
| 109 | DR7 | Gateway on real phones: DR7-M1 to M7 in `device-tests.md` (M2 is PRD S9, end to end; p90 ≤ 60 s is PRD 13). Needs a `development-gateway` build, the worker on the laptop, load on the SIM | Phone, build, SIM load | Open. **2026-10-17:** DR7-M2 end to end passed in 3 trials (15, 41, 22 s check-in to delivery; `device-tests.md`), gateway on the Xiaomi (Globe), driver on the HONOR (TNT). Still to run: M1's "Send test", the 20-trial p90, M3 to M7 **2026-10-18 (owner): DR7-M2's 20 timed trials are dropped** (risk to the personal gateway SIM); 3 trials recorded (19 to 33 s).
| 110 | DR7 | Raise Android's outgoing-SMS limiter on the gateway phone (runbook 11.3 step 4: two `adb shell settings put` commands; approval) and record whether the phone honours it (DR7-M3) | Phone, approval | Open
| 111 | DR7 | `specialUse` foreground service: confirm on the gateway phone's Android version that it starts at boot and runs all day (DR7-M4, M6); Android 15 forbids `dataSync` for this | Phone | Open
| 112 | Driver UI | The Stitch designs 3.2 to 3.12 are built (`docs/DRIVER_UI_PRD.md` Part 5) but **not yet seen on a phone**. They are JavaScript only: run `npm run start:driver` with the installed `development-driver` build, no EAS build. Look at: the admin PIN (boxes, keypad, wrong PIN), the admin screen (cards, pills, log), the setup steps (Admin, Set up again, then a code from `dev-driver-qr.ts`, which saves nothing; the restricted-setting steps if Android blocks text messages), the night list after 21:00 ("Ranges only at night" under the heading), and the stale notice (no update for 15 min, DR5-M3). **2026-10-14:** the home was redesigned (`DRIVER_UI_PRD.md` Part 6) and seen by the agent through adb; still to see with a heatmap message: counts on the zoomed-in discs, glow colours, the colour key against them | Phone, dev server | Open. **2026-10-17:** seen on the HONOR with a real heatmap: the glow, the "Most waiting" card, counts in the list, "Updated just now", "Clock OK", and the return to 0. Not seen: the zoomed-in discs (the zoom-in button is hidden on that screen, 120), the stale notice, night ranges **2026-10-18 12:09 to 12:13 (agent, HONOR, no SMS):** seen and matching: 3.2 stale (strip "Beacon on", "No update for 652 min" red, grey dots, faded line, greyed list, red notice); 3.4 night (2026-10-18 00:33: "Ranges only at night", band chips); 3.5 Bluetooth-off strip item; the zoomed-in discs (count in each disc, grey while stale); 3.11 (six boxes, keypad, "Wrong PIN." in red, Unlock disabled until 6 digits); 3.12 (device card, code, messages card, "old_sequence 13" pill, log with drops in red, the "Set up again" confirm area; not confirmed). **Not seen:** 3.3 (fresh setup), 3.6 to 3.10 (setup steps: with the Xiaomi's setup in DR8-M4), 3.5's SMS-off and set-up-again cards, glow colours with real counts by day. **Found:** backlog 123 **2026-10-18 13:00:** 3.3 and 3.7 to 3.10 seen on the Xiaomi's real setup (DR8-M4). Still unseen: 3.6 (scan screen: the code was read before a screenshot), 3.5's SMS-off and set-up-again cards, 3.9's restricted-setting steps.

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

### 4. "No trip found" message

- **Why:** the placeholder return line is the outbound line reversed, so swapping two points always finds a trip. The message cannot be triggered that way and was not seen on the device. Unit tests cover all three reasons.
- **How:** Plan tab: tap the map more than 500 m away from the cyan line for the origin (for example well south of the line), then tap a point on the line for the destination. Then try the other way round.
- **Expected:** a card titled "No trip found". Since UX1 the message gives the measured distance, for example "The origin is 4.2 km from the route. The walking limit is 500 m.", and two buttons (item 25). No crash, and no fare shown.
- **Not reachable with placeholder data:** "the destination is not ahead of the origin". It will become reachable when the real outbound and return paths differ.

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

### 27. Map: stops, whole-route button, legend, "Offline ready"

- **How:** Map tab. Tap a white dot on the map; tap a stop in the list under the map; tap the X on the card. Pan away, then tap "Show whole route".
- **Expected:** a card with the stop's code, its name, "12.8 km from the start of the outbound line" (for DEO) and an amber "Placeholder data" line; the dot turns amber. "Show whole route" brings the full line back into view. A legend explains the solid line, the dashed line, the dots and the arrows. "Offline ready" with a green tick shows once the map file is installed.
- **Not checked by the agent:** tapping a stop in the list after UX1 (only a dot on the map was tapped), and the two direction switches after their restyle.

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

### 36. One strings file

- **How:** open `src/strings/en.ts`. Search the screens for quoted sentences: `npx expo lint` passes, and a search of `src/app` and `src/features` for text inside JSX should find only `strings.` references.
- **Expected:** every sentence shown to the user is in that file, ready for a Cebuano copy. The `DEV` line and the benchmark row are development-only and are not translated.

### 38. DESIGN.md: front matter against prose

- **What:** `docs/DESIGN.md` gives two sets of colours. Its YAML front matter (for example primary `#0041a2`) disagrees with its prose "Colors" section (primary `#0b57d0`). By your decision the prose is used.
- **How:** read the table at the end of Revision 2 in `docs/IMPLEMENTATION_PLAN_v2.md`.
- **Decide:** whether any choice there is not what you meant. Points to look at: the type scale comes from the front matter, because the prose gives none; corners follow the prose tiers; buttons are 48 dp, not 44 px.

### 40. `braces` advisory deferred

- **How:** read `docs/AUDIT.md` section 11.1, then run `npm audit --omit=dev`.
- **Expected:** 38 entries (10 moderate, 28 high), the four advisories listed there, and no fix command run.

### 41. Native crash on one launch (UX2 part 1)

- **Observed by the agent on the emulator, cause unknown.**
- **Rule for ST1 (Emjay, 2026-10-04):**
  - Try to reproduce it.
  - Capture the full crash log and the conditions every time, and count the crashes.
  - **Do not patch any library on one crash.**
- **What:** on 2026-10-03 at 13:48 the app quit about 3 seconds after starting, with `Fatal signal 11 (SIGSEGV)` in `facebook::react::MountingCoordinator::pullTransaction`. That is React Native's native renderer, not app code. The next launch worked, with nothing changed in between.
- **How:** over normal use, note any launch where the app closes by itself. After one, run `adb logcat -d | findstr /C:"Fatal signal" /C:"pullTransaction"`.
- **Expected:** none. If it repeats, record the time and what was on screen. It may be a React Native or `react-native-screens` start-up problem like item 14, and would be reported upstream rather than worked around without your approval.

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

### 49. Check-in tab (local)

- **How:** Check-in tab. Tap a station chip (or a stop dot), then "Check in". Force-stop the app, wait a minute, reopen. Then tap "I boarded". Check in again and tap "Cancel".
- **Expected:** the sheet shows the route badge, the station code and a mm:ss countdown from 15:00, with pills "Not location-verified" and "On this phone only". After the restart the countdown has moved on by the time away. Either button ends the check-in. While a check-in runs, the route and station chips are locked (one active check-in). Nothing is sent anywhere and no permission is asked.
- **Long time away:** not tested by hand. The unit test covers a check-in reopened three hours later: it is expired and shows nothing.
- **Waiting here:** shows "No data" and "Counts need team sign-in" until G1.

### 51. About

- **How:** Settings, About.
- **Expected:** the logo, "Tunton APP" and the version, "© OpenStreetMap contributors", "Sample route data, not official" (while the data is placeholder), "Fare type, avatar and theme stay on your phone", and Back.

## What runs where (S4)

| Tests | Count | Runs | Needs the live project? |
| --- | --- | --- | --- |
| Packet validator, encoding, verification hooks (`packet.test.ts`) | 25 | `npm test`, plain Node | No |
| Ingest rules with in-memory fakes (`ingest.test.ts`) | 22 | `npm test`, plain Node | No |
| Migration text checks (`migration.test.ts`) | 22 | `npm test`, plain Node | No |
| Privacy checks (`privacy.test.ts`) | 3 | `npm test`, plain Node | No |
| Live acceptance tests (`tests/integration/supabase.test.ts`) | 8 | `npm test`, plain Node, over the network | **Yes: skipped and waiting** |

### 56. Private answers stay on the phone (F1)

- **How:** `npx jest src/shared/__tests__/privacy.test.ts src/state/__tests__/profileStore.test.ts`.
- **Expected:** all pass. The checks: no file in `src/services` or `supabase/` mentions gender, avatar, destinations, landmarks or classification; the profile and destinations stores import no network code; no file that imports a service also reads them.

### 57. Route framed too high on the first launch after `pm clear`

- **What:** once, on the first launch right after `pm clear` (while the map tiles were being installed), Live opened with the route at the top edge of the screen. Every later launch framed it correctly, and "Show whole route" fixes it.
- **How:** `pm clear`, open the app, finish or skip the intro, look at Live.
- **Expected:** the whole route in view above the sheet. If it repeats, the likely cause is the first camera fit running before the sheet has its size; F1 did not change that code.

### 58 to 63. Partner merge

- **59 to 61:** the tests in `docs/MERGE_RESULT.md` section 6, after the R1a rebuild (section 5). Until then the emulator's current build may run the merged JavaScript (it does not import `expo-system-ui`), but this was **not checked**: Metro was stopped.
- **60:** the icon images were drawn by the agent from the in-app logo; judge whether they are good enough as a placeholder (item 35).
- **62:** answer question 1 in `docs/MERGE_RESULT.md`.
- **63:** `src/data/seed/r4.traced.candidate.ts` is not active. Its source is unknown until the partner confirms it.
