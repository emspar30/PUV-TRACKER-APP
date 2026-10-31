# Driver near sub-rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the driver app's stop list, show a fill stop as a sub-row under the real stop it sits by, only while someone is waiting there.

**Architecture:** A pure function `groupRows` in `src/shared/driver/heatmapView.ts` turns the flat rows (riding order) into groups. Each group is a real stop with the fill stops that have someone waiting. `HeatmapList` calls it and draws the groups. The map, the busiest-stop banner and the SMS side are unchanged.

**Tech Stack:** TypeScript, React Native (Expo SDK 57), Jest.

**Spec:** `docs/superpowers/specs/2026-10-31-driver-near-subrows-design.md`

## Global Constraints

- Android only. No iOS code, config or dependencies.
- Pure logic lives in `src/shared/` with no React, React Native or Expo imports. Lint enforces this.
- Every threshold lives in `src/shared/config/`. This plan adds none.
- The passenger is the "commuter", never "rider".
- No texts and no EAS build. Any phone check that sends texts is asked first.
- Commit with an explicit pathspec (`git commit -- <paths>`), and check `git diff --cached` first, because the owner stages their own edits.
- Run `npx expo lint`, `npx tsc --noEmit` and `npx jest` before calling a task done.

## Review Focus

1. **The busiest-stop banner names a fill stop.** That fill stop must also appear as a sub-row, so the banner never names a stop the list hides. Task 1: every row with band > 0 appears in the groups exactly once.
2. **Two real stops at the same distance from a fill stop.** The earlier stop in riding order wins. Task 1, tie test.
3. **A night list (bands only, exact count null).** A fill stop with band > 0 is shown. Task 1, night test.
4. **A long fill-stop name, such as "Near Congresswoman Elisa Rosales Ochoa Subdivision".** It wraps to at most 2 lines and does not push the chip off the row. Task 2, checked on screen.
5. **A stale list.** Sub-rows keep their last counts and grey with the rest, never vanish because the list is stale. Task 1: `groupRows` does not depend on freshness. Task 2: the whole list keeps its opacity.

---

### Task 1: `groupRows` and a generic `heatmapView`

**Files:**
- Modify: `src/shared/driver/heatmapView.ts`
- Test: `src/shared/__tests__/heatmapGroups.test.ts` (new)

**Interfaces:**
- Consumes:
  - `isFillStopCode(code: string): boolean` from `src/shared/routing/fillStops.ts`;
  - `haversineMeters(a: LatLon, b: LatLon): number` and `LatLon` from `src/shared/geo/haversine.ts`.
- Produces:
  - `heatmapView<S extends HeatmapStop>(state: HeatmapState | null, stops: readonly S[], nowMs: number): HeatmapView<S>`, where `HeatmapView<S>['rows']` is `(S & { display: StopDisplay })[]`. The default `S = HeatmapStop` keeps existing callers and tests compiling.
  - `export type HeatmapGroup<R extends HeatmapRow = HeatmapRow> = { stop: R; near: R[] }`.
  - `export function groupRows<R extends HeatmapRow & LatLon>(rows: readonly R[]): HeatmapGroup<R>[]`.

- [ ] **Step 1: Write the failing tests** in `src/shared/__tests__/heatmapGroups.test.ts`.

Build rows with a helper `row(code, lat, lon, display)`. Real codes have three letters and fill codes are F plus three letters. Use `{ kind: 'known', band: 1, exact: 2 }` for "waiting", `{ kind: 'known', band: 0, exact: 0 }` for 0, and `{ kind: 'unknown' }`. Tests:

- `puts a fill stop under the nearer of the real stops it lies between`: stops `AAA`, then `FXXX`, then `BBB`, with `FXXX` nearer `BBB`. Expect `[{stop: AAA, near: []}, {stop: BBB, near: [FXXX]}]`.
- `gives a tie to the earlier stop`: `FXXX` is equidistant from `AAA` and `BBB`. Expect it under `AAA`.
- `puts fill stops before the first real stop under it, and after the last under the last`.
- `leaves out a fill stop at 0 or with no count yet`.
- `keeps a fill stop with a band above 0 and no exact count (night)`: display `{ kind: 'known', band: 2, exact: null }`.
- `keeps every real stop, in riding order, whatever its count`.
- `lists every row with someone waiting exactly once`: for a mixed list, the codes of all groups' `stop` and `near` with band > 0 equal the input rows with band > 0.
- `returns fill stops as plain rows when the route has no real stop`: every fill stop is a `stop` with `near: []`, waiting or not.
- `groups R4's Near Akiammer Laundry Service under Baan Viaduct or FSUU, never Palawan Pawnshop`:
  - build R4's stops with `inRouteOrder` (`src/shared/relay/broadcast.ts`), `SEED_LINES` and `SEED_STATIONS` (`src/data/seed/routes.ts`);
  - give every row display `{ kind: 'known', band: 1, exact: 1 }`;
  - find the group whose `near` holds `FPML`, and expect its `stop.code` to be `BAA` or `FSU`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/shared/__tests__/heatmapGroups.test.ts`
Expected: FAIL, `groupRows` is not exported.

- [ ] **Step 3: Implement `groupRows` and make `heatmapView` generic** in `src/shared/driver/heatmapView.ts`.

  - "Someone waiting" means `display.kind === 'known' && display.band > 0`.
  - With no real stop in `rows`, return every row as `{ stop, near: [] }`.
  - Otherwise, for each fill row, find the previous and next real rows in `rows`. A missing one counts as farther, and a tie goes to the previous one. If the fill row has someone waiting, push it onto that real row's `near`, keeping riding order.
  - Add a short comment above `groupRows` citing the owner, 2026-10-31, and the spec path, matching the file's comment style.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/shared/__tests__/heatmapGroups.test.ts src/shared/__tests__/driverInbox.test.ts src/shared/__tests__/busiestStop.test.ts`
