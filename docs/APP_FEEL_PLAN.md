# App feel plan: clean UI and a Demo mode

- **Date:** 2026-10-04.
- **Status:** proposal. Nothing here is built until Emjay approves it.
- **Goal:** the app looks clean, is easy to navigate, shows minimal information, and feels like a working application, **without Supabase and without a real phone**.
- **Fits the master plan:** these steps (AF1 to AF10) run beside G0 and F2 to F5. They never replace the real work. Every demo source is replaced by its Supabase source later (SB1 onwards), with no change to the screens.

## 1. Demo mode design

**Shape.** Every live data source sits behind a repository interface. Screens read only the interface. Each interface has a **demo** implementation now and a **Supabase** implementation later.

| Repository | Demo implementation (on the device) | Real implementation (later) |
| --- | --- | --- |
| `VehiclesRepository`: subscribe to vehicles on a route; latest position, speed, heading, seat tier, age | Simulated PUVs walking the seed polyline at a set speed, with stops and silences | `telemetry_latest` and Realtime (L1) |
| `CheckinsRepository`: my check-in; waiting counts per station | Local check-in (exists) plus generated counts per station | `checkins` and `checkin_counts` (C1) |
| `ReportsRepository`: send a report (vehicle, seats, GPS or not); feed posts; flag a post | Local queue; generated feed posts with fixed phrases; local flags | `ingest`, `feed_posts`, `feed_flags` (T1, RP1, N1) |
| `EnergyRepository`: balance, earn, spend, history | Local ledger with the PRD caps | `energy_ledger` and the `energy` function (SB2) |

**Rules**

| Rule | How |
| --- | --- |
| Pure logic | Simulation, ETA, seat tiers, coverage, Energy caps and feed expiry are pure functions in `src/shared/`, tested on fixtures |
| Deterministic | A seeded random generator (`DEMO_SEED`), so the same seed gives the same vehicles, counts and posts; tests use fixed seeds |
| One switch | `DEMO_MODE` in the config module, plus a Settings row "Demo data" (on or off). The **default is decided by Emjay** (question 1). |
| Always labelled | Every screen that shows demo data carries a visible **"Demo"** chip. Demo vehicle markers show the same "Demo" badge. |
| Never real people | Demo plates look like `DEMO 01`. Demo usernames come from a fixed list such as `Rider_07`. No real names, no photos, no avatars of other people. |
| Nothing leaves the phone | The demo implementations import no service and send nothing (privacy test extended) |
| Thresholds | Every number in the config module (`DEMO_VEHICLE_COUNT`, `DEMO_SPEED_KMH`, the stop and silence lengths, and so on) |

## 2. What Demo mode makes possible

| Feature | Behaviour (PRD numbers) |
| --- | --- |
| Moving PUVs on the selected route | 3 demo vehicles (config) walk the outbound and return lines; markers in the route colour with a heading cone |
| Seat tiers | Seats taken 0–6 green "Seats available", 7–12 amber "Filling up", 13+ red "Full", of 16 (PRD 7.3) |
| Coverage | Live under 90 s, Stale to 10 min (greyed with its age), then No data; never "no vehicles" (7.3) |
| Stopped bubble | Under 2 km/h across 45 s: "Stopped" (7.3) |
| Tracking one PUV | Tap a marker, then Track: the other PUVs fade to 8 %; a dashed guide line from the PUV to my boarding point |
| ETA | Distance along the route to my boarding point ÷ recent speed. **Hidden** when slower than 5 km/h, no packet for 90 s, fewer than 2 samples, or farther than 10 km (19 D9) |
| My position | The blue dot (permission granted) or the manual pin; the boarding point snaps to the line |
| Check-in with counts | My check-in plus waiting counts per station (demo), 15-minute lifetime (7.5) |
| Report flow | Floating Report button: manual vehicle picker (demo vehicles), seat tier, GPS on or off; marked unverified (19 D5) |
| Feed | Fixed fields and phrases ("Full", "Few seats", "Not moving", "Heavy traffic", "Loading"); 60-minute expiry; hidden after 3 unique flags; neutral badges; no coordinates (19 D2) |
| Energy | Wallet cap 5; passive +1 per 12 h (2 a day); report with GPS +1.0, without +0.5; check-in +0.3; each once a day; reset at Manila midnight; tracking 1 per 30 min, free while `ENERGY_ENABLED` is off (19 D1, D14) |

