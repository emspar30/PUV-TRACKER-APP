# Tunton Driver: UI brief for Google Stitch

> **What this is.** A product brief for the screens of the **Tunton Driver** Android app, written to be pasted into Google Stitch. Part 1 explains how to use it. Part 2 is the overall brief (paste it first). Part 3 has one prompt per screen. Part 4 is the reference the designs must respect when they are built in the app.
>
> Source of truth: `docs/PRD.md` (sections 9.2 to 9.5, 15.3) and `docs/IMPLEMENTATION_PLAN_DRIVER.md` (DR4, DR5). Built screens today: `src/driver/app/`. Written 2026-10-12.

---

## Part 1. How to use this with Stitch

1. New Stitch project, **Mobile** (Android phone, portrait).
2. Paste **Part 2** as the first prompt. It sets the product, the context and the visual system.
3. Then paste the screen prompts in **Part 3** one at a time, in order. Each is self-contained.
4. For each screen, also ask: *"Make a dark-theme version of this screen."* (The driver app follows the phone's theme; night driving uses dark.)
5. If Stitch drifts (adds features, buttons or data that are not in the prompt), reply: *"Remove anything not in the brief. This screen must need no taps."*
6. Export the screens (images plus HTML, and Stitch's `DESIGN.md` if it offers one) and share them. They are rebuilt in React Native in the app; the app's logic stays as it is.

---

## Part 2. Overall brief (paste first)

```
Design the Android app "Tunton Driver", a dashboard display for multicab (jeepney-style) drivers in Butuan City, Philippines.

WHAT IT DOES
The phone is mounted on the dashboard, plugged into the vehicle charger, screen always on. It shows the driver where passengers are waiting along their route: a count per stop. Commuters check in at a stop in a separate commuter app; the counts reach this phone by SMS every few minutes (the phone has no internet). The phone also sends a Bluetooth beacon so commuters' phones can tell which multicab they are riding.

WHO USES IT
- The driver: reads it at a glance, at arm's length, often in bright sunlight or at night, while driving. Never types. Many drivers are not used to apps.
- An admin (fleet operator): sets the phone up once with a QR code, and opens a hidden admin screen with a PIN.

DESIGN PRINCIPLES
1. Glanceable in under 2 seconds. Huge numbers, few words, strong colour coding.
2. The home screen needs NO taps at all. Nothing on it asks the driver to do anything while driving. No buttons, no pop-ups, no "OK" to press.
3. Honest about freshness. If no update has arrived for a while, the whole heatmap turns grey and says how old it is. Never show "no passengers" when the truth is "no update".
4. A stop that has never had a count shows a dash, never 0.
5. Readable in sunlight: high contrast, no thin fonts, no low-contrast greys for important text. Counts at least 20 sp, the main numbers much bigger.
6. Calm, civic, utilitarian. Like Google Maps transit, not a game. No ads, no gamification, no avatars.

VISUAL SYSTEM (reuse the "Urban Transit System" design system)
- Material 3, Google Maps civic transit look. Font: Roboto Flex. Tabular numbers for counts and times.
- Light: canvas #f8f9fa, cards #ffffff, text #1f1f1f / #444746, primary blue #0b57d0.
- Dark: canvas #0e1116, cards #171c25, text #f1f3f5 / #c4cad4, primary blue #8ab4f8.
- Status colours: OK green #137333 (dark #6dd58c), warning amber #9a5700 on #fef7e0, problem red #b3261e on #fce8e6.
- Demand bands (waiting passengers per stop), used on the map and in the list:
  - 0 waiting: neutral grey chip
  - 1–4: green #137333 (dark #34D399)
  - 5–9: amber #c26401 (dark #FFB703)
  - 10+: red #b3261e (dark #FF6B7A)
  - stale or unknown: grey #5f6368 (dark #94A3B8)
- Shapes: pill chips and buttons, rounded cards (16–24 px), no heavy borders, soft tonal surfaces.
- Touch targets at least 48 dp. Screen width 360–412 dp, portrait.

LANGUAGE
English, very short phrases ("Updated 2 min ago", "Beacon on"). No jargon on the driver's screens.

DO NOT ADD
Login, accounts, chat, passenger names or photos, navigation directions, earnings, fares, ratings, ads, a bottom tab bar, or any button on the home screen.
```

---

## Part 3. Screen prompts (paste one at a time)

### 3.1 Home: live heatmap (daytime, fresh)

```
Screen: Tunton Driver home, daytime, light theme. No taps needed anywhere.

Top: a status strip (one rounded bar, 4 compact items with icons, wraps to two lines if needed):
- Bluetooth icon + "Beacon on" (green)
- Message icon + "Updated 2 min ago" (green)
- Clock icon + "Clock OK" (green)
- Battery icon + "82% · Charging" (green)
The strip has no visible button or hint (holding it opens a hidden admin screen).

Vehicle line: plate "KDX 4821" very large and bold on the left, "Route 4" on the right.

Top half: a static map card (rounded) of Route 4 in Butuan City: a plain grey base map, the route as a teal line, and 18 stop dots along it. Each stop with waiting passengers glows (a soft blurred halo) in its band colour and is bigger the more people wait: green small glow, amber medium, red large. Stops with 0 are small grey dots. No map controls, no zoom buttons. Tiny "© OpenStreetMap contributors" in a corner.

Bottom half: heading "Waiting passengers" with "Updated 2 min ago" on the right. Then a scrolling list of the stops in riding order, one row each: the stop name (large, up to 2 lines), the exact number (large, bold), and a pill chip with the band (bold): 
Taligaman 0 [0] · Antongalon 3 [1–4] · Solar Gas Station 0 [0] · LTFRB 1 [1–4] · Ampayon 7 [5–9] · Caraga State University (Main Campus) 12 [10+] · Tiniwisan Crossing 2 [1–4] · Nissan 0 [0] · Baan Viaduct 5 [5–9] · FSUU (Urios) 4 [1–4] · SJIT 0 [0] · Obrero ES 1 [1–4] · Langihan Public Market 9 [5–9] · BCSAT / Water District / BIR 0 [0] · SM City Butuan 11 [10+] · Zamora Cemetery 0 [0] · Agusan National HS 6 [5–9] · Palawan Pawnshop 2 [1–4].
Chip colours: 0 grey, 1–4 green, 5–9 amber, 10+ red, with white bold text on coloured chips.
The map and the list share the screen about 50/50. No buttons anywhere.
```

### 3.2 Home: stale (no update for 17 minutes)

```
Same Tunton Driver home screen as before (plate "KDX 4821", Route 4, same stops and numbers), but no SMS update has arrived for 17 minutes.
- Status strip: "Beacon on" (green), "No update for 17 min" (red), "Clock OK" (green), "82% · Charging".
- The whole map turns grey: every stop dot grey, no glow, route line faded.
- The list keeps the last numbers but is visibly greyed out (about 50% opacity, all chips grey).
- Above the list, in red: "No update for 17 min" and a short line "These counts are old. They may have changed."
- Never say "no passengers". No buttons.
```

### 3.3 Home: just set up, nothing received yet

```
Tunton Driver home, right after setup, before the first SMS update.
- Status strip: "Beacon on" (green), "No update yet" (amber), "Clock not checked" (amber), "64% · Charging".
- Plate "KDX 4821", "Route 4".
- Map: Route 4 line with all 18 stops as small grey dots, no glow.
- List heading "Waiting passengers" with "No update yet". Every stop listed in riding order with a grey "—" chip and no number (a stop without a count shows a dash, never 0).
- No buttons, no instructions to the driver.
```

### 3.4 Home: night (after 21:00), bands only

```
Tunton Driver home, at night, DARK theme (canvas #0e1116, cards #171c25). Fresh update ("Updated 1 min ago").
At night the app shows only ranges, not exact numbers:
- List rows show the stop name and the band chip only (0, 1–4, 5–9, 10+), no exact number. A small note under the heading: "Ranges only at night".
- Map nodes glow in the dark-theme band colours (green #34D399, amber #FFB703, red #FF6B7A) on a dark grey base map.
- Status strip in dark style: "Beacon on", "Updated 1 min ago", "Clock OK", "71% · Charging".
Keep contrast high for night driving, no bright white areas. No buttons.
```

### 3.5 Home: problems the driver should see

```
Tunton Driver home with problems shown, light theme. Show the three warning cards stacked under the vehicle line (in the app only the ones that apply appear):
1. Amber card: "Text messages are off. Waiting counts cannot arrive. Ask an admin."
2. Amber card: "This phone must be set up again. Ask an admin."
3. Status strip item in red: Bluetooth-off icon + "Bluetooth is off".
Other strip items: "Updated 4 min ago" (green), "Clock off by 3 min" (red), battery "18% · Not charging" (amber).
The map and the list below as in the normal home (fresh counts). Warnings are informational only: no buttons, no dismiss.
```

### 3.6 Setup 1: scan the setup code

```
Tunton Driver setup, step 1 of 5, done by an admin (not while driving). Light theme. Top bar with back arrow and title "Set up this phone". A slim step indicator (1 of 5).
- Heading: "Scan the setup code".
- A large rounded camera viewfinder (about 320 dp tall) with a square QR frame in the middle.
- Body: "Point the camera at the code on the admin computer."
- Error variant below the camera, in red: "That code has expired. Ask for a new one."
- If camera permission is missing, instead of the viewfinder: "The camera is needed to read the setup code." and a pill button "Allow camera".
```

### 3.7 Setup 2: is this the multicab?

```
Tunton Driver setup, step 2 of 5. Title "Set up this phone".
- Heading: "Is this the multicab?"
- A card: plate "KDX 4821" very large, "Route 4" below, small "Vehicle R4-001".
- Body: "This phone stays in this multicab."
- Primary pill button (full width): "Yes, set up". Secondary pill button: "Scan again".
```

### 3.8 Setup 3: two permissions

```
Tunton Driver setup, step 3 of 5. Title "Set up this phone".
- Heading: "Two permissions".
- Two short rows with icons: Bluetooth icon, "Nearby devices: lets riders' phones find this multicab." Bell icon, "Notifications: shows that the beacon is on."
- Primary pill button: "Continue" (Android then asks for each).
- Denied variant: red text "Nearby devices was not allowed. The beacon cannot start without it." with buttons "Try again" and "Open settings".
```

### 3.9 Setup 4: text messages

```
Tunton Driver setup, step 4 of 5. Title "Set up this phone".
- Heading: "Text messages".
- Message icon. Body: "To receive waiting counts by text. Tunton reads only its own messages, never personal texts."
- Primary pill button: "Allow text messages".
- Blocked variant (Android "restricted setting"): body in a calm amber card: "Text messages were not allowed. If Android says this is a restricted setting: open Settings, tap ⋮ (top right), Allow restricted settings, then come back and try again." Show these steps as a numbered list of 3 short steps with small icons. Buttons: "Try again" (primary), "Open settings" (secondary), "Skip for now" (text button).
```

### 3.10 Setup 5: checking, failed, done

```
Three states of the last setup step, Tunton Driver, step 5 of 5:
A) Checking: a progress indicator and "Checking this phone…".
B) Failed: red heading "This phone cannot act as a beacon. Use another phone model." with buttons "Try again" and "Scan again". (Other messages in the same place: "Turn on Bluetooth, then try again.", "Setup failed. Try again.")
C) Done: big green check, heading "Beacon on", body "Check with a second phone that the beacon is seen, then tap Done.", primary pill button "Done".
```

### 3.11 Admin: PIN

```
Tunton Driver admin entry, reached by holding the home status strip for 3 seconds. Light theme. Top bar with back arrow and title "Admin".
- Heading "Admin PIN".
- A 6-digit PIN field shown as 6 large dots/boxes, numeric keypad.
- Error line in red: "Wrong PIN."
- Primary pill button "Unlock" (disabled until 6 digits).
```

### 3.12 Admin: phone status

```
Tunton Driver admin screen after the PIN. Light theme, top bar "Admin". For the fleet admin, not the driver; denser is fine but keep it clean. Cards:
1. Device card: "DRV-0001 · beacon 1"; "Code 01000109f42c8e1a5b · slot 29863215" (monospace, selectable); beacon status line.
2. "Heatmap messages" card: "24 accepted · 0 waiting in the inbox"; "Clock ahead by 1 s"; section "Dropped, by reason": small pills "wrong_sender 2", "old_sequence 1", "bad_signature 1", "stale_time 1"; section "Recent": a compact log, newest first, e.g. "16:07:27 · data · accepted · #12" (normal text) and "16:05:02 · text · wrong_sender" (red).
3. If text messages are off: red line "Text messages permission is off" and button "Allow text messages".
Buttons at the bottom: secondary pill "Turn beacon off" (or primary "Turn beacon on"), and a text button "Set up again". After tapping it, a red confirm area: "This removes this phone's setup. You need a new setup code." with a red pill button "Set up again".
```

---

## Part 4. Reference for building the designs in the app

### 4.1 Rules the designs must keep (from the PRD)

| Rule | Value | Source |
| --- | --- | --- |
| Home needs no interaction while driving | No buttons, dialogs or required taps on Home | PRD 15.3, 9.4 |
| Admin entry | Hold the status strip 3 s, then a 6-digit PIN | Q12, `ADMIN_PIN_DIGITS` |
| Bands | 0, 1–4, 5–9, 10+ (`HEATMAP_BAND_EDGES` 1, 5, 10) | PRD 9.4 |
| Exact numbers | In the list by day; bands only from 21:00 to 04:59 Manila | Q5, Q11 |
| Stale | Grey with its age after 15 min without a valid message (`SMS_STALE_HEATMAP_MIN`) | PRD 0.2 S9 |
| Unknown stop | A dash, never 0 | heatmap rules |
| Clock warning | Off by more than 90 s (`CLOCK_DRIFT_WARN_S`) | PRD 8.2, 14 |
| Text size | Counts at least 20 sp; 48 dp targets | DR5 task 4 |
| Contrast | WCAG AA; a band chip label is bold at 22 sp (large text) | `DESIGN.md`, contrast tests |
| Screen | Kept on while the app is open; portrait (`app.json`) | DR4 |
| One-way | The driver app has no internet, no location, no sign-in | PRD 6.2 |
| Map | Offline tiles, framed once on the route, no gestures | PRD 9.4, risk R8 |

### 4.2 Status strip: every state

| Item | States (label, tone) |
| --- | --- |
| Beacon | "Beacon on" ok · "Beacon starting" warn · "Beacon restarting" warn · "Beacon off" warn · "Bluetooth is off" bad · "Nearby devices permission is off" bad · "This phone cannot act as a beacon" bad · "Not set up" bad · "Beacon stopped" bad |
| Update | "Updated just now" / "Updated N min ago" ok · "No update yet" warn · "No update for N min" bad |
| Clock | "Clock OK" ok · "Clock not checked" warn · "Clock off by N s" / "Clock off by N min" bad |
| Battery | "N% · Charging" · "N% · Not charging" |

### 4.3 What the designs may not change

The checks, the data and the words' meaning stay as built (`src/shared/driver/`, `src/strings/en.ts`). A design may change layout, sizes, colours within the tokens above, icons and wording style, but not: what is shown when (the states above), the bands and thresholds, or the rule that Home has nothing to tap.

### 4.4 Open questions for Emjay

1. **Portrait or landscape?** Many dashboard mounts hold the phone sideways. The app is portrait-only today (`app.json`, shared with the commuter app). If landscape is wanted, ask Stitch for a landscape Home (map left, list right); the driver app would then need its own orientation setting.
2. **Language.** English only today. Cebuano or Tagalog labels for drivers would need translated strings.
3. **Out of scope here:** the Tunton Gateway app (the SMS sender phone, DR7) and the commuter app.
