# Audit: CA1.1 rounds 1 to 7

> **Status:** complete. This file records what changed after commit `1d86317`.

- **Date:** 2026-10-22.
- **Base:** `main` at `1d86317`. Rounds 2 to 7 were uncommitted until this audit.
- **Scope:**
  - Read: the working tree diff (56 files changed, plus new files), `docs/STATUS.md` rows CA1.1 to round 6, and the new migration.
  - Commands run: `tsc --noEmit`, `expo lint`, `jest --runInBand`.
  - Not done: no emulator run, no native rebuild, no Supabase call.
- **Status codes:**

| Code | Meaning |
| --- | --- |
| `DONE-TESTED` | Built and covered by unit or flow tests |
| `DONE-UNTESTED` | Built, with no test that covers it |
| `NEEDS-DEVICE` | Built, but only an emulator or phone can confirm it |
| `NEEDS-ACTION` | Waiting on a step outside the code |

## 0. Summary

1. **Every round is built.** None of it has been seen on the emulator after its last change.
2. **One server step is outstanding.** `supabase/migrations/20261022000000_checkin_points.sql` is not applied to the live project. Until it is, live check-ins still earn 0.3 Energy, and no account gets the welcome 5.
3. **One native step is outstanding.** The dark splash in `app.json` needs a native rebuild.
4. **Two defects were found and fixed during this audit:**
   - Locate at full zoom-out (§2.1);
   - an error mapping that was too broad (§2.2).
5. **Checks:** `tsc` and lint are clean. Jest: 107 suites passed; 1,401 tests passed and 12 skipped.

## 1. What each round changed