## 3. Clean and minimal UI, per screen

| Screen (tab name) | Shown by default | After a selection | One primary action | Empty, loading, error |
| --- | --- | --- | --- | --- |
| **Live** | The map with no lines; route chips in the sheet; Locate me; a status pill "Pick a route" | The route line and stops; vehicles (demo or real); "Show whole route"; Outbound and Return. A vehicle tap opens a small card: seat tier, age, Track. | Pick a route, then Track | Empty: "No data" pill. Loading: logo and "Preparing the offline map". Error: one line and "Try again". |
| **Check-in** | Route chips; "Pick a route" | Station dots in the route colour; station chips; waiting counts | Check in | Empty: "No data". Offline (cloud later): one line. |
| **My Ride** | From and To pills; stop chips; "All routes" | The trip: amber ride, pins, fare as the big number, fare-type chip; Details | Pick To (From follows) | Failure: one short line with the number and one fix button |
| **Profile** (avatar button) | Avatar with Shuffle; username; badges; fare type; theme; Demo data; About; Replay intro; Team account | — | None (a settings list) | Badges empty state: one line |

**Remove or shorten today (text budget ≤ 8 words on main screens)**

| Where | Today | Change |
| --- | --- | --- |
| Live sheet | "No data from riders right now" line, the legend box, the long stops list with full addresses | One pill carries the status. Legend only in Details. Stops as short codes with the name behind a tap. |
| Live, location explainer | 28 words | ≤ 12 words: "Show your location? Used only while the app is open." |
| Live, location off | 11 words, promising a pin nobody uses | "Location off · Long-press to set start" (G0 makes My Ride use the pin) |
| Live and My Ride | "Sample data" chip on every sheet | One "Sample data" chip per screen, in the header only. "Demo" replaces it while demo data shows. |
| Check-in | "Waiting here", "Counts need team sign-in" | The count pill only; sign-in hint in Profile |
| My Ride | "DEV Run routing benchmark" in dev builds | Unchanged (development builds only) |
| Profile (now "Settings") | "The backend is not set up on this build…" (23 words) | "Team account · not set up" |

**Tab names:** Live, Check-in, My Ride (unchanged, two words or fewer). The sheet is renamed **Profile** (F2).

## 4. Navigation and first-run clarity

| Minute | What the user sees | How they find the feature |
| --- | --- | --- |
| 0:00 to 0:30 | The four-step intro (exists) | Skip on every step |
| 0:30 | Live with the greeting card and route chips | **One hint per tab**, shown once, ≤ 6 words, dismissed on first use: Live "Pick a route to see PUVs", Check-in "Pick your route, then station", My Ride "Where are you going?" |
| 0:45 | Picking R4 shows the line and demo vehicles moving | The PUV marker is tappable; the card says Track |
| 1:00 | My Ride from a greeting chip | The fare as the big number |

No tutorial screens beyond these hints. The hint text lives in `strings/en.ts`; "seen" flags are stored on the device.

## 5. Order of work

**Native:** none of the steps needs a native change or a new package. **GPS:** only AF6's "my position" uses the blue dot, and falls back to the manual pin. **Supabase:** none.

