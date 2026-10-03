import { SHEET_EXPANDED_FRACTION, SHEET_FLICK_VELOCITY_DP_S, SHEET_HALF_FRACTION, SHEET_PEEK_DP } from '../config';
import {
  SNAP_ORDER,
  clampSheetHeight,
  nextSnap,
  releaseVelocity,
  sheetSnapHeights,
  sheetTopClearance,
  snapTarget,
  stepSnap,
  type SnapHeights,
} from '../ui/sheetSnap';

// A fixed screen: 800 dp tall, nothing reserved at the top
const HEIGHTS: SnapHeights = { peek: 72, half: 320, expanded: 720 };
const SLOW = SHEET_FLICK_VELOCITY_DP_S - 1;
const FAST = SHEET_FLICK_VELOCITY_DP_S;

describe('snap heights', () => {
  it('follow docs/DESIGN.md: peek 72 dp, half 40%, expanded 90%', () => {
    expect(SHEET_PEEK_DP).toBe(72);
    expect(SHEET_HALF_FRACTION).toBe(0.4);
    expect(SHEET_EXPANDED_FRACTION).toBe(0.9);
    expect(sheetSnapHeights(800)).toEqual(HEIGHTS);
  });

  it.each([
    // A small phone, the Pixel 7 emulator's tab screen, a tall phone, a tablet in portrait
    [560, { peek: 72, half: 224, expanded: 504 }],
    [752, { peek: 72, half: 301, expanded: 677 }],
    [900, { peek: 72, half: 360, expanded: 810 }],
    [1280, { peek: 72, half: 512, expanded: 1152 }],
  ])('for a %i dp screen', (height, expected) => {
    expect(sheetSnapHeights(height)).toEqual(expected);
  });

  it('never covers the reserved top area', () => {
    // 800 dp with 120 dp reserved: 90% would be 720, but only 680 is free
    expect(sheetSnapHeights(800, 120).expanded).toBe(680);
  });

  it('keeps the points in order on a tiny screen', () => {
    for (const height of [0, 40, 72, 100, 150]) {
      const { peek, half, expanded } = sheetSnapHeights(height);
      expect(peek).toBeLessThanOrEqual(half);
      expect(half).toBeLessThanOrEqual(expanded);
      expect(expanded).toBeLessThanOrEqual(height);
    }
  });
});

describe('dragging bounds', () => {
  it('a drag cannot go below peek or above expanded', () => {
    expect(clampSheetHeight(0, HEIGHTS)).toBe(72);
    expect(clampSheetHeight(-50, HEIGHTS)).toBe(72);
    expect(clampSheetHeight(900, HEIGHTS)).toBe(720);
    expect(clampSheetHeight(400, HEIGHTS)).toBe(400);
  });
});

describe('where a slow release ends: the nearest point', () => {
  it.each([
    [72, 'peek'],
    [195, 'peek'],
    [197, 'half'],
    [320, 'half'],
    [519, 'half'],
    [521, 'expanded'],
    [720, 'expanded'],
    // Beyond the ends counts as the end
    [10, 'peek'],
    [2000, 'expanded'],
  ] as const)('released at %i dp ends at %s', (height, expected) => {
    expect(snapTarget(height, 0, HEIGHTS)).toBe(expected);
    expect(snapTarget(height, SLOW, HEIGHTS)).toBe(expected);
    expect(snapTarget(height, -SLOW, HEIGHTS)).toBe(expected);
  });
});

