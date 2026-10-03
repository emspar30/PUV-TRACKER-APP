# Implementation plan: user flow v2

- **Date:** 2026-10-03.
- **Status:** proposal; no code until Emjay approves it.
- **Builds on:** PRD section 19 (decisions D1 to D14) and `docs/FLOW_GAP_ANALYSIS.md`.
- **Same rules as every plan:**
  - Pure logic in `src/shared` with Node tests on fixed fixtures.
  - Every threshold in `src/shared/config` (server values in `serverConfig.ts`).
  - Route facts only in seed files.
  - One local commit per approved step, never pushed.
  - No new dependency without asking.
  - No location permission before G0.

## 1. Order

| # | Step | GPS | Supabase | Phone | Native change | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **F1** Onboarding v2: persona, greeting, gender, auto avatar, commuter type | no | no | no | none | Medium |
| 2 | **F2** Profile screen (local): username, avatar, badges list, delete account | no | no | no | none | Medium |
| 3 | **F3** Landmarks and route suggestions | no | no | no | none | Medium |
| 4 | **F4** Check-in tab v2 UI: route-first, coloured dots, fading (local) | no | no | no | none | Small |
| 5 | **F5** Badges (local counts) | no | no | no | none | Small |
| 6 | S4 Part 2 (existing) after "Supabase is ready" | no | **yes** | no | none | Small to medium |
| 7 | **F6** Account, profile and Energy backend | no | **yes** | no | none | Large |
| 8 | R1 rebuild (existing, Emjay runs it), then G0 | G0 yes | no | no | R1 | as planned |
| 9 | G1 check-in cloud (existing), uses F4 and F6 | yes | yes | in-vehicle rule only | none | as planned |
| 10 | S5 live map (existing) | no | yes | no | none | Large |
| 11 | **F7** Tracking with ETA and Energy | boarding point: G0 or pin | yes | no | none | Medium |
| 12 | **F8** Newsfeed with expiry and flags | no | yes | no | none | Medium |
| 13 | **F9** Report flow with the manual vehicle picker | GPS path only | yes | Bluetooth later | none | Medium |
| 14 | G2, G3, G4 (existing), with the changes in section 4 | yes | yes | G4, battery | R1 | as planned |

- **Buildable now** (no GPS, no backend): F1 to F5.
- **Next:** F6 after "Supabase is ready".
- **Later:** F7 needs S5 data (the simulator is enough); F8 and F9 need the backend and sign-in.

## 2. Config constants to add (all proposals)

| Constant | Value | Step |
| --- | --- | --- |
| `GREETING_MORNING_END_H` / `GREETING_AFTERNOON_END_H` / `GREETING_EVENING_END_H` | 11 / 17 / 21 (Asia/Manila hour) | F1 |
| `FREQUENT_DESTINATIONS_MAX` | 3 | F3 |
| `USERNAME_MIN_LENGTH` / `USERNAME_MAX_LENGTH` | 3 / 20 | F2 |
| `BADGE_THRESHOLDS` | see F5 | F5 |
| `ENERGY_WALLET_CAP` | 5 | F6 |
| `ENERGY_PASSIVE_INTERVAL_H` / `ENERGY_PASSIVE_DAILY_MAX` | 12 / 2 | F6 |
| `ENERGY_EARN_REPORT_GPS` / `ENERGY_EARN_REPORT_NO_GPS` / `ENERGY_EARN_CHECKIN` | 1.0 / 0.5 / 0.3 | F6 |
| `ENERGY_EARN_DAILY_MAX_PER_SOURCE` | 1 | F6 |
| `TRACKING_COST_ENERGY` / `TRACKING_SESSION_MIN` | 1 / 30 | F7 |
| `PIONEER_FREE_TRACKING` | true (server flag in `app_config`) | F7 |
| `ETA_MIN_SPEED_KMH` / `ETA_MAX_PACKET_AGE_S` / `ETA_MIN_SAMPLES` / `ETA_MAX_DISTANCE_KM` | 5 / 90 / 2 / 10 | F7 |
| `FEED_POST_TTL_H` | 3 | F8 |
| `FEED_FLAGS_TO_HIDE` | 3 | F8 |
| `FEED_NIGHT_DELAY_S` | 120 | F8 |

## 3. Steps

### F1. Onboarding v2

