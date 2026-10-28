# Implementation plan: check in anywhere along a route

- **Date:** 2026-10-27.
- **Base:** `main` at `bddb564`, plus the uncommitted UI work.
- **Why:** the panel will likely ask why a commuter can only check in at a predefined stop. Butuan multicabs pick people up anywhere along their route, so a commuter standing on the route between two stops should be able to check in too.
- **Rules (unchanged):**
  - Pure logic goes in `src/shared`, with fixture tests.
  - Every threshold goes in `src/shared/config`.
  - Strings go only in `src/strings/en.ts`.
  - One local commit per approved step. Push only when asked.
  - Ask before any new dependency, native build or Supabase command, and get approval of the exact command.
  - Android only.
- **Test labels:** U (jest), L (live Supabase), E (emulator), P (one phone), X (field ride).
- **Size:** S is under a day of agent work, not counting device tests.

## 1. The idea in one line

A commuter may check in anywhere close to a route line. The check-in is still counted at one stop: the nearest stop of that route. Drivers keep one number per stop. Long stretches with no stop get new stops, so the counted stop is never far from the commuter (Emjay, 2026-10-27: option 1).

Example: a commuter at Alba is 302 m from Zamora Cemetery and 360 m from SM City Butuan. A new stop, "Near Alba", fills that gap, and the commuter is counted there, not at Zamora.

## 2. What stays the same

- **The driver side.** The heatmap and the stop list sorted by most waiting do not change. A commuter between two stops adds 1 to the nearer stop's count. The driver never has to open the map or tap anything to find them.
- **The SMS batching.** One update per route still carries the counts of the whole route. More check-ins, or check-ins between stops, do not make updates more frequent. (The extra stops would make updates longer; section 3 keeps them to one SMS.)
- **The server's check-in function.** The phone already decides where a check-in is and sends only the stop code; the server never receives the commuter's coordinates (privacy, PRD 15). This plan keeps that: the line check runs on the phone, like today's 60 m stop check.
- **The existing spam brakes:**
  - Each check-in costs 0.3 Energy per route pinged (`ENERGY_CHECKIN_ROUTE_COST`). The wallet holds at most 5 and refills slowly.
  - The GPS fix must be accurate to 25 m or better (`GPS_ACCURACY_GATE_CHECKIN_M`) and at most 30 s old.
  - A location from a fake-GPS app is refused (`mocked`).
  - One active check-in per account. A new one ends the old one.
  - A check-in lasts 15 minutes.
  - "Did you board?" and the trusted badge.

## 3. What changes

### Commuter side

- Today the phone must be within 60 m of a stop (`CHECKIN_RADIUS_M`).
- After the change, the phone must be:
  - within `CHECKIN_LINE_M` (40 m) of the line of a route it pings, and
  - within `CHECKIN_STOP_MAX_M` (300 m) of the stop it is counted at.
- The farther limit refuses a check-in on a long stretch with no stop. The fix for such a stretch is a new stop in the seed data.
- The Check-in card shows where the check-in will be counted. For example: "Counted at SM City Butuan · 180 m".
- A tapped stop dot still picks that stop, under the same two limits.

### Fill stops on long stretches