Expected: PASS.

Then run `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/driver/heatmapView.ts src/shared/__tests__/heatmapGroups.test.ts
git commit -m "Driver list: groupRows puts fill stops with someone waiting under the real stop they sit by (spec 2026-10-31)" -- src/shared/driver/heatmapView.ts src/shared/__tests__/heatmapGroups.test.ts
```

### Task 2: Draw the sub-rows in `HeatmapList`, and record the change

**Files:**
- Modify: `src/driver/features/heatmap/HeatmapList.tsx`
- Modify: `src/strings/en.ts`, in `driver.heatmap` next to `unknownLabel`
- Modify: `docs/PRD.md`: section 9.4, and a numbered entry in the changes list after change 25
- Modify: `docs/STATUS.md`: one DR row or a dated note

**Interfaces:**
- Consumes: `groupRows` and `HeatmapGroup` from Task 1. `HeatmapList`'s `rows` prop becomes `readonly (HeatmapRow & LatLon)[]`. `src/driver/app/index.tsx` already passes `view.rows` built from `route.stops` (`RouteStop`, which has `lat` and `lon`), so it needs no change once `heatmapView` is generic.
- Produces: `strings.driver.heatmap.nearLabel: (name: string, parent: string, value: string) => string`, returning `` `${name}, near ${parent}: ${value}` ``.

- [ ] **Step 1: Add `nearLabel`** to `src/strings/en.ts` with the exact copy above.

- [ ] **Step 2: Render the groups.** `HeatmapList` maps `groupRows(rows)`:
  - **Each group's `stop`:** the current row, unchanged, numbered by its group index with `ordinal`.
  - **Each group's `near`:** a sub-row under it with:
    - no index, indented by `INDEX_WIDTH + spacing.sm + spacing.xs`, so the name lines up with the parent's name;
    - `typography.bodyLg` for the name, `numberOfLines={2}`;
    - the count in a smaller style (font size 20, line height 26, same weight and tabular digits);
    - the same chip rules as the parent: `noChip` at 0, `bigChip` when exact is null;
    - `minHeight: MIN_TOUCH_TARGET`;
    - `accessibilityLabel` from `nearLabel(row.name, group.stop.name, <the same value string the parent row uses>)`.

  Pull the chip-and-count part into a local `StopValue` component used by both rows, so the band and colour rules exist once. Keep the whole-list stale opacity as it is. Update the header comment with one line saying fill stops show as sub-rows only while someone waits (owner, 2026-10-31).

- [ ] **Step 3: Verify**

Run: `npx expo lint`, `npx tsc --noEmit` and `npx jest`.
Expected: lint and tsc clean, and every suite passes.

- [ ] **Step 4: Check on the Vivo**, with the owner's go-ahead because it uses texts.
  - Start `npm run start:driver` and reload the driver app (DRV-0021, R4).
  - With the Xiaomi, check in once at an R4 fill stop, then check out.
  - Expected:
    - the sub-row appears under its real stop after the next text;
    - it disappears after the clear text, which comes at least 120 s after the first;
    - real stops stay numbered 01 to 18;
    - a long name wraps without pushing the chip off.
  - Cost: 2 texts.

- [ ] **Step 5: Record the change**
  - **PRD 9.4:** one sentence saying fill stops show under the real stop they sit by, only while someone waits, by the nearer neighbouring real stop in riding order.
  - **PRD changes list:** a new numbered entry (owner, 2026-10-31).
  - **STATUS.md:** a line marking it built, unit-verified, with the phone check pending or done.

- [ ] **Step 6: Commit**

```bash
git add src/driver/features/heatmap/HeatmapList.tsx src/strings/en.ts docs/PRD.md docs/STATUS.md
git commit -m "Driver list: fill stops with someone waiting as sub-rows under their real stop (owner, 2026-10-31)" -- src/driver/features/heatmap/HeatmapList.tsx src/strings/en.ts docs/PRD.md docs/STATUS.md
```