describe('where a flick ends: the next point in its direction', () => {
  it('a fast upward flick goes to the next point above, even from just above a point', () => {
    expect(snapTarget(80, FAST, HEIGHTS)).toBe('half');
    expect(snapTarget(72, FAST, HEIGHTS)).toBe('half');
    expect(snapTarget(330, FAST, HEIGHTS)).toBe('expanded');
    expect(snapTarget(320, FAST, HEIGHTS)).toBe('expanded');
  });

  it('a fast downward flick goes to the next point below', () => {
    expect(snapTarget(700, -FAST, HEIGHTS)).toBe('half');
    expect(snapTarget(720, -FAST, HEIGHTS)).toBe('half');
    expect(snapTarget(300, -FAST, HEIGHTS)).toBe('peek');
    expect(snapTarget(320, -FAST, HEIGHTS)).toBe('peek');
  });

  it('a flick past the end stays at the end', () => {
    expect(snapTarget(720, FAST, HEIGHTS)).toBe('expanded');
    expect(snapTarget(72, -FAST, HEIGHTS)).toBe('peek');
  });

  it('a flick just under the threshold counts as slow', () => {
    // From 80 dp, nearest is peek; a slow push up does not reach half
    expect(snapTarget(80, SLOW, HEIGHTS)).toBe('peek');
  });
});

describe('release speed', () => {
  it('uses the finger speed at release when it is the larger', () => {
    expect(releaseVelocity(1333, 100, 1000)).toBe(1333);
    expect(releaseVelocity(-1349, -50, 1000)).toBe(-1349);
  });

  it('falls back to the average speed when the finger paused before lifting', () => {
    // 133 dp up in 100 ms is 1330 dp/s on average, a flick, even though the last reading was 0
    expect(releaseVelocity(0, 133, 100)).toBeCloseTo(1330, 6);
    expect(snapTarget(320 + 133, releaseVelocity(0, 133, 100), HEIGHTS)).toBe('expanded');
    expect(releaseVelocity(0, -135, 100)).toBeCloseTo(-1350, 6);
  });

  it('a slow drag stays slow, so it ends at the nearest point', () => {
    // 283 dp in 1.5 s is about 189 dp/s
    const speed = releaseVelocity(0, 283, 1500);
    expect(Math.abs(speed)).toBeLessThan(SHEET_FLICK_VELOCITY_DP_S);
    expect(snapTarget(72 + 283, speed, HEIGHTS)).toBe('half');
  });

  it('a zero-length or zero-time drag has no speed', () => {
    expect(releaseVelocity(0, 0, 0)).toBe(0);
    expect(releaseVelocity(0, 50, 0)).toBe(0);
  });
});

describe('the chevron and the accessibility actions', () => {
  it('the chevron cycles peek, half, expanded, then back to peek', () => {
    expect(nextSnap('peek')).toBe('half');
    expect(nextSnap('half')).toBe('expanded');
    expect(nextSnap('expanded')).toBe('peek');
  });

  it('expand and collapse move one step and stop at the ends', () => {
    expect(stepSnap('peek', 'up')).toBe('half');
    expect(stepSnap('half', 'up')).toBe('expanded');
    expect(stepSnap('expanded', 'up')).toBe('expanded');
    expect(stepSnap('expanded', 'down')).toBe('half');
    expect(stepSnap('peek', 'down')).toBe('peek');
  });

  it('lists the points from lowest to highest', () => {
    expect(SNAP_ORDER).toEqual(['peek', 'half', 'expanded']);
  });
});

describe('the avatar button stays reachable', () => {
  // Pixel 7 emulator: tab screen 841 dp, status bar 24 dp, 48 dp avatar button 8 dp below it
  const STATUS_BAR = 24;
  const BUTTON = 48;
  const MARGIN = 8;
  const SCREEN = 841;

  it('the expanded sheet stops below the avatar button, with a margin', () => {
    const heights = sheetSnapHeights(SCREEN, sheetTopClearance(STATUS_BAR, BUTTON, MARGIN));
    const sheetTop = SCREEN - heights.expanded;
    const buttonBottom = STATUS_BAR + MARGIN + BUTTON;
    expect(sheetTop).toBeGreaterThanOrEqual(buttonBottom + MARGIN);
  });

  it.each([560, 640, 752, 900, 1280])('holds at every snap point on a %i dp screen', (screen) => {
    const heights = sheetSnapHeights(screen, sheetTopClearance(STATUS_BAR, BUTTON, MARGIN));
    for (const name of SNAP_ORDER) {
      expect(screen - heights[name]).toBeGreaterThanOrEqual(STATUS_BAR + MARGIN + BUTTON + MARGIN);
    }
  });
});