- Today a route line can be up to 1.6 km from its nearest stop (R14 1650 m, R4 1590 m, R1 and R2 1345 m, R5 1245 m, R3 808 m).
- A script walks each route line. Wherever two stops are more than `FILL_STOP_GAP_M` (600 m) apart along the line, it adds evenly spaced stops, so no point of the line is more than 300 m from a stop.
- A fill stop near another (the other direction of a two-way road, or another route's fill stop) within 100 m is shared, not doubled.
- Each fill stop is named after the nearest map place or stop, for example "Near Alba", and gets a code in the same form as today's (2 to 4 capital letters). It is marked `fill: true` so the app can draw it smaller than a real stop.
- The output is a generated seed file, checked in. You and your partner review the list and can rename or move any stop by hand afterwards.
- Every route gets about twice as many stops (R1 13 to about 28, R5 16 to about 65). The driver list stays sorted by most waiting, so the longer list does not change what the driver reads first.

### SMS: only stops with someone waiting

- Today each update lists every stop of the route, zeros included. With the fill stops this would take 2 to 4 SMS per update (R5: 4).
- After the change, an update lists only the stops with someone waiting, plus a flag that says it is the whole route. The driver app knows the route's full stop list, so every stop not in the update is 0.
- Usually only a few stops have people, so an update stays one SMS. Only when more than about 20 stops of one route have people waiting at once does it take a second SMS.
- This is a new message format (v3). The worker and the driver app change together; the driver app still reads v2, so an old message in flight is not lost.

### "Did you board?"

- Today this looks for a multicab standing within 60 m of the stop (`CHECKIN_BOARD_NEAR_M`).
- A commuter can now stand up to 300 m from that stop, so the phone keeps the point where the commuter checked in. The point is stored only on the phone. Boarding is then looked for near that point instead of the stop.

### SMS worker

- **A minimum gap between sends on each route** (`SMS_DISPATCH_MIN_GAP_S`, 120 s):
  - A change, or a stop that gets its first person, waits until the gap has passed.
  - Changes during the gap are collected into the next message.
  - Without the gap, a commuter who checks in and out again and again could make the worker text a route every 30 s worker cycle, which costs free-gateway messages and looks like spam to the carrier.
- **A daily cap on each gateway SIM** (`SMS_GATEWAY_DAILY_CAP`):
  - Past 80% of the cap, a route is texted only on the 5-minute interval.
  - At the cap, nothing more is sent that day, and an ops alert is raised.
- The existing 1.5 s gap between two sends (`GATEWAY_SEND_GAP_MS`) stays.

### Server, optional

- `check_in_routes` refuses more than `checkin_hourly_max` (3) check-ins per account in a rolling hour.
- It is a brake on top of Energy for when Energy is switched off. It needs a migration and a `supabase db push`.

## 4. Steps

| Step | What | Files | Tests | Size |
| --- | --- | --- | --- | --- |
| CA2-0 | Fill stops: the script, the generated seed file, `fill` on `SeedStation`, smaller dots for fill stops. Stop codes stay unique and stable across reruns. | `scripts/`, `data/seed/`, `features/map/StopDots.tsx` | U: every line point within 300 m of a stop; codes unique and well formed; no two stops within 100 m. E | S |
| CA2-1 | SMS v3, only stops with someone waiting: the encoder, the driver app's reader (v2 still read), and the worker. | `shared/sms/`, `services/sms-worker/`, driver app reader | U: round trip; empty update clears all stops; v2 still accepted; R5 with 5 stops waiting is 1 SMS. PP with a driver phone | S |
| CA2a | Line-and-stop geofence: a pure `checkInAlongRoute` in `shared/checkin/geofence.ts` returns the counted stop and both distances, or the reason it refuses (`too_far_from_line`, `no_stop_near`, plus the existing GPS reasons). The Check-in tab uses it and shows "Counted at". The refusal dialog names the right limit. | `shared/checkin/geofence.ts`, `shared/config`, `app/(tabs)/checkin.tsx`, `strings/en.ts` | U: on the line near a stop, on the line far from any stop, off the line, mocked, stale, inaccurate, a tapped stop past 300 m. E, P | S |
| CA2b | Boarding near the check-in point: the local check-in record keeps the point (phone only), and `boarding.ts` measures the multicab against it. Old records without a point fall back to the stop. | `shared/checkin/localCheckin.ts`, `shared/checkin/boarding.ts`, `features/checkin/useBoardingEndsCheckIn.ts` | U: multicab at the point, at the stop 250 m away, old record. P | S |
| CA2c | SMS minimum gap and daily cap: `dispatchDecision` holds change and new-stop sends inside the gap; the worker counts each gateway's sends per Manila day and applies the cap. | `shared/sms/dispatch.ts`, `shared/config`, `services/sms-worker/src/cycle.ts` | U: change at 60 s held, sent at 120 s; two changes in the gap in one message; 80% and 100% of the cap; the day rolls over | S |
| CA2d | Optional server rate limit: `check_in_routes` refuses the fourth check-in in an hour; a new `app_config.checkin_hourly_max`. | new migration, `shared/config` | U migration text; L live test after `db push` | S |
| CA2e | Docs: the PRD check-in sections (7.5, 9.6), STATUS, and a short panel answer. | `docs/PRD.md`, `docs/STATUS.md` | none | S |

Order: CA2-0, CA2-1, then CA2a to CA2e. Each step is one commit after approval. CA2-0, CA2-1 and CA2c change what the SMS worker sends, so they go live only after the worker is deployed again. CA2a and CA2b need only a JS reload. CA2d needs a Supabase push.

## 5. Decisions

| # | Question | Suggested |
| --- | --- | --- |
| D1 | Farthest a commuter can be from a route line (`CHECKIN_LINE_M`) | 40 m |
| D2 | Farthest a commuter can be from the stop they are counted at (`CHECKIN_STOP_MAX_M`) | 300 m |
| D3 | Minimum gap between SMS sends on one route (`SMS_DISPATCH_MIN_GAP_S`) | 120 s |
| D4 | Messages one gateway SIM may send in a day (`SMS_GATEWAY_DAILY_CAP`) | Your gateway's or promo's real limit |
| D5 | Build the server rate limit (CA2d) now, or leave it for later | Later: Energy already brakes spam while it is on |
| D6 | Fill stops made by the script from map places, then reviewed by hand | Yes |
| D7 | SMS v3 (only stops with someone waiting) | Yes, before the fill stops reach drivers |

## 6. The risk that stays

Someone who lives right beside a route can check in from home. Energy, one active check-in and the trust signals keep the damage small: it adds 1 to one stop for at most 15 minutes. This is accepted, not solved, and is said so in the panel answer.

## 7. Panel answer

"Commuters can check in anywhere along the route, because multicabs stop anywhere. The phone checks that they are on the route with a real, fresh GPS fix, and each check-in costs Energy. We count each check-in at the nearest stop, so drivers keep one sorted list they can read at a glance, and the SMS stays one batched message per route."
