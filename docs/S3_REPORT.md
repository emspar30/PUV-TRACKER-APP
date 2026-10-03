# S3 report: local route data, offline routing and fare

Date: 2026-10-03. Covers S3 from `docs/IMPLEMENTATION_PLAN_v2.md`. S4 has not been started.

## Status

| Part | Status |
| --- | --- |
| Code | Written |
| Automated checks | Pass |
| Phone tests `S3-M1` to `S3-M4` | **Not run yet** |
| S2 phone tests still open | `S2-M3`, `S2-M4`, `S2-M5` (S3 was started on the owner's instruction) |

## Commands run and results

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Exit 0 |
| `npx expo lint` | Exit 0, no errors or warnings |
| `npx jest` | 12 suites, 139 tests, all passed (was 8 suites, 109 tests) |
| `npx expo export --platform android` (to a scratch folder) | Bundle built |
| Routing benchmark (Node) | 1,000 trips, p50 0.39 ms, p95 0.76 ms, max 3.7 ms on an Intel Core i5-1334U, 16 GB RAM, Node 22.14. The budget is 250 ms at p95. This is a PC figure; the phone figure comes from `S3-M3`. |

## Decisions taken from the PRD

The three open questions the plan listed for S3 were already settled in the PRD's "Changes after audit":

- **Two directions:** `franchise_routes` has `route_code` and `direction`; Route 4 is two rows, `R4-OUT` and `R4-RET` (PRD 12.1).
- **Boarding rule:** riders board and alight anywhere on the line; origin and destination are snapped to the line, each within 500 m (PRD 7.2).
- **DEO is a stop:** it is the sixth placeholder station (PRD 12.5).

## How it works

1. On launch, `SQLiteProvider` runs `migrateDb` before any screen renders. It creates the five PRD 12.1 tables once (tracked with `PRAGMA user_version`), then loads the seed if its `ROUTE_DATA_VERSION` is newer than the stored one. The reload deletes and reinserts all route rows inside one transaction.
2. Each stop's `seq` and `chainage_km` are computed from the polyline, not typed in.
3. `loadRouteNetwork` reads the rows and parses each polyline once.
4. `planTrip` snaps origin and destination to each directed line, rejects a line if either walk is over 500 m or the destination is not ahead, and picks the shortest ride, then the shortest walk. The fare uses the ride slice only.
5. The fare type is stored with `expo-sqlite/kv-store`, on the phone only.

## Acceptance criteria

| Criterion | Test | Result |
| --- | --- | --- |
| Routing plus fare in 250 ms or less at p95 | `routing benchmark p95` | Pass (Node, 0.76 ms) |
| Same, on a device | `S3-M3 on-device benchmark` | Not run |
| Destination behind the origin is rejected | `routing direction check` | Pass |
| Direction check uses both lines | `picks the return line when the destination is behind on the outbound line` | Pass |
| Walking limit | `routing walking limit` (600 m rejected, 400 m accepted) | Pass |
| No transfers | `routing returns exactly walk, ride, walk` | Pass |
| Fare uses the route slice | `fare uses ride distance not walk distance` | Pass |
| Discount for Student, Senior Citizen, PWD only | `discount applies to Student, Senior Citizen, PWD only` | Pass |
| Works in airplane mode | `S3-M1 offline plan` | Not run |
| Classification stays on the device | `no cloud payload contains classification` | Pass. The packet-validator half of this test arrives with the validator in S4. |
| Route data comes from the database | `seed maps to rows`, `migration on real SQLite` | Pass |
| Version bump reseeds | `newer route_data_version replaces rows` | Pass, including a failed reseed leaving the old rows in place |

The migration and repository tests run the real SQL against Node's built-in SQLite, through a small adapter with the same method names as `expo-sqlite`. The on-phone database is not exercised by automated tests; `S3-M1` covers it.

## Files created or changed

| Path | Change |
| --- | --- |
| `src/data/db/schema.ts` | New: PRD 12.1 tables as data |
| `src/data/db/seedRows.ts` | New: seed file to rows; computes stop order and chainage |
| `src/data/db/migrate.ts` | New: create tables, reseed on a newer version |
| `src/data/db/routeRepository.ts` | New: typed reads, polyline parsed once |
| `src/data/db/__tests__/nodeSqlite.ts`, `seed.test.ts` | New: real-SQLite tests |
| `src/shared/routing/plan.ts` | New: the planner |
| `src/shared/routing/benchmark.ts` | New: shared by the Node benchmark and the in-app button |
| `src/shared/__tests__/routing.test.ts`, `routing.bench.test.ts`, `privacy.test.ts` | New tests |
| `src/shared/config/index.ts` | Added `ROUTING_BENCHMARK_PAIRS` (1000) and `ROUTING_BENCHMARK_SPREAD_M` (400) |
| `src/state/profileStore.ts` | New: fare type, on-device storage |
| `src/features/plan/` | New: `ChoiceChips`, `ItineraryCard`, `FareCard`, `format`, `useRouteNetwork` |
| `src/features/profile/ClassificationPicker.tsx` | New |
| `src/app/_layout.tsx` | Database provider around the app |
| `src/app/(tabs)/plan.tsx`, `profile.tsx` | Plan and Profile screens |
| `src/strings/index.ts` | Plan, Profile and fare-type text |
| `jest.config.js` | `src/data` tests run in the plain Node project |
| `docs/device-tests.md` | S3 scripts for the phone |

## Differences from the plan

1. **Destinations are the stops.** The plan left the destination picker open. Both From and To offer the stop list; From also offers "My location" (or "Map pin" when location is off). Picking an arbitrary point on a map is not built.
2. **`seq` and `chainage_km` via a pure `seedRows.ts`**, so the mapping is tested without a phone.
3. **Real-SQLite tests in Node** instead of tests that would need a phone.
4. **`privacy.test.ts` checks code only.** The packet validator it also names does not exist until S4.
5. **Route lines drawn on the Map tab** (added after the first phone tests). PRD 7.2 "Display" asks for it; the S3 plan did not include it. It was added so the placeholder line can be compared with the real road.

## Open items for your review

1. Run `S3-M1` to `S3-M4` (and the open S2 scripts) and report the results.
2. **"My location" gave no trip beside the real road (2026-10-03).** Likely cause: the placeholder line joins the stops with straight segments, so between M. Calo and De Oro it is one straight 11 km line that does not follow the road, and a rider on the road can be more than 500 m from it. To make this visible, the Map tab now draws the route lines, and a refused trip now says how far the start or destination is from the line. Real polylines fix the cause.
3. Destination by tapping the map would make the Plan tab useful away from the stops. Say if you want it before S4.

## Addendum, 2026-10-03: route data version 2, light theme, Plan layout

Made after the first S3 phone tests, at the owner's request.

**Route lines follow the streets.** The PRD has no real Route 4 path, only its street list, and says to trace a ride. The owner chose a placeholder traced from OpenStreetMap until a ride is recorded. One waypoint was placed on each street of the PRD's list, in order, and the OSRM router joined them along the roads: outbound 18.4 km, return 16.8 km. Method, waypoints and open points are in `docs/route-trace.md`. `ROUTE_DATA_VERSION` is now 2, so phones reload the data on next launch.

- **Stops:** a stop is now linked to a line only when it is within 200 m of it (`STATION_LINK_MAX_OFFSET_M`, a new config value). The return path leaves JAQNO at R. Calo, so IMA and TSO are outbound only.
- **Consequence:** a trip such as M. Calo to Tandang Sora now has no answer, because it would need a ride to the terminal and a second ride, and v0 plans no transfers.
- **Routing time:** the lines grew from 6 to about 460 points each. On the PC the benchmark p95 went from 0.8 ms to 29 ms, still within the 250 ms budget. A faster projection than Turf's would help as more routes are added.
- **Route lines not showing:** the owner reported the Map tab showed no route lines. The cause is not confirmed. The lines were drawn with a per-feature color expression; they now use one layer per line with fixed colors, a dark outline for contrast on the light map, and placement just above the base map so markers stay on top.

**Light theme.** `src/theme` now holds a light palette (text colors chosen for WCAG AA contrast), and the offline map style is light with outlined roads. The status bar is dark-on-light. `app.json` now says `userInterfaceStyle: "light"` with a light background; those two only take effect in the next native build, so the splash screen and system bars stay dark until then.

**Plan tab.** The map is now at the top (38% of the screen height), with the From and To choices below it, then the fare estimate and the trip steps. The map frames each new trip and shows the ride slice, dashed walking legs, start and end markers and the blue dot. The other direction fades to 8% (PRD 7.2 "Display").

**Checks:** typecheck and lint clean; 12 suites, 143 tests pass; the Android bundle builds. The phone scripts in `docs/device-tests.md` were rewritten for version 2, including a new `S3-M0` for the lines and the layout.

## Addendum 2, 2026-10-03: direction on route lines, new From and To

At the owner's request.

**Direction of travel on the lines.** Each direction is drawn 4 px to the right of its direction of travel, so where outbound and return share a road they sit side by side instead of hiding each other. The return line is dashed and the outbound line solid. White chevrons placed along each line every 70 px point the way it runs. A legend (`RouteLegend`) explains the two on both maps. The chevron is a small PNG in `assets/map/` (`route-arrow.png`, with 2x and 3x versions), drawn as an icon-only symbol, so no font files are needed offline. Not yet seen on a phone: in particular the arrow side shift (`icon-offset`) is expected to match the line shift, and needs checking.

**From and To.** The chip lists are replaced by:

- a trip card with a From field and a To field joined by a rail (green start, red pin), and a swap button
- a bottom sheet for each field. For From, the sheet first asks "Current location" or "A specific place", so the phone's position and a chosen place are never confused. The trip card shows the phone's position in blue as "Your location" with its GPS accuracy, or "Pin from the Map tab" when location is off.
- under "A specific place": a search box, the stop list (short name, area, and which directions serve the stop), and "Pick a point on the map", which lets the rider tap any point on the Plan map as the start or the destination

New files: `src/features/plan/TripCard.tsx`, `PlacePicker.tsx`, `places.ts` and its test, `src/features/map/RouteLegend.tsx`. `OfflineMap` gained an `onPress` prop. `ChoiceChips` is now used only by the fare-type picker in Profile.

**Checks:** typecheck and lint clean; 13 suites, 147 tests pass; the Android bundle builds. New phone script `S3-M5`; `S3-M0` covers the direction display.
