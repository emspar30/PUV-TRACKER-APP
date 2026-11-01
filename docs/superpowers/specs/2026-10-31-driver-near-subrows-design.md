# Driver app: in-between stops as sub-rows

> **Superseded 2026-11-01.** The partner's CA3 (`b7e6fa0`) removed the fill stops this builds on, and the driver list shows "– Near N" under a stop instead. The code was removed in the merge; this file is kept as a record.

Owner's request, 2026-10-30 and 2026-10-31. Driver app only. No texts, no EAS build of its own: it ships in the held release batch.

## Why

The partner's check in anywhere (CA2-0, merged in `4cd530c`) added 66 fill stops: stops on long stretches of route line, named after the nearest landmark ("Near Petron") with four-letter codes starting with F (`isFillStopCode`). The driver app's list (`HeatmapList`) now shows them as ordinary rows in riding order, so R4's list grew from 18 rows to 43.

The owner wants the real stops to stay the list, with a fill stop shown under a real stop when someone is waiting there.

## What the driver sees

- The list shows the real stops in riding order, numbered 01, 02, … as today. On R4 that is 18 rows.
- A fill stop appears as a **sub-row** under its real stop **only while someone is waiting there**. That means its count, or its band where only bands are shown, is above 0.
  - A fill stop at 0, or with no count yet, is not listed.
  - When everyone leaves, the sub-row goes away with the next update.
- A sub-row is indented, has no number, and uses smaller type than a real stop's row. It shows its own count and band chip, drawn the same way as a real stop's.
- A real stop's count is its own. It is not a total with its sub-rows.
- A stale list is greyed as a whole, as today. Sub-rows still show their last known counts, greyed with the rest, as real stops do.
- Accessibility: a sub-row reads "Near Petron, near LTFRB: 1 waiting".

The map, the busiest-stop banner and the legend do not change. The map already draws every stop, and the banner may name a fill stop.

## Which real stop a fill stop sits under

Each fill stop goes under the **nearer of the two real stops it lies between in riding order**, by straight-line distance. A tie goes to the earlier stop.

- Fill stops before the route's first real stop go under the first real stop.
- Fill stops after the last real stop go under the last real stop.

Straight-line closest over the whole route is not used, because it breaks riding order. On R4, "Near Akiammer Laundry Service" lies between Baan Viaduct and FSUU, but the closest real stop to it is Palawan Pawnshop, the last stop on the list, where the route loops back.

Fill stops sit only where the line is more than 300 m from a real stop, so stops on short stretches, such as SM City Butuan on R4, never get sub-rows.

## Code

- `src/shared/driver/heatmapView.ts`, pure, no React:
  - `heatmapView` becomes generic over the stop type, so its rows keep the route stops' `lat` and `lon`. `HeatmapStop` itself stays `{ code, name }`, so callers without positions keep working.
  - New `groupRows(rows): HeatmapGroup[]`. A `HeatmapGroup` is `{ stop: HeatmapRow; near: HeatmapRow[] }`, where `near` holds the fill stops with someone waiting, in riding order. It applies the grouping rule above, and the "someone waiting" filter.
  - A route with no real stops (not expected) shows its fill stops as plain rows, so nothing disappears.
- `src/driver/features/heatmap/HeatmapList.tsx` draws the groups. The parent row is unchanged. Sub-rows use a new indented, smaller row style.
- `src/strings/en.ts` gets the sub-row's accessibility label.
- The busiest-stop banner (`busiestStop`) and the map (`HeatmapMap`) keep using the flat rows.

## Tests

`src/shared/__tests__/` gains these cases for `groupRows`:

- The nearer neighbour wins, and a tie goes to the earlier stop.
- Fill stops before the first real stop and after the last real stop are grouped correctly.
- A fill stop at 0, or with no count yet, is left out.
- A fill stop with a band above 0 and no exact count (night) is kept.
- Real stops keep riding order and every real stop is listed.
- The R4 seed data: the Akiammer Laundry fill stop groups under Baan Viaduct or FSUU, never Palawan Pawnshop.
- No real stops: the fill stops come back as plain rows.

Lint, typecheck and the unit suite pass. A look on the Vivo with the dev build uses 1 to 2 texts, at a fill stop, spaced out.

## Out of scope

- The commuter app.
- The SMS worker and its dispatch rules. The 120 s gap stays (owner, 2026-10-31).
- Renaming fill stops.
