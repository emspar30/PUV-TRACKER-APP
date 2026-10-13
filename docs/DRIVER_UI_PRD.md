# Tunton Driver: UI brief for Google Stitch

> **What this is.** A product brief for the screens of the **Tunton Driver** Android app, written to be pasted into Google Stitch. Part 1 explains how to use it. Part 2 is the overall brief (paste it first). Part 3 has one prompt per screen. Part 4 is the reference the designs must respect when they are built in the app.
>
> Source of truth: `docs/PRD.md` (sections 9.2 to 9.5, 15.3) and `docs/IMPLEMENTATION_PLAN_DRIVER.md` (DR4, DR5). Built screens today: `src/driver/app/`. Written 2026-10-12.

---

## Part 1. How to use this with Stitch

1. New Stitch project, **Mobile** (Android phone, portrait).
2. Paste **Part 2** as the first prompt. It sets the product, the context and the visual system.
3. Then paste the screen prompts in **Part 3** one at a time, in order. Each is self-contained.
4. **Light theme only**, like the commuter app (light by default; the driver app has no theme setting). Do not ask Stitch for dark versions.
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

VISUAL SYSTEM: match the existing Tunton commuter app exactly (same family of apps)
- Material 3, Google Maps civic transit look. LIGHT THEME ONLY.
- Font: Roboto (the Android system font), never a display or rounded font. Tabular numbers for counts and times.
- Type scale (dp): display 40/48 semibold (big numbers); headline-lg 26/32 semibold; headline-md 22/28 medium; headline-sm 18/24 medium; body-lg 16/24; body-md 14/20; label-lg 14/20 medium (buttons, chip text); label-md 12/16 medium (status pills); overline 11/16 bold uppercase, letter-spaced, blue (e.g. "STEP 2 OF 5").
- Colours: canvas #f5f6f8 (light grey page); cards #ffffff with a 1 px outline #e3e6ea; tonal surfaces #f8f9fa / #f1f3f4 / #e8eaed; text #1f1f1f, secondary #444746, tertiary #5f6368; primary blue #0b57d0 (on it white); selected/tonal blue #e8f0fe with blue text.
- Status colours (text on tinted fill): success #137333 on #e6f4ea; warning #9a5700 on #fef7e0; danger #b3261e on #fce8e6.
- Shapes: cards 16 dp corners with the 1 px outline and no shadow; floating bars 16 dp corners, white, a soft shadow; buttons and chips fully pill-shaped; small square badges 4 dp; icon tiles 12 dp.
- Buttons: 52 dp tall pills, label-lg text. Primary: solid #0b57d0, white text. Secondary: white with a 1 px #e3e6ea outline, dark text. Danger: solid #b3261e. Text button: blue text, no fill.
- Status pill (reuse it for every status): a small pill, tinted fill, an 8 dp dot in the text colour, label-md text, e.g. green "● Live", amber "● Stale · 3 min", grey "● No data".
- Route badge: "R4" in bold white label-lg on the route colour #00796b, 4 dp corners (never a pill).
- Step header for multi-step flows: back arrow, title, then a blue overline "STEP 2 OF 5" over a segmented progress bar (4 dp tall segments, done = #0b57d0, to do = #e8eaed).
- Icon tiles: a 40 dp tinted square (12 dp corners) holding a line icon, at the start of a feature row.
- Icons: thin line icons (Lucide style), 20–24 dp, never filled emoji-like icons.
- Map: the commuter app's plain light-grey base map (land #f4f4f4, roads white, water #dedede), no labels, no blue water.
- Demand bands (waiting passengers per stop), on the map and in the list:
  - 0 waiting: neutral #e8eaed chip, dark text
  - 1–4: green #137333, white text
  - 5–9: amber #c26401, white text
  - 10+: red #b3261e, white text
  - stale or unknown: grey #5f6368
- Spacing on an 8 dp grid (4, 8, 16, 24, 32). Touch targets at least 48 dp. Screen width 360–412 dp, portrait.
- Driver-only exception: on the driver's home, numbers and band chips are much larger than in the commuter app (counts at least 22 dp bold), because they are read from arm's length while driving.

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

Top: a status strip: one white floating bar (16 dp corners, soft shadow) holding 4 status pills (tinted pill, coloured dot, short label, with a small line icon), wrapping to two lines if needed:
- Bluetooth icon + "Beacon on" (green)
- Message icon + "Updated 2 min ago" (green)
- Clock icon + "Clock OK" (green)
- Battery icon + "82% · Charging" (green)
The strip has no visible button or hint (holding it opens a hidden admin screen).

Vehicle line: plate "KDX 4821" very large and bold on the left; on the right a route badge "R4" (white bold text on #00796b, 4 dp corners) and "Route 4".

Top half: a static map card (rounded) of Route 4 in Butuan City: a plain grey base map, the route as a teal line, and 18 stop dots along it. Each stop with waiting passengers glows (a soft blurred halo) in its band colour and is bigger the more people wait: green small glow, amber medium, red large. Stops with 0 are small grey dots. No map controls, no zoom buttons. Tiny "© OpenStreetMap contributors" in a corner.

Bottom half: heading "Waiting passengers" with "Updated 2 min ago" on the right. Then a scrolling list of the stops in riding order, one white card row each (16 dp corners, 1 px #e3e6ea outline): the stop name (large, up to 2 lines), the exact number (large, bold), and a pill chip with the band (bold): 
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
- Status strip: "Beacon on" (green), "No update yet" (amber), "Clock: no text yet" (amber), "64% · Charging".
- Plate "KDX 4821", "Route 4".
- Map: Route 4 line with all 18 stops as small grey dots, no glow.
- List heading "Waiting passengers" with "No update yet". Every stop listed in riding order with a grey "—" chip and no number (a stop without a count shows a dash, never 0).
- No buttons, no instructions to the driver.
```

### 3.4 Home: night (after 21:00), bands only

```
Tunton Driver home at night (after 21:00), same light theme as the other screens. Fresh update ("Updated 1 min ago").
At night the app shows only ranges, not exact numbers:
- List rows show the stop name and the band chip only (0, 1–4, 5–9, 10+), no exact number. A small grey note under the heading: "Ranges only at night".
- Map nodes glow in the band colours as by day.
- Status strip: "Beacon on", "Updated 1 min ago", "Clock OK", "71% · Charging".
No buttons.
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
Tunton Driver setup, step 1 of 5, done by an admin (not while driving). Step header: back arrow, title "Set up this phone", then a blue overline "STEP 1 OF 5" over a segmented progress bar (1 of 5 segments blue).
- Heading: "Scan the setup code".
- A large rounded camera viewfinder (about 320 dp tall) with a square QR frame in the middle.
- Body: "Point the camera at the code on the admin computer."
- Error variant below the camera, in red: "That code has expired. Ask for a new one."
- If camera permission is missing, instead of the viewfinder: "The camera is needed to read the setup code." and a pill button "Allow camera".
```

### 3.7 Setup 2: is this the multicab?

```
Tunton Driver setup, step 2 of 5. Same step header as step 1 ("STEP 2 OF 5", 2 segments blue).
- Heading: "Is this the multicab?"
- A card: plate "KDX 4821" very large, "Route 4" below, small "Vehicle R4-001".
- Body: "This phone stays in this multicab."
- Primary pill button (full width): "Yes, set up". Secondary pill button: "Scan again".
```

### 3.8 Setup 3: two permissions

```
Tunton Driver setup, step 3 of 5. Same step header ("STEP 3 OF 5").
- Heading: "Two permissions".
- Two white card rows, each starting with a tinted icon tile: Bluetooth icon, "Nearby devices: lets riders' phones find this multicab." Bell icon, "Notifications: shows that the beacon is on."
- Primary pill button: "Continue" (Android then asks for each).
- Denied variant: red text "Nearby devices was not allowed. The beacon cannot start without it." with buttons "Try again" and "Open settings".
```

### 3.9 Setup 4: text messages

```
Tunton Driver setup, step 4 of 5. Same step header ("STEP 4 OF 5").
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
| Map | Offline tiles. **Changed by the owner 2026-10-14** (was "framed once, no gestures"): it rests on the route framed, may be dragged and zoomed with its centre kept over the Butuan tiles, and one tap on a round button brings the route back (Part 6) | PRD 9.4, risk R8 |

### 4.2 Status strip: every state

| Item | States (label, tone) |
| --- | --- |
| Beacon | "Beacon on" ok · "Beacon starting" warn · "Beacon restarting" warn · "Beacon off" warn · "Bluetooth is off" bad · "Nearby devices permission is off" bad · "This phone cannot act as a beacon" bad · "Not set up" bad · "Beacon stopped" bad |
| Update | "Updated just now" / "Updated N min ago" ok · "No update yet" warn · "No update for N min" bad |
| Clock | "Clock OK" ok · "Clock: no text yet" warn · "Clock off by N s" / "Clock off by N min" bad |
| Battery | "N% · Charging" · "N% · Not charging" |

### 4.3 What the designs may not change

The checks, the data and the words' meaning stay as built (`src/shared/driver/`, `src/strings/en.ts`). A design may change layout, sizes, colours within the tokens above, icons and wording style, but not: what is shown when (the states above), the bands and thresholds, or the rule that Home has nothing to tap.

### 4.4 Consistency with the commuter app (review, 2026-10-12)

The values in Part 2 come from the **built commuter app** (`src/theme/tokens.ts`, `src/theme/theme.ts`, `src/components/`), not from `docs/DESIGN.md`. Where the two differ, the code wins, because the code is what commuters see:

| Item | `docs/DESIGN.md` says | The commuter app uses |
| --- | --- | --- |
| Font | Roboto Flex | The Android system font (Roboto); no font is loaded |
| Canvas | `#fcf9f8` / `#ffffff` | `#f5f6f8`, with white cards on it |
| Primary blue | `#0041a2` (frontmatter), `#0b57d0` (text) | `#0b57d0` |
| Corners | sm 8, default 16, md 24, lg 32 px | badge 4, sm 8, md 12, card 16, lg 24, sheet 28, pill |
| Cards | tonal, no border | white, 1 px `#e3e6ea` outline, 16 dp corners |
| Theme | (light) | Light by default; dark only if chosen in Settings |

**Where today's driver screens differ** (fix when the Stitch designs are built):

| Driver screen today | Commuter app pattern to use |
| --- | --- |
| Cards (home, warnings, admin, setup confirm, list rows): 12 dp corners, no outline | `Card`: 16 dp corners, 1 px outline |
| Status strip: a grey bar of icon + text items | A white floating bar (16 dp, level-2 shadow, like `TopBar`) holding `StatusPill`-style pills with a dot |
| Route shown as the words "Route 4" | `RouteBadge` "R4" on the route colour, plus "Route 4" |
| Setup: no progress shown | `StepHeader` with "STEP n OF 5" and the segmented bar |
| Permission and SMS steps: plain text | `OptionRow` / `IconTile` rows (icon tile, title, one line) |
| Warning cards: amber fill, text only | Same tone, plus a leading icon (as `Hint`, which uses an icon and tonal fill) |
| Gateway carrier test: its own inputs and chips | The commuter `Chip` (outlined, tonal blue with a check when on); development-only screen, low priority |

The driver app already shares the theme module (`@/theme`), so colours, spacing and type sizes match. The deviations above are only in shapes and component patterns. The driver home's larger numbers and band chips are an intended exception (Part 2).

### 4.5 Open questions for Emjay

1. **Portrait or landscape?** Many dashboard mounts hold the phone sideways. The app is portrait-only today (`app.json`, shared with the commuter app). If landscape is wanted, ask Stitch for a landscape Home (map left, list right); the driver app would then need its own orientation setting.
2. **Night glare.** The driver app is light only, matching the commuter app. A bright white screen on the dashboard at night can dazzle the driver. The commuter app already has a dark theme in the same design language, so a dark driver home after 21:00 would stay consistent; decide after a night test with the light design.
3. **Language.** English only today. Cebuano or Tagalog labels for drivers would need translated strings.
4. **Out of scope here:** the Tunton Gateway app (the SMS sender phone, DR7) and the commuter app.

---

## Part 5. As built (2026-10-13)

All twelve screens are built in `src/driver/` from Stitch's export (`stitch_tunton_driver_app_ui/`, shared 2026-10-13), in the commuter app's style (Part 4.4). Stitch's own `DESIGN.md` (Roboto Flex, `#0041a2`, `#fcf9f8`) was not used. Every row of the Part 4.4 table is fixed except the gateway carrier test (low priority, out of scope).

| Screen | Built as |
| --- | --- |
| 3.1 Home | On 2026-10-12: the floating status strip (a fixed 2 × 2 grid), the plate, `LineBadge` and route name, the map card, one outlined card per stop with its number in riding order, the count and the band chip |
| 3.2 Stale | A red notice over the list: warning icon, "No update for N min", "These counts are old. They may have changed." The age beside the heading is hidden then (the notice says it). The map's nodes and route line turn grey, the line faint; the list stays at 50 % with grey chips and keeps its numbers |
| 3.3 Nothing yet | As 3.1's build: "No update yet" in amber beside the heading, a "—" chip on every stop, grey dots on the map |
| 3.4 Night | "Ranges only at night" in grey under the heading (it used to be the first line of the list, so it scrolled away) |
| 3.5 Problems | An amber notice per problem, each with its own icon (message-off for text messages, a phone for "set up again"): the problem in amber, then "Ask an admin." in bold. No buttons |
| 3.6 Scan | Step header "STEP 1 OF 5". The camera (320 dp) with four white corner marks around a 200 dp square; a bad code in a red notice under it. Without the camera permission: a grey placeholder with a camera icon and the reason, and "Allow camera" at the bottom |
| 3.7 Confirm | The plate large on a grey inset, then the route badge, "Route 4", the route's name and "Vehicle …". "Yes, set up" and "Scan again" at the bottom |
| 3.8 Permissions | Two option rows with icon tiles (Bluetooth, bell), "Continue". Denied: a red notice, "Try again", "Open settings" |
| 3.9 Text messages | An option row with a message icon. Blocked: an amber notice, "If Android says this is a restricted setting:", and three numbered steps with icons (Open settings; ⋮, Allow restricted settings; come back and Try again). Then "Try again", "Open settings", "Skip for now" |
| 3.10 Step 5 | Checking: a card with a spinner. Failed: a red notice with the reason, "Try again" (it shows Checking again) and "Scan again". Done: a green check in a circle, "Beacon on", the line about the second phone, "Done" |
| 3.11 PIN | A shield, "Admin PIN", six boxes (a dot per digit, a blue outline on the next one), an on-screen keypad (1–9, Clear, 0, delete), "Wrong PIN." in red, "Unlock" (off until six digits). The system keyboard is no longer used |
| 3.12 Admin | Text messages off: a red notice with "Allow text messages" at the top. A beacon card (icon tile, "DRV-0001 · beacon 1", a status pill with the strip's beacon words, the code in a fixed-width font, selectable). A messages card ("24 accepted" large, the inbox, the clock; dropped reasons as pills with red counts; the log in a fixed-width font, dropped lines in red). "Turn beacon off/on"; "Set up again", then a red notice with the red "Set up again" |

**Back arrow** in the setup: steps 2 to 4 go back one step. Step 1 has none (nothing to go back to), nor has step 5 (the setup is under way or done).

**Left out (Stitch added them; not in the brief):** "Telemetry Offline", "Reconnecting to City Dispatch Terminal…", "Butuan City Multicab Operator", "Multicab unit · Butuan City", the dark satellite map with "LIVE GPS CORRIDORS", "Active Corridor Overview" and its legend, "Night Schedule Active", "Real-time terminal and bay loads", sub-names under stops, a highlighted row for busy stops, the "Route Selection" title and avatar button on every screen, "Admin Provisioning" and similar step names, "Awaiting QR payload", "Fleet Portal", "Enter alphanumeric key instead", "LTO registration plate", "City Franchise Verified", "Dedicated Cockpit Device", vehicle photos, "Simulate denial response", "End-to-end municipal encryption", "SMS Gateway Online", TX power and battery voltage tiles, "Nordic nRF52", "v4.18-rel", "Factory Provisioning Reset", letters under the keypad digits, and "Clock not checked" (the brief now says "Clock: no text yet").

**Code:** `src/driver/components/Notice.tsx` (a tinted card: leading icon, the problem in the tone's colour, an optional line and buttons) and `PinPad.tsx`. The commuter `StatusPill` has a `danger` tone. Strings were split so "Ask an admin." can be bold and the setup rows have titles; what they say is unchanged. No rule, threshold or check changed (Part 4.3).

---

## Part 6. Home redesign: the map behind floating panels (owner, 2026-10-14)

The owner asked for this after using 3.1 on the phone. It replaces 3.1's half-map, half-list layout and the "framed once, no gestures" rule (Part 4.1).

| Part | Built as |
| --- | --- |
| Layout | The map fills the screen. Floating over its top: the status strip, the multicab card and any warning. Floating over its bottom: the colour key, then the "Waiting passengers" panel (38 % of the screen's height, light grey, the stops as white cards, scrolling). The route is framed in the space between them, framed again when a warning appears or goes, unless the driver moved the map |
| Stop names | Every stop is named beside its dot (Noto Sans Medium 14, from the bundled glyphs). Where names collide, the busier stop keeps its name; zooming in shows the rest |
| Zoomed in | From `DRIVER_MAP_DETAIL_ZOOM` (0.75 level) above the default view, each dot becomes a disc with its count, the band at night (Q11), "—" before the first count. By default the dots show only colour and name |
| Round buttons | Bottom right, over the map, stacked: zoom in, zoom out (`DRIVER_MAP_ZOOM_STEP`, 1 level), and "Show the whole route" (one tap: the default view again, centred) |
| Dragging | One-finger drag and two-finger pinch. No rotation, tilt or double-tap zoom. The centre stays over the offline tiles (`TILESET.bounds`, Butuan). **Second pass (owner, same day):** it never zooms out past the default view (button or pinch), and the top of the screen never passes the tiles' north edge (`northCenterCap`; the other edges stay under the panels). Reset lets go of both limits while it frames the route. `DRIVER_MAP_MIN_ZOOM` (10) only bounds the framing itself, so R4 fits the strip of map left between the panels |
| Colour key | "● Light (1–4)", "● Moderate (5–9)", "● Crowded (10+)": white floating pills in one centred row, the ranges from the band labels (`HEATMAP_BAND_EDGES`) |
| Admin PIN | Owner, same day: a full-width keypad (keys 72 dp tall, three across) low on the screen for one-handed use, "Wrong PIN." under the boxes, Unlock at the bottom (the commuter `Screen` gained `scroll={false}`) |

**Still true:** nothing on the home screen needs a tap; untouched, the map stays on the default view. **Safety note:** a map moved by hand stays where it was left until "Show the whole route" is tapped. If that is a problem on the road, the map could return to the default view by itself after a minute untouched (not built).

**Seen on the phone 2026-10-14** (Xiaomi 2311DRK48G, `development-driver` build, through adb): default view, names, zoomed-in discs ("—", no counts yet), dragging stopped at the tile edge, reset. Counts on the discs not yet seen (no heatmap message since the new setup).
