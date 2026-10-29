# Implementation plan: finish testing the build tracker

- **Date:** 2026-10-27.
- **Base:** `main` at `716f6a1`.
- **Why:** the Tunton Build Tracker still has features you cannot test yet. This plan lists everything that has to happen first, who does it, and in what order. It also adds two new pieces of work agreed on 2026-10-27:
  - a status mark on each multicab marker, which fixes the failed test `vehicles.move@1`;
  - a "Tunton regular" mark for earning all 7 badges.
- **Rules (unchanged):**
  - Pure logic goes in `src/shared`, with fixture tests.
  - Every threshold goes in `src/shared/config`.
  - Strings go only in `src/strings/en.ts`.
  - One local commit per approved step. Push only when asked.
  - Ask before any new dependency, native build or Supabase command, and get approval of the exact command.
  - Android only.
- **Test labels:** U (jest), L (live Supabase), E (emulator), P (one phone), X (field ride).
- **Size:** S is under a day of agent work, not counting device tests.

## 1. Where testing stands

| Status in the tracker | Features | What unblocks them |
| --- | --- | --- |
| Needs test | 35 | Most can be tested now on the emulator with Demo data on. Some need section 2 first. |
| Failed | 1 test (`vehicles.move@1`) | Step VS1 |
| Waiting | `brand`, `checkin-migration` | Native rebuild; the check-in points migration |
| Partly built | `night`, `notifications`, `route-data` | NM1; real notifications (not planned yet); the partner's route data |
| Not built | `rl2b`, `rl2c`, check-in anywhere | RL2a first; this plan's order |

## 2. Steps only you can do (they block tests)

Do these in this order. Each Supabase command is shown to you first, and runs only after you approve that exact command.

| # | Step | Unblocks |
| --- | --- | --- |
| A1 | Apply `supabase/migrations/20261022000000_checkin_points.sql` to the live project. | `checkin-migration`, `checkin-cost`, `welcome` |
| A2 | Apply `supabase/migrations/20261023000000_relay_gate.sql` (RL2a): first `npx supabase db push --dry-run`, then the push. Then approve the RL2a commit. | `rl2a`, live relays in `feed`, the first test phase, then RL2b |
| A3 | Supabase dashboard: Authentication, turn off "Confirm email" (or set up your own SMTP). | `au1` sign-ups by testers outside your Supabase team |
| A4 | Set up your phone as the test multicab with `scripts/provision-driver.ts`. | `rl2a`, `rl2c`, `ble`, the real relay ride (T1) |
| A5 | Native rebuild (`npx expo run:android` or an EAS development build). | `brand` (dark splash) |
| A6 | Deploy the SMS worker on Render again, after CA2-0, CA2-1 and CA2c are committed. | Check in anywhere on drivers' phones |

## 3. Decisions only you can make (they do not block code)

- The official multicab fare. Today ₱14.00 is assumed (`fare-14`).
- A DPO review of the location consent text (`consent`).
- Check in anywhere decisions D4 to D7 (`docs/IMPLEMENTATION_PLAN_CHECKIN_ANYWHERE.md` section 5).
- VS1 decisions V1 to V3 (section 4 below).

The partner's route data also has to come in: the R14 return leg, a re-check of the six left-out stops, the real terminal list and the traced detour lines (`route-data`, `dt1`).

## 4. New code steps

### VS1: a status mark on each multicab marker

- **The failed test.** `vehicles.move@1` expects a Stopped bubble. Today "Stopped" appears only as a pill on the vehicle card, after you tap a multicab, so nothing on the map itself shows it. The tester asked for a mark on the marker that says what the multicab is doing.
- **What changes.** Each multicab marker gets a small dot in one corner, with a colour and a shape for its status. The vehicle card keeps its pill and names the status in words.
- **The statuses and where each comes from:**

| Status | Source | Already known to the app |
| --- | --- | --- |
| Stopped | Speed near 0 for a while, or a layover at a terminal (`isStopped`, `layover`) | Yes |
| Loading passengers | A recent relay on that multicab with the phrase "Loading passengers" | Yes, in the feed |
| Heavy traffic | A recent relay on that multicab with the phrase "Heavy traffic" | Yes, in the feed |
| Moving | None of the above | Yes |