| Round | Area | What changed | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | Ask Tunton | The parser reads "for" as the destination. Typo matching (`editDistance`, `fuzzyPlaces`). Answers say "Showing results for …" and offer "Did you mean …?" chips. A chat bottom sheet. History is kept for 1 hour. Online only. | `shared/assistant/`, `shared/routing/placeSearch.ts`, `app/assistant.tsx`, `state/assistantStore.ts` | DONE-TESTED (commit `1d86317`) |
| 2 | Tunie, Map controls | The assistant is renamed Tunie and has an avatar button. The Map gets + and − buttons. A second Locate tap zooms out. My Rides gets a heading card. Relay details show progress. | `features/assistant/TunieButton.tsx`, `(tabs)/index.tsx`, `features/ride/HeadingCard.tsx`, `shared/relay/progress.ts` | DONE-TESTED (logic); NEEDS-DEVICE (motion) |
| 3 | Sheet motion, Routes button | Tunie's sheet slides in and out. A Routes round button is added. With no route picked, the Map shows the running multicabs. Search results show a skeleton first. Cards fade. | `components/BottomSheet.tsx` (`slideIn`, `dismissKey`), `features/search/PlaceResults.tsx` | NEEDS-DEVICE |
| 4 | Locate outside the map | A GPS fix outside the Butuan tiles (the emulator's California default) shows a toast and frames the whole map. All routes is listed first. | `(tabs)/index.tsx` `locate`, `features/live/RouteSelector.tsx` | DONE-UNTESTED |
| 5 | Fare, settings, simulation | The base fare is ₱14.00 (`ROUTE_DATA_VERSION` 8). The Default route and "Multicabs on the map" settings are removed. A spot can be pinned as the simulated location. The logo follows the theme. The splash is dark. | `shared/config`, `app/simulated-pin.tsx`, `shared/demo/simulatedPosition.ts`, `components/Logo.tsx`, `app.json` | DONE-TESTED (fare, position); NEEDS-ACTION (rebuild for the splash) |
| 6 | Remembered route, near dot, points, boarding | The Map keeps the picked route (`settingsStore.mapRoute`). The "You" dot shows on All routes. The Map tab shows a red dot within 1 km. A check-in costs 0.3 per route. A relay without GPS earns 0. Every account starts with 5. A "Did you board?" prompt appears when a multicab stands at the stop and at 5 minutes. | `settingsStore`, `trackingStore`, `shared/backend/rules.ts`, `shared/checkin/boarding.ts`, `features/checkin/CheckInReminder.tsx`, the migration | DONE-TESTED (logic); NEEDS-ACTION (migration) |
| 7 | Locate at full zoom-out | The pan limit is lifted to the tile edge before any camera move the app asks for. | `features/map/OfflineMap.tsx` | NEEDS-DEVICE |

## 2. Defects found during the audit

### 2.1 Locate centred on the middle of the map (fixed, round 7)

- **Seen:** your emulator check on 2026-10-22. At full zoom-out, the first Locate tap zoomed in on the map's centre instead of the pinned spot. Zoomed in a little first, it worked.
- **Cause:**
  - ST2-C3 limits where the camera centre may go. The limit is the tile set minus half the visible area.
  - At `MAP_MIN_ZOOM`, the visible area is about as wide as the tiles, so the limit shrinks to nearly a point at the middle.
  - `easeTo` towards the commuter was clamped to that point, and the zoom then went in there.
  - Round 6's "You" dot fix was correct, but it was not this bug.
- **Fix:**
  - When a new `focus` arrives, `OfflineMap` sets the limit to the whole tile set (`OPEN_VIEW`) during the same render.
  - It moves the camera one frame later, so the native camera already has the wider limit.
  - The camera's next region report sets the normal limit again.
  - This applies to route framing too, which could clamp the same way.
- **Remaining risk:** the second Locate tap zooms out to `MAP_MIN_ZOOM` on the commuter. Near a tile edge, that view may briefly show past the tiles, then settle when the limit comes back. Check this on the emulator.

### 2.2 Any server error with code P0001 read as "not enough Energy" (fixed)

- **Cause:** `liveCrowd` mapped every P0001 from `check_in` to `not_enough_energy`. But P0001 is also PostgreSQL's code for any `raise exception` written without an error code.
- **Fix:** the error's message must also contain "not enough energy". `crowd.test.ts` now also checks that a different P0001 error stays a plain error.

## 3. Review of round 6 (the points economy)

| Check | Result |
| --- | --- |
| Charge and check-in in one transaction | Yes. `energy_charge_checkin` runs inside `check_in` and `check_in_routes`. A refused charge rolls the check-in back. |
| Double charge on retry | No. The `request_key` is checked under the per-user advisory lock. |
| Callable directly by the app | No. Execute is revoked from `public`, `anon` and `authenticated`. Only the security-definer check-in functions call it. |
| Energy switched off | Check-ins are free, as tracking is. The phone shows no cost line and does not cap the routes. |
| Wallet cap | The balance is read as `least(balance, energy_wallet_cap)`, the same rule tracking uses. |
| Welcome Energy | Booked once (key `welcome-energy`, `on conflict do nothing`), only for an account with no ledger rows. It starts the refill clock, so the first spend is not refilled at once. |
| Existing accounts | They do not get the welcome 5. They keep their balance. |
| Earnings | A GPS relay earns +1.0 at most once per Manila day, as before. A relay without GPS earns 0. Waiting refills +1 every 12 hours, at most 2 a day. |
| Phone and server agree | The demo wallet (`demoEnergy.ts`) and `rules.ts` mirror the SQL rules. `crowd.test.ts` and `energy.test.ts` run the loop: welcome, spend, refusal, GPS earn, refill. |

## 4. Review of the boarding prompt

- **When it asks:** a multicab of a pinged route that is Live (not hidden, fresh within `COVERAGE_LIVE_MAX_AGE_S`), slower than `STATIONARY_SPEED_KMH`, and within 60 m of the stop for 10 s. It asks once per multicab per check-in. It also asks at 5 minutes.
- **Answers:** "Yes, I boarded" ends the check-in and records the ride. "Not yet" keeps the check-in.
- **Known limits:**
  - `dialogStore` holds one dialog at a time, so a boarding prompt replaces any dialog already open.
  - The prompt is in-app only. Nothing is shown while the app is closed.
  - A prompt left open after the check-in expires still records the ride when "Yes" is tapped. This is harmless: the end call is best effort.
- **Demo:** multicabs stand 8 to 20 s at a stop, so the 10 s dwell catches most stops but not all.

## 5. Checks

- `npx tsc --noEmit`: clean.
- `npx expo lint`: clean.
- `npx jest --runInBand`: 107 suites passed; 1,401 tests passed and 12 skipped.
- The live suites skip 12 tests when the service role key is absent, as before.

## 6. What you need to do

1. Apply `20261022000000_checkin_points.sql` to the live Supabase project, in the SQL editor or with `supabase db push`.
2. Check on the emulator:
   - Locate at full zoom-out, with a pinned spot and with a stop;
   - the second Locate tap;
   - the remembered route after a restart;
   - the Map tab dot within 1 km;
   - the check-in cost line and the capped ticks;
   - the "Did you board?" prompt at a stop.
3. Rebuild natively for the dark splash.
4. Decide whether the points keep the name "Energy" or become "tracking points".