| Step | Goal | Files | Acceptance (exact numbers) | Tests | Manual script | Risks | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **AF1** Text cleanup | Main screens at ≤ 8 words per message | `strings/en.ts`, Live, Check-in, Profile | Every string shown on Live, Check-in and My Ride without a tap is ≤ 8 words (a test over the strings used there); the explainer ≤ 12 words | unit (word count) | `AF1-M1`: read each tab | Overlap with G0 explainer text | Small |
| **AF2** Repository interfaces and the Demo switch | Screens read data through interfaces | `src/data/repositories/*` (interfaces), `src/data/demo/*`, config `DEMO_MODE`, `DEMO_SEED`; "Demo" chip component | Switch off: no demo data anywhere; on: the chip on every screen with demo data | unit (the switch selects the implementation); privacy test (demo imports no service) | `AF2-M1`: toggle in Profile | Interfaces that do not fit Supabase later | Medium |
| **AF3** Demo vehicles on Live | Something moves | `src/shared/demo/simulate.ts`, `src/shared/telemetry/coverage.ts`, `occupancy.ts`, `stopped.ts`; marker layer | Positions follow the polyline at `DEMO_SPEED_KMH`; coverage 89 s Live, 100 s Stale, 600 s No data; tiers 6 green, 7 amber, 13 red; stopped under 2 km/h over 45 s; same seed gives the same positions | unit on fixtures | `AF3-M1`: pick R4, watch 2 minutes | Marker performance (PRD 13: 55 FPS with 50 markers) | Medium |
| **AF4** Vehicle card and tracking | Tap, Track, fade others | Live, `trackingStore` | Others at 8 %; one tracking session; a dashed guide line | unit | `AF4-M1` | — | Small |
| **AF5** ETA | Minutes to my boarding point | `src/shared/telemetry/eta.ts` | 2.0 km at 20 km/h gives 6 min; null under 5 km/h, after 90 s, under 2 samples, over 10 km, or when past the point | unit | `AF5-M1` | ETA jumps with simulated speed changes | Small |
| **AF6** My position and boarding point | Dot or pin as the boarding point | Live, location store | With a fix: boarding point = fix snapped to the line; without: the manual pin; neither: "Set your start" | unit (`selectOrigin`) | `AF6-M1` | Depends on G0 for consent | Small |
| **AF7** Check-in counts | Waiting counts per station | `CheckinsRepository` demo | Counts generated per seed; my check-in adds 1 while unexpired (15 min) | unit | `AF7-M1` | — | Small |
| **AF8** Report flow and feed | Report button, picker, seat tier, feed | `ReportsRepository` demo, Live sheet | 60-minute expiry; third unique flag hides; fixed phrases only; no coordinates | unit | `AF8-M1` | Scope | Medium |
| **AF9** Energy (local) | Wallet and earn and spend | `EnergyRepository` demo; `src/shared/energy/*` | Cap 5; passive +1 per 12 h, ≤2 a day; GPS +1.0, no GPS +0.5, check-in +0.3, each once a day; reset at 00:00 Manila; spend refused below 1 | unit | `AF9-M1` | Becomes SB2's server rules later | Medium |
| **AF10** One hint per tab | First-run clarity | strings, a small `hintsStore` | Each hint shows once, ≤ 6 words | unit | `AF10-M1` after `pm clear` | — | Small |

**Order:** AF1 (cleanup, with UX3 already done) → AF2 → **AF3 (something moving on Live)** → AF4 → AF5 → AF6 (after G0) → AF7 → AF8 → AF9 → AF10.

All steps run on the emulator. Things only the partner's phone can show: real battery, real GPS, and marker frame rate on a phone.

## 6. Honesty rules

| Rule | How |
| --- | --- |
| Visible label | "Demo" chip on every screen and marker with demo data; never removed while demo data shows |
| Config default | `DEMO_MODE` default decided by Emjay (question 1); a release build for the panel shows it in Profile |
| `STATUS.md` | A section splits **works with real data**, **works with demo data only**, and **not built** |
| Thesis wording | Demo features are described as "simulated" with the seed and the rules; measured results come only from real data |
| Still needed for real data | Supabase project and accounts (SB1); real Route 4 polylines; real stations and landmarks; the official fare; a phone test of the real relay (T1) |

## 7. Questions

| # | Question | Blocks |
| --- | --- | --- |
| 1 | `DEMO_MODE` default: on (the app feels alive at once) or off (real by default, Demo switched on for the panel)? | AF2 |
| 2 | How many demo vehicles, and which speeds (3 at 20 km/h proposed)? | AF3 |
| 3 | Approve the text cuts in §3, including moving the legend into Details? | AF1 |
| 4 | Should the hint per tab exist at all, or is the empty state enough? | AF10 |
| 5 | Order with G0: AF1 to AF5 before G0, or G0 first as approved? | Sequencing |
| 6 | Show Energy in the demo while `ENERGY_ENABLED` is off (tracking free), or keep Energy hidden until SB2? | AF9 |