**Goal.**
- The intro becomes four short steps: welcome with the persona, an optional gender question, commuter type, and frequent destinations (F3 fills in the last step's content).
- Every app open shows a greeting line.

**Files**

| Path | Change |
| --- | --- |
| `src/shared/profile/avatarPick.ts` (new) | `avatarSetFor(gender)` and `pickAvatar(gender, random)`: male-style 0 to 5, female-style 6 to 11, all 12 for "prefer not to say". The random source is passed in. |
| `src/shared/profile/greeting.ts` (new) | `greetingPeriod(date)` returns morning, afternoon, evening or night in Asia/Manila; variants are chosen by the period and the date |
| `src/features/profile/Avatar.tsx` | 12 new vector drawings in `react-native-svg`, ids 0 to 11 unchanged |
| `src/state/profileStore.ts` | Adds `gender: 'male' \| 'female' \| 'unstated' \| null` (null means not asked yet) |
| `src/app/onboarding.tsx` | Steps; Skip on each; the avatar is assigned at the gender step and shown with "Change in Profile" |
| `src/app/(tabs)/index.tsx` | The greeting line in the Live peek |
| `src/strings/en.ts` | Persona name, 3 variants per period, step titles |

**Tests**

| Criterion | Test |
| --- | --- |
| A stated gender picks from its 6 | `pickAvatar('male', r)` is always in 0 to 5 for 1,000 draws; `'female'` in 6 to 11 |
| "Prefer not to say" picks from all 12 | 1,000 draws cover all 12 ids |
| Greeting by Asia/Manila time, not the phone's zone | 10:59 morning, 11:00 afternoon, 17:00 evening, 21:00 night (Manila), from UTC dates |
| Gender stays on the phone | `privacy.test.ts`: no service or `supabase/` file mentions `gender` |

**Manual script**
1. Run `pm clear`.
2. Go through all four steps; then repeat with Skip on the first step.
3. Expect a greeting on Live, and an avatar from the right set.

**Risks.** The persona's name and tone (question 4). Drawing 12 recognisable avatars as simple shapes.

**Done when:** the tests pass; the emulator script passes; the backlog is updated; commit `Flow: onboarding v2 and greeting`.

### F2. Profile screen (local)

**Goal.**
- The avatar button opens **Profile**: avatar with Change, username, badges, then the existing settings rows.
- "Delete account" at the bottom wipes local data.

**Files**

| Path | Change |
| --- | --- |
| `src/shared/profile/username.ts` (new) | `generateUsername(random)`, for example "Commuter4821"; `validateUsername(name)` gives ok, too_short, too_long, bad_characters or blocked |
| `src/data/seed/usernameBlocklist.ts` (new) | Small blocklist (question 9) |
| `src/app/settings.tsx` becomes `src/app/profile.tsx` | Profile layout; Settings rows kept |
| `src/state/profileStore.ts` | Adds `username` |
| `src/services/localData.ts` (new) | `deleteLocalAccount()` clears the profile, settings, check-in and destinations stores; keeps the map and route data |

**Tests**

| Criterion | Test |
| --- | --- |
| 3 to 20 characters | "ab" too_short; "abc" ok; 20 ok; 21 too_long |
| Blocklist | A listed word in any case or with digits is blocked |
| Delete wipes local data | After `deleteLocalAccount()` every store is back to its defaults, and `onboarded` is false |

**Manual script**
1. Edit the username, then try a blocked name.
2. Delete the account. Expect the introduction to open.

**Done when:** the tests pass, then commit `Flow: profile screen`.

### F3. Landmarks and route suggestions

**Goal.**
- The user picks up to 3 frequent destinations from a landmark list (or taps the map) during onboarding and in Profile.
- My Ride shows them as chips.
- The app suggests which route serves each.

**Files**

| Path | Change |
| --- | --- |
| `src/data/seed/landmarks.placeholder.ts` (new) | Placeholder landmarks: the six stops, each marked `TODO(placeholder)`; real names later (D4) |
| `src/shared/routing/suggest.ts` (new) | `suggestRoutes(lines, from, to)` returns route codes with a valid `planTrip`; `suggestForDestination(lines, stops, to)` returns routes passing within the walking limit |
| `src/state/destinationsStore.ts` (new) | Up to `FREQUENT_DESTINATIONS_MAX`, on the phone |
| My Ride and onboarding | Chips, "Board route R4" hint |

**Tests (fixture lines, not the seed)**
- A destination 100 m from the fixture line suggests that route.
- A destination at 600 m suggests none.
- At most 3 destinations; a fourth replaces nothing and returns `full`.

**Risks.** With one route the suggestion is always R4 or nothing.

**Done when:** commit `Flow: landmarks and route suggestions`.

### F4. Check-in tab v2 (local UI, D13)

**Goal.** Route chips first. The chosen route's stations are drawn as dots in its theme colour, and the other routes fade.

**Files**
- `StopDots.tsx` gains `color` and `faded` props.
- `RouteLines.tsx` gains a faded opacity (`mapRoute.fadedOpacity` in the theme).
- `checkin.tsx`.
- `src/data/routeSource.ts` exposes which stations belong to which route.

**Tests**
- `stationsForRoute(routeData, 'R4')` returns its six stations, using a fixture with two routes.
- An unknown route returns none.
- Contrast: the faded route against the land is a design choice, not text, and is recorded.

**Done when:** commit `Flow: check-in route-first`.

### F5. Badges (local)

**Proposed list (D8)**

| Badge | Earned when |
| --- | --- |
| First trip planned | 1 trip planned on My Ride |
| First check-in | 1 check-in |
| Regular at the stop | 5 check-ins |
| First report | 1 report |
| Helping hand | 5 reports |
| Road regular | 20 reports |
| First live report | 1 report with GPS |

**Files.** `src/shared/profile/badges.ts` with `earnedBadges(counts)`; `src/state/countsStore.ts` keeps local counts now, replaced by ledger counts after F6.

**Tests.** Each threshold at n − 1 (not earned) and at n (earned); the badges come out in a fixed order.

**Done when:** commit `Flow: badges`.

### F6. Account, profile and Energy backend (after "Supabase is ready")

**Goal.**
- `profiles.username` (unique).
- An append-only `energy_ledger` with server functions that apply D14.
- Sign-in prompted at the first cloud action (D6).

| Table or function | Columns and rules | Row-level security and grants |
| --- | --- | --- |
| `profiles` + `username` | text, unique, 3 to 20, checked on the server too | Select and update own row |
| `energy_ledger` | user, delta, reason (`passive`, `report_gps`, `report_no_gps`, `checkin`, `tracking`), `created_at` | Select own rows; **no client write** |
| `energy_balance(user)` | Sum, clamped to the wallet cap | Execute for `authenticated` |
| Edge Function `energy` | `earn(reason)` and `spend(reason)`; caps per Asia/Manila day; passive +1 per 12 h, at most 2 a day; wallet cap 5 | Service role writes |

**Tests (`ingestCore` style, with fakes):**
- Cap of 1 per source per day.
- The day resets at 00:00 Asia/Manila, tested from UTC times.
- Passive refill at 12 h and 24 h, and not a third time.
- The wallet never exceeds 5.
- A spend with a balance below 1 is refused.
- Pioneer flag on means tracking costs 0.
- Integration: a client cannot insert into `energy_ledger`.

**Done when:** the migration is applied with your approval of the command; the integration tests pass; commit `Flow: energy and profile backend`.

### F7. Tracking with ETA (D1, D9)

**Goal.** Tap a vehicle on Live, then Track. This shows:
- a guide line from the vehicle to the boarding point;
- the ETA, when shown;
- the other vehicles faded;
- 1 Energy for 30 minutes, free while the pioneer flag is on.

**Files**
- `src/shared/telemetry/eta.ts`: `etaMinutes({ vehicleChainageKm, boardChainageKm, recentSpeedKmh, packetAgeS, samples })`, which returns a number or null.
- `src/state/trackingStore.ts`.
- The Live screen.

**ETA tests**

| Case | Expected |
| --- | --- |
| 2.0 km to go at 20 km/h | 6 min |
| Vehicle past the boarding point (not approaching) | null |
| Speed under 5 km/h | null |
| Packet older than 90 s | null |
| Fewer than 2 samples | null |
| More than 10 km away | null |

**Other tests**
- A session ends at 30 minutes.
- Energy is spent once per session.
- With the pioneer flag on, nothing is spent.

**Manual.** Simulator at 20 km/h. Pick a boarding point by pin (or G0 location). Expect the ETA to fall about a minute per 333 m.

**Done when:** commit `Flow: tracking with ETA`.

### F8. Newsfeed (D2, D12)

| Table | Columns | Rules |
| --- | --- | --- |
| `feed_posts` | id, author username, avatar id, route code, stop code (optional), seats band, preset message, `created_at`, `expires_at` | Insert through an Edge Function (team accounts, rate limit); select only where `expires_at > now()` and the post is not hidden; Night Mode delay for posts with a stop; deleted by `pg_cron` |
| `feed_flags` | post, flagger, reason (`fake`, `spam`), `created_at` | One flag per user per post; at `FEED_FLAGS_TO_HIDE` the post is hidden; kept 30 days |

**UI.** The feed list sits in the expanded Live sheet: author, avatar, route badge, seats pill, age.

**Tests.**
- An expired post is not returned.
- A post with a stop, created at 21:30 Manila, is visible only from 21:32.
- The third flag hides the post.
- A user's second flag on the same post is refused.
- Posts never contain coordinates (validator).

**Done when:** commit `Flow: newsfeed`.

### F9. Report flow (D5, D12)

**Goal.**
1. A floating Report button opens a sheet: pick a vehicle (manual picker, dev flag), seats, and a GPS switch.
2. With GPS on, the existing broadcast path runs (G2) and earns 1.0.
3. With GPS off, it creates a feed post and earns 0.5.
4. Everything is marked unverified.

**Tests**
- The GPS path calls ingest and never the feed.
- The no-GPS path posts and never sends a position.
- The Energy reason matches the path.
- The picker is hidden without the flag.

**Phone.** Bluetooth detection later (S6, S7).

**Done when:** commit `Flow: report flow`.

## 4. Changes to the existing GPS plan steps

| Step | Change |
| --- | --- |
| S4 Part 2 | Adds `app_config.pioneer_free_tracking` and `feed_post_ttl_h` rows; `pg_cron` jobs for feed expiry (approval of the command first) |
| G0 | "Use my location" also feeds the boarding point for F7 and "from here" suggestions in F3; the consent screen is a separate step after onboarding v2, still before any permission |
| G1 | Uses the F4 screen; a check-in earns 0.3 Energy through F6 (once a day) |
| S5 | Vehicles become selectable for F7 tracking; the faded style for non-tracked vehicles; the feed sits beside the coverage status |
| G2 | The F9 report flow becomes the entry point; the dev broadcast screen stays for tests; Energy is awarded by F6 |
| G3 | Feed posts are not verified (no location); flags feed the risk signals |

## 5. Packages and native changes

| Step | Packages | Native |
| --- | --- | --- |
| F1 to F5 | none (`react-native-svg`, zustand and kv-store are installed) | none |
| F6, F8 | none (`@supabase/supabase-js` is installed) | none |
| F7 | none | none |
| F9 | none for the manual picker | Bluetooth detection later needs a native BLE scanner and `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT`: a **new rebuild (R3)**, not in R1 |
| R1 list | Unchanged: icon and splash, `expo-system-ui`, `expo-notifications`, `expo-battery`, `expo-network`, `expo-task-manager`, `expo-intent-launcher`, location foreground service | |

## 6. Privacy summary

See `FLOW_GAP_ANALYSIS.md` section 3.
- The gender answer and frequent destinations never leave the phone.
- Feed posts have no coordinates, expire after `FEED_POST_TTL_H`, and follow the Night Mode delay for stops.
- The Energy ledger is kept for the life of the account (PRD 15.1).

## 7. Questions

1. **Avatar and gender in the feed:** accept that a gendered avatar on public posts reveals the stated gender, use one neutral feed avatar, or make all 12 avatars gender-neutral? *Blocks F1 drawings and F8.*
2. **Feed content:** preset messages and fields only (route, stop, seats, a few phrases), or free text too? Free text needs moderation. *Blocks F8.*
3. **Feed lifetime and flags:** 3 hours, and hide after 3 flags? *Blocks F8.*
4. **Persona:** a name and tone for the greeting (for example "Tunton")? *Blocks F1 strings.*
5. **Frequent destinations:** at most 3? *Blocks F3.*
6. **Profile vs Settings:** the avatar button opens Profile, which also holds the settings rows (one sheet)? *Blocks F2.*
7. **Badges:** approve the seven in F5? *Blocks F5.*
8. **Pioneer period:** how long, and what ends it (PRD 18.1 is open)? *Blocks F7 defaults.*
9. **Username blocklist:** who supplies the English and Cebuano words? *Blocks F2.*
10. **Sign-in for reading the feed:** may signed-out users read posts, or only team accounts (as with live view)? *Blocks F8 policies.*
11. **ETA limits:** accept 5 km/h, 90 s, 2 samples, 10 km? *Blocks F7.*
12. **PRD sections 3.4 and 5.5** do not exist; are the mapped sections in PRD 19.3 what you meant? *Blocks nothing.*