- "Unloading" has no source today. No relay phrase says it, and the multicab's speed cannot tell loading from unloading. It is left out unless decision V2 adds a phrase.
- A relay status lasts as long as the relay shows in Crowdsource, and never more than `VEHICLE_STATUS_RELAY_MAX_MIN` (suggested 10 minutes).
- The rule is pure: `vehicleStatus(vehicle, relays, nowMs)` in `src/shared/telemetry/`.
- The dot never relies on colour alone. Each status has its own shape or icon, and the marker's accessibility label names it.

| Step | What | Files | Tests | Size |
| --- | --- | --- | --- | --- |
| VS1 | The pure status rule, the dot on the marker, the name on the card | `shared/telemetry/vehicleStatus.ts`, `shared/config`, `features/map/` marker, `features/live/VehicleCard.tsx`, `strings/en.ts` | U: stopped, layover, relay loading, relay traffic, relay too old, two relays (newest wins), moving. E with Demo data | S |

| # | Question | Suggested |
| --- | --- | --- |
| V1 | Which statuses to show | Stopped, Loading passengers, Heavy traffic |
| V2 | Add an "Unloading" relay phrase | No: riders rarely know, and the dot would be guesswork |
| V3 | How long a relay status stays on the marker | 10 minutes, or less if the relay leaves Crowdsource sooner |

### BG1: the "Tunton regular" mark and the Badges rename

- **Agreed on 2026-10-27 (option a).** The Trusted commuter shield keeps its rule: 5 check-ins or relays nobody flagged, counted on the server, which takes a point back when someone flags a relay. It means "this person's reports are reliable".
- **New.** Earning all 7 badges adds a "Tunton regular" mark on the Profile, under the username, next to the Trusted commuter line. It means "this person uses the app a lot".
- **Profile only for now.** The badges are counted on the phone, so other people cannot see the mark yet. Showing it in Crowdsource needs the counts on the server and a migration; that is a later step, not part of BG1.
- **Rename.** The badge list heading changes from "Trust Badges (5/7)" to "Badges (5/7)", so it no longer suggests it controls the shield.
- **Earning it shows the same "Badge earned" notice** as a badge, with the mark's name.
- The rule is pure: `isRegular(counts)` in `src/shared/profile/badges.ts` returns true when every badge is earned.

| Step | What | Files | Tests | Size |
| --- | --- | --- | --- | --- |
| BG1 | `isRegular`, the mark on Profile, the heading rename, the notice | `shared/profile/badges.ts`, `app/profile.tsx`, `strings/en.ts` | U: 6 of 7 is not regular, 7 of 7 is, the notice fires once. E | S |

## 5. Code steps already planned elsewhere

| Step | Plan | Waits for |
| --- | --- | --- |
| RL2b earning per relay | `docs/IMPLEMENTATION_PLAN_PRD_GAPS.md` | A2, then approval of the RL2b migration |
| RL2c queued relay | `docs/IMPLEMENTATION_PLAN_PRD_GAPS.md` | RL2b, decision D12 |
| CA2-0 to CA2e, check in anywhere | `docs/IMPLEMENTATION_PLAN_CHECKIN_ANYWHERE.md` | D4 to D7 |
| NM1 night stop view | `docs/IMPLEMENTATION_PLAN_PRD_GAPS.md` | Approval of a migration and the `ingest` deploy |

## 6. Order

1. **VS1**, then **BG1**. Neither waits on anything; both can be tested on the emulator the same day.
2. **A1 to A3** in parallel with step 1, whenever you have time for the Supabase steps.
3. **Test rounds** on the emulator for every "Needs test" feature, with the tracker's checklists.
4. **A4**, then the first test phase with your partner and friends (RL2a, BLE, the real relay ride).
5. **RL2b**, then **RL2c**. **NM1** whenever its migration and the `ingest` deploy are approved.
6. **CA2-0 to CA2e** once D4 to D7 are answered, then **A6**.
7. **A5** whenever a native rebuild is convenient; nothing else waits on it.

Each code step is one commit after your approval, with its test checklist added to the tracker.
