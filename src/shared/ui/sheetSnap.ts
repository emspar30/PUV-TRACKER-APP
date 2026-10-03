// Snap logic of the draggable bottom sheet: where its snap points are on a given screen, and which
// one a drag ends on. Pure functions. The ones marked 'worklet' also run on the UI thread during a
// drag; the directive is a plain string that changes nothing anywhere else.

import {
  SHEET_EXPANDED_FRACTION,
  SHEET_FLICK_VELOCITY_DP_S,
  SHEET_HALF_FRACTION,
  SHEET_PEEK_DP,
} from '../config';

export type SnapName = 'peek' | 'half' | 'expanded';

// From lowest to highest
export const SNAP_ORDER: readonly SnapName[] = ['peek', 'half', 'expanded'];

// Visible height of the sheet, in dp, at each snap point
export type SnapHeights = Readonly<Record<SnapName, number>>;

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

// The three heights for a container of the given height. `topReserved` is space the sheet must
// never cover, such as the status bar. On a very small container the points never cross:
// peek <= half <= expanded always holds.
export function sheetSnapHeights(containerHeight: number, topReserved = 0): SnapHeights {
  const room = Math.max(containerHeight - topReserved, 0);
  const expanded = Math.min(Math.round(containerHeight * SHEET_EXPANDED_FRACTION), room);
  const peek = Math.min(SHEET_PEEK_DP, expanded);
  const half = clamp(Math.round(containerHeight * SHEET_HALF_FRACTION), peek, expanded);
  return { peek, half, expanded };
}

// Space the sheet must leave free at the top of the screen: the status bar, then a row of floating
// controls (the avatar button that opens Settings) with a margin above and below it. Passed to
// sheetSnapHeights as topReserved, so those controls stay reachable at every snap point.
export function sheetTopClearance(statusBarDp: number, controlDp: number, marginDp: number): number {
  return statusBarDp + marginDp + controlDp + marginDp;
}

// Keeps a dragged height between the lowest and the highest snap point
export function clampSheetHeight(height: number, heights: SnapHeights): number {
  'worklet';
  return clamp(height, heights.peek, heights.expanded);
}

// The snap point a drag ends on. `velocityUp` is in dp per second, positive when moving up.
// A fast flick goes to the next point in its direction; otherwise the nearest point wins.
export function snapTarget(height: number, velocityUp: number, heights: SnapHeights): SnapName {
  'worklet';
  const current = clampSheetHeight(height, heights);

  if (Math.abs(velocityUp) >= SHEET_FLICK_VELOCITY_DP_S) {
    if (velocityUp > 0) {
      for (const name of SNAP_ORDER) if (heights[name] > current) return name;
      return 'expanded';
    }
    for (let i = SNAP_ORDER.length - 1; i >= 0; i -= 1) {
      const name = SNAP_ORDER[i];
      if (heights[name] < current) return name;
    }
    return 'peek';
  }

  let nearest: SnapName = 'peek';
  for (const name of SNAP_ORDER) {
    if (Math.abs(heights[name] - current) < Math.abs(heights[nearest] - current)) nearest = name;
  }
  return nearest;
}

const MS_PER_S = 1000;

// Speed of a drag at release, in dp per second, positive when moving up. The finger's speed at the
// moment it lifts can read 0 when it pauses just before lifting, so a quick drag also counts by its
// average speed: the distance travelled over the time it took.
export function releaseVelocity(reportedUp: number, travelledUpDp: number, durationMs: number): number {
  'worklet';
  const average = durationMs > 0 ? (travelledUpDp / durationMs) * MS_PER_S : 0;
  return Math.abs(reportedUp) >= Math.abs(average) ? reportedUp : average;
}

// The point the chevron button moves to: up through the points, then back to peek
export function nextSnap(current: SnapName): SnapName {
  const index = SNAP_ORDER.indexOf(current);
  return SNAP_ORDER[(index + 1) % SNAP_ORDER.length];
}

// One step up or down, for the accessibility actions "expand" and "collapse"
export function stepSnap(current: SnapName, direction: 'up' | 'down'): SnapName {
  const index = SNAP_ORDER.indexOf(current);
  const next = direction === 'up' ? index + 1 : index - 1;
  return SNAP_ORDER[clamp(next, 0, SNAP_ORDER.length - 1)];
}
