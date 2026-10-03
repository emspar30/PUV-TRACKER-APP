# User flow v2: gap analysis

- **Date:** 2026-10-03.
- **Base:** commit `c31b21f`.
- **Updated:** with Emjay's answers (PRD 19.2 and 19.4). Conflict A is resolved.
- **Sources:** PRD section 19 (the flow and decisions D1 to D14), and the code as it stands after UX2.
- **Build class:** **GPS-free** means buildable and testable now on the emulator with no location and no backend. **Supabase** means it needs the live backend ("Supabase is ready"). **Phone** means it needs a real phone (Bluetooth, background, battery, real GPS).

## 1. Flow items

| # | Flow item | Exists now (after UX2) | PRD before section 19 | Conflict | New work | Depends on | Class |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Welcome with persona | One-screen intro: logo, "Welcome to Tunton", fare type, avatar picker, Start, Skip | 7.1: sign-in, classification, avatars, consent | No persona in the PRD | Persona name and greeting lines (D11); intro becomes steps: welcome, gender, type, destinations | — | GPS-free |
| 2 | Greeting on every open | None | None | — | Time-based line from a few variants in the strings file, shown on Live | 1 | GPS-free |
| 3 | Optional gender, auto avatar | 12 avatars (4 shapes x 3 colours), chosen by hand | 7.1: 12 presets, profile only Resolved: feed posts use a neutral badge, never the avatar (section 4, A) | 12 new drawings; 6 assigned to Male and 6 to Female; "Prefer not to say" picks from all 12; picked once, stored on the device, Shuffle in Profile only | — | GPS-free |
| 4 | Commuter type | Fare-type chips (Regular, Student, Senior, PWD), shared with My Ride and Settings | 7.1 | None | Becomes an intro step; same store | — | GPS-free |
| 5 | Frequent destinations and route suggestion | None | None | Landmark names are not route facts but must live in a seed file (D4) | Landmarks seed file; pick up to N destinations (or tap the map); `suggestRoutes()` names the route(s) serving each from the user's area; chips on My Ride | Landmarks file; route data | GPS-free (G0 adds "from my location") |
| 6 | Live map, all PUVs, essentials | Live map, route line, stop card, "No data" pill, sheet | 7.3, 7.4 | — | Vehicle layer (S5), route filter chips, coverage pill | S4 Part 2, S5 | Supabase (simulator for data) |
| 7 | Track one PUV: guide line, ETA, others faded, 1 Energy | None | 7.3: live view costs 1 Energy per 30 min; 7.4: ETA in Phase 2 | **D1 changes what costs Energy; D9 brings ETA forward** | Tracking session (30 min); pure `etaMinutes()`; fade others; guide line to boarding point; Energy debit; pioneer flag | S5; Energy ledger (11) | Supabase; ETA logic GPS-free; the boarding point uses G0 or a pin |
| 8 | Station check-in with route-coloured dots | Local check-in: route chip, station chips, 15-min countdown, `verifyCheckIn()` | 7.5; GPS plan G1 | None | Route-first chips; that route's stations as dots in its colour; other routes faded; cloud table and geofence in G1 | G0, G1 | UI GPS-free; G1 needs Supabase and G0 |
| 9 | My Ride with fare | Done in UX2 (result card, quick fare-type chip, Details) | 7.2 | None | Frequent-destination chips; suggested route on the card | 5 | GPS-free |
| 10 | Report: Bluetooth, seats, GPS on or off | Ingest function and packet (S4 Part 1, not live); no report UI | 8.1 to 8.4 (BLE, verification, relay) | D5: manual picker replaces BLE for now; reports without GPS are new | Floating Report button (D12); manual vehicle picker (dev flag); seats; GPS switch; GPS path = telemetry (G2), no-GPS path = feed post; Energy award | S4 Part 2, G0 and G2 for GPS, feed (12), ledger (11); BLE later | Supabase; GPS path needs G0 (emulator GPS works); BLE needs **phone** |
| 11 | Energy | Config constants for none of it | 11.1 | D1 (spending) | `energy_ledger` table, server functions for earn and spend, caps by Asia/Manila day, wallet cap 5, passive refill | S4 Part 2, sign-in | Supabase |
| 12 | Newsfeed (posts without GPS) | None | 5.1: community feed Phase 3; 0.6 out of scope | D2 brings it into the pilot; Night Mode (10.4) must apply | `feed_posts` with 60-minute expiry, fixed fields and preset phrases only, Realtime list in the expanded Live sheet, pseudonymous username with a neutral badge; team accounts only | S4 Part 2, sign-in, username (14) | Supabase |
| 13 | Flag a fake or spam report | None | 11.3 (weighted, moderated, appeals) | Full 11.3 is out of scope | `feed_flags`; hide a post after 3 unique flags and queue it for review; moderator view = Supabase dashboard | 12 | Supabase |
| 14 | Profile: username, delete account, badges, avatar, settings | Settings sheet: fare type, theme, avatar, About, replay intro, team account | 7.1, 15.1 (deletion) | — | Profile screen from the avatar button; username generate, edit, validate (D7); avatar Shuffle; delete = local wipe (D10); badges (D8), no ranking | — | GPS-free (cloud username later: Supabase) |
| 15 | Badges | None | None | — | Pure `earnedBadges(counts)`; local counts now, ledger counts later | 14 | GPS-free; cloud counts: Supabase |
| 16 | Sign-in when first needed | Team sign-in screen; Settings account card | 7.1 (email and password for v0) | — | Prompt at first cloud action (tracking, check-in, report, posting) | S4 Part 2 | Supabase |

