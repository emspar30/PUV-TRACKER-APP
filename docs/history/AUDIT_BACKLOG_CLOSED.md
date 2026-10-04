# Audit backlog: closed and superseded items

Moved out of `docs/AUDIT_BACKLOG.md` on 2026-10-04. Item numbers are unchanged. Each row ends with why it left the live list.

| # | Step | Item | Needs | Status | Why closed |
| --- | --- | --- | --- | --- | --- |
| 3 | S3 | Senior Citizen and PWD discounts | Emulator | Open  Superseded by 48 (My Ride quick fare-type chip and Settings) |
| 5 | S3 | Outbound and Return switches, amber stop highlight | Emulator | Confirmed by Emjay on 2026-10-03; listed for the final audit  Confirmed by Emjay on 2026-10-03 |
| 10 | S3 | Classification survives a restart and stays on the device | Emulator, command | Open  Superseded by 48 and 56 |
| 15 | S0 | App on a physical Android phone | A physical phone | Open, blocked on hardware  Superseded by 61 (the merged app on the partner's phone) |
| 26 | UX1 | Plan: fare breakdown arithmetic | Emulator, command | Open  Superseded by 48 (Details breakdown) |
| 28 | UX1 | Introduction on first launch, skip, and replay from Profile | Emulator | Open  Superseded by 50, then 52 |
| 29 | UX1 | Avatars: 12 presets, stored on the phone only | Emulator, command | Open  Superseded by 54 |
| 30 | UX1 | About screen | Emulator | Open  Superseded by 51 |
| 35 | UX1 | Launcher icon and splash screen are still the Expo defaults | Decision, native rebuild | Open, waits for Emjay  Superseded by 60 and 62 (R1a icon and splash) |
| 37 | Audit 2 | Read `docs/AUDIT_2.md` and check its claims you care about | Reading, commands | Open  Superseded: Audit 2 is history; Audit 3 accepted by Emjay on 2026-10-04 |
| 39 | Audit 2 | Decisions recorded as you gave them | Reading | Open  Superseded: the decision log in IMPLEMENTATION_PLAN_MASTER.md §9, accepted 2026-10-04 |
| 50 | UX2 | One-screen introduction: fare type, avatar, Start, Skip, Replay from Settings | Emulator | Open, **not yet seen on the emulator**  Superseded by 52 (four-step introduction) |
| 52 | F1 | Four-step introduction: Tunton, gender, commuter type, destinations (replaces 50) | Emulator | Confirmed by Emjay on 2026-10-04; listed for the final audit  Confirmed by Emjay on 2026-10-04 |
| 53 | F1 | Greeting card on Live, its placement, and the chips opening My Ride | Emulator, decision | Confirmed by Emjay on 2026-10-04: keep it above the sheet  Confirmed by Emjay on 2026-10-04 |
| 55 | F1 | Greeting lines: choose the final set from the 8 drafts | Decision | Decided 2026-10-04: keep all 8 for now  Decided by Emjay on 2026-10-04 |
| 58 | Merge | Read `docs/MERGE_RESULT.md` and the `integrate-partner` diff; approve moving `main` | Reading, command | Confirmed by Emjay on 2026-10-04 (emulator test); `main` fast-forwarded  Confirmed by Emjay on 2026-10-04 |
| 42 | UX2 | Swipe the Live sheet to peek, half and expanded by hand | Emulator (mouse) | Open  Confirmed by Emjay on 2026-10-04 (sheet dragging, emulator, old build) |
| 46 | UX2 | Light and Dark from Settings, including the map and route line | Emulator | Open  Confirmed by Emjay on 2026-10-04 (Light and Dark, emulator, old build) |
| 54 | F1 | The 12 new avatars, the two sets, Shuffle, kept after a restart | Emulator, decision | Drawings confirmed by Emjay on 2026-10-04; **picker now shows only the own set: not yet seen on the emulator**  Confirmed by Emjay on 2026-10-04 (own-set avatars plus Shuffle in Settings) |

## Items

### 3. Senior Citizen and PWD discounts

- **Why:** on the emulator the agent tapped only Regular and Student. The other two use the same multiplier and are covered by unit tests, but were not seen on screen.
- **How:** Plan tab: tap stop IMA, then tap the map near the east end of the line. Note the fare. Profile tab: choose Senior Citizen; return to Plan. Repeat with Person with Disability, then Regular.
- **Expected:** for an 8.9 km ride, Regular shows ₱25.00; Senior Citizen and PWD each show ₱20.00. Tap "Show how this was worked out": the discount line names the class ("Senior Citizen discount (20% off)") and the regular fare line reads ₱25.00. In general the discounted fare is 80% of regular, rounded to the nearest ₱0.25.

### 5. Outbound and Return switches, amber stop highlight

- **Status:** Emjay confirmed all four checkpoint checks on 2026-10-03. Kept here so the final audit covers it.
- **How:** Map tab: tap Outbound to hide it, then Return. Tap a stop in the list under the map.
- **Expected:** with Outbound off, a lighter band with white dashes and white arrows remains. With Return off, a solid cyan line with cyan arrows remains. The tapped stop's dot turns amber and larger; tapping it again clears it.

### 10. Classification stays on the device and survives a restart

- **How:** choose Student in Profile, force-stop the app, reopen it, open Profile. Then run `npx jest src/shared/__tests__/privacy.test.ts`.
- **Expected:** Student is still selected. The three privacy tests pass: no code under `src/services` or `supabase/` mentions the classification, and the store that holds it imports no network code.

### 15. App on a physical Android phone

- **Why:** PRD 0.2 verifies S0, S2 and S5 on a physical Android 8.0+ phone. Everything so far ran on the emulator.
- **How, when a phone is available:** enable USB debugging, `adb install -r android\app\build\outputs\apk\debug\app-debug.apk`, start the dev server, open the app.
- **Expected:** the same behaviour as on the emulator. Note launch time and any difference.

### 26. Plan: fare breakdown

- **How:** with a trip showing, scroll to the Fare card and tap "Show how this was worked out".
- **Expected:** rows for the base fare and its distance, the extra kilometres and their cost, the regular fare, the discount (only for a discounted class), the rounding, and the total. The "Estimate only" label and the amber placeholder note stay. Seen by the agent for a 5.4 km Student trip: ₱15.00 + ₱4.00 = ₱19.00, less ₱3.80, rounding + ₱0.05, total ₱15.25.
- **Tests:** `npx jest src/shared/__tests__/planGuidance.test.ts src/shared/__tests__/fare.test.ts`: 6.3 km regular is ₱21.00; Student is ₱16.80 before rounding and ₱16.75 after.

### 28. Introduction on first launch

- **How:** `adb shell pm clear com.tunton.app`, open the app. Go through the three screens; on a second try use Skip. Later, Profile, "Show the introduction again".
- **Expected:** three screens: welcome; fare classification and avatar; what stays on your phone. "Start using the app" or Skip opens the Map tab on a first launch and returns to Profile on a replay. Choices made on the second screen appear in Profile. No permission dialog appears at any point.

### 29. Avatars

- **How:** Profile tab: tap an avatar, force-stop and reopen. Then run `npx jest src/shared/__tests__/privacy.test.ts`.
- **Expected:** 12 presets (four shapes in three colours), no photo or upload option. The choice survives a restart. The avatar appears on Profile and in the introduction only, never on the map. The privacy tests confirm that no code under `src/services` or `supabase/` mentions the avatar or the classification.

### 30. About screen

- **How:** Profile, "About this app".
- **Expected:** app name and version; "© OpenStreetMap contributors" with a short explanation; an amber note that route and fare data are placeholders; a list of what is stored on the phone; a Back button.

### 35. Launcher icon and splash screen

- **Status:** not changed. The app icon on the home screen and the splash screen are compiled into the APK, so replacing them needs a native rebuild, which UX1 forbade. A placeholder logo drawn from vector shapes exists in the app (`src/components/Logo.tsx`) and is used on the loading screen, the introduction and the About screen.
- **Decide:** whether to rebuild for the icon and splash, and when.

### 37. Audit 2

- **What:** `docs/AUDIT_2.md` was written by the agent. Its statements are claims until you check them.
- **How:** read sections 1, 7, 8 and 12. To re-run its gates: `npx tsc --noEmit`, `npx expo lint`, `npm test`, `npx expo-doctor`, `npx expo install --check`, `npm audit --omit=dev`. To check the push record: `git reflog show refs/remotes/origin/main`. To check package changes: `git diff 6cdd86a HEAD -- package.json`.
- **Expected:** the same results as its section 10. Pushes only on 2026-10-02 at 19:55 and 21:28. Four package changes (`expo-asset`, `expo-file-system`, the `react-native-gesture-handler` pin, `patch-package`).

### 39. Decisions recorded as you gave them

- **How:** read "Decisions after Audit 2" at the top of `docs/IMPLEMENTATION_PLAN_GPS.md`, and its new questions N1 and N2 in section 11.
- **Expected:** fifteen rows matching your message of 2026-10-03.
- **Two assumptions to confirm:**
  1. The Team account card is kept in the Settings sheet below your five rows (N1).
  2. The G1 check-in allowlist reuses `telemetry_writers` unless you want a separate list (N2).

### 50. One-screen introduction

- **How:** `adb shell pm clear com.tunton.app` (this also erases the saved fare type, avatar, theme and tile file), open the app; or Settings, "Replay intro".
- **Expected:** one screen with the logo, "Welcome to Tunton", the fare-type chips, the 12 avatars, "Saved on your phone only", a Start button and Skip. Start or Skip opens the Live tab on first launch and returns to Settings on a replay. No permission prompt.

### 52. Four-step introduction (F1)

- **How:** `adb shell pm clear com.tunton.app`, open the app (or Settings, "Replay intro"). Follow `F1-M1` in `docs/device-tests.md`.
- **Expected:** "Step 1 of 4" to "Step 4 of 4": "Hi, I'm Tunton!"; About you (Male, Female, Prefer not to say, optional) with the avatar it picks; How do you ride? (the four fare types); Where do you often go? (the six placeholder landmarks, up to 3). Skip on steps 1 to 3 ends the intro at once; Start on step 4. No permission prompt.
- **Note:** the map-tap picker for destinations, and the suggested route with its fare at the end, come in F3.

### 53. Greeting card on Live (F1)

- **How:** open the app on Live. Tap a destination chip, then pick a From on My Ride. Back on Live, tap the X. Force-stop and reopen.
- **Expected:** a small card above the sheet with one Tunton line and your chips ("Plan a ride" if you chose none). A chip opens My Ride with To set; From is highlighted. The X hides the card; it is back on the next app start. It fades as the sheet opens.
- **Decide:** is this the right place (my proposal), or would you prefer it inside the sheet?

### 55. Greeting lines

- **How:** read `persona.greetings` in `src/strings/en.ts`: two lines each for morning (from 05:00), afternoon (11:00), evening (17:00) and night (21:00), Manila time. One line per period is shown per day.
- **Decide:** keep, edit or replace them. The hours are config constants (`GREETING_*_START_H`).

### 58. (from "58 to 63. Partner merge")

- **58:** `git diff main integrate-partner --stat`, then `docs/MERGE_RESULT.md`. On approval: `git switch main` and `git merge --ff-only integrate-partner`.

### 42. Swipe the Live sheet by hand

- **How:** on the Live tab, drag the grey handle (or the "R4 IMA → DEO" row) up slowly and let go about a third of the way up the screen; then drag it to near the top; then drag it back down. Do it with the mouse in the emulator window.
- **Expected:** it settles at the nearest of three heights: a 72 dp strip (peek), about 40% of the screen (half), about 90% (expanded). It springs into place, never stops in between. At expanded the stop list scrolls; at half and peek it does not. Coming down from expanded, the content is back at its top.
- **Note:** at expanded, dragging the content down does not collapse the sheet: drag the handle or the header row instead. This is the fallback you allowed for the nested gesture.

### 46. Light and Dark

- **How:** tap the avatar at the top right, choose Dark, close the sheet; then choose Light.
- **Expected:** every screen, the sheet, the chips, the map and the route line follow. The choice survives a force-stop. The status bar icons follow; the navigation bar may not until R1 adds `expo-system-ui`.

### 54. The 12 avatars (F1)

- **How:** Settings shows all 12 in the grid. TalkBack reads them as Avatar 1 to 12: 1 to 6 are the Male set, 7 to 12 the Female set. Tap Shuffle several times, then force-stop and reopen.
- **Expected:** simple drawn faces with different hair, glasses, a cap or headphones, four skin tones and seven colours; both sets include long and short hair and glasses. Shuffle stays within the set for your gender answer (all 12 if none). The avatar never changes on its own.
- **Decided (2026-10-04):** keep all 12 drawings. The picker in Settings (Profile in F2) shows only the user's own set: the 6 for Male or Female, all 12 for "Prefer not to say" or no answer, plus Shuffle.
- **Check (new):** with Female answered, Settings shows Avatars 7 to 12 only; with Male, 1 to 6; after Replay intro with "Prefer not to say", all 12. An avatar picked earlier from another set stays on the avatar button but is not in the grid until Shuffle or a pick. The agent could not check this on the emulator (Metro was stopped for the merge).