## 2. What changes in the existing UX2 screens

| Screen (exists) | Change |
| --- | --- |
| Introduction (`onboarding.tsx`) | Becomes four short steps: welcome with persona; optional gender ("Prefer not to say"), then the avatar is assigned and shown; commuter type (the existing fare-type chips); frequent destinations (landmark chips or map tap). Skip stays on every step. |
| Live tab | Greeting line in the peek; route filter chips; floating Report button; feed inside the expanded sheet; vehicle markers and tracking later. |
| Check-in tab | Route chips first; selected route's stations as dots in its colour; other routes faded (opacity from the theme). Countdown, `verifyCheckIn()` and the local store stay; G1 moves the record to the cloud. |
| My Ride | Frequent-destination chips above the stop chips; suggested route on the result card. Fare unchanged. |
| Settings sheet | Becomes **Profile**, opened by the same avatar button: avatar (with "Change"), username (edit), badges, then the existing fare type, theme, About, Replay intro, Team account, and "Delete account" at the bottom. |
| Avatars (`Avatar.tsx`) | The 4 x 3 shapes are replaced by 12 new drawings, 6 male-style and 6 female-style. Ids stay 0 to 11, so saved choices remain valid. |

## 3. Privacy (PRD 10.4 and 15.1)

| Data | Stored where | How long | Leaves the phone? | Notes |
| --- | --- | --- | --- | --- |
| Gender answer | Phone (kv-store) | Until changed or the account is deleted | Never | Only picks the avatar set |
| Avatar id | Phone (kv-store) | Until Shuffle or the account is deleted | Never | Feed posts use a neutral badge derived from the username |
| Commuter type | Phone (kv-store) | Until changed or the account is deleted | Never | Used only for the fare estimate |
| Frequent destinations | Phone | Until removed or the account is deleted | Never | Home or work places are sensitive; never uploaded |
| Username | Phone now; `profiles` in the cloud later | Until changed or the account is deleted | Later, as the feed author name | Pseudonymous; blocklist; unique in the cloud |
| Feed posts | Cloud `feed_posts` | 60 minutes (`FEED_POST_TTL_MIN`), then deleted by a scheduled job | Yes, team accounts only | Route, optional stop code, seats tier, preset phrase; **no coordinates, no free text**; author is the username only (badge derived on the client) |
| Flags | Cloud `feed_flags` | 30 days (session-link rule) | Yes | Readable by the service role only |
| Reports with GPS | `telemetry_latest`, `telemetry_raw`, `relay_sessions` | Raw 7 days by day, 24 hours at night; sessions 30 days | Yes | As GPS plan G2; markers never show the rider |
| Badges | Phone now (counts); later derived from the ledger | Life of the account | Later | No location |
| Energy ledger | Cloud `energy_ledger` | Life of the account (PRD 15.1) | Yes | Amounts and reasons, no location |
| Tracking session | Phone; Energy debit in the ledger | Session: 30 minutes | Debit only | Which PUV was tracked is not stored in the cloud |
| Check-ins | Phone now; cloud `checkins` in G1 | 15 minutes, then deleted | In G1 | No coordinates stored (G1) |

**Night Mode and the feed (10.4).**
- Feed posts carry no coordinates, only a route, an optional stop code, seats and a preset message.
- During the Night Mode window, by server time, a post that names a stop is shown only after a delay of at least 2 minutes, matching the static node rule.
- Posts with no stop show at once.
- Posts are deleted at their lifetime as usual.

## 4. Biggest conflicts and risks

1. **A. The avatar in the feed leaks gender.** *Resolved:* posts show the username with a neutral badge (colour and initial from the username); the preset avatar and the gender answer never leave the phone.
2. **B. Energy and tracking need the backend and live vehicles.** D1, D9 and D14 cannot be demonstrated before S4 Part 2 and S5. The local steps can go first; the Energy demo waits for "Supabase is ready".
3. **C. Reports depend on parts not yet built or not testable here.** The GPS report path needs G0 and G2. The Bluetooth path needs a real phone and a driver beacon. The prototype uses the manual picker (D5); the no-GPS path needs the feed.
