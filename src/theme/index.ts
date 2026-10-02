import type { TextStyle } from 'react-native';

export const colors = {
  canvas: '#0B0F17',
  surface: '#161F30',
  cyan: '#00F5D4',
  amber: '#FFB703',
  crimson: '#EF233C',
  emerald: '#10B981',
  textPrimary: '#FFFFFF',
  textMuted: '#94A3B8',
} as const;

// 8pt mathematical spatial grid
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
} as const;

// PRD 8.4: all touch targets must be at least 48x48 dp
export const MIN_TOUCH_TARGET = 48;

export const typography = {
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400', color: colors.textPrimary },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400', color: colors.textMuted },
} as const satisfies Record<string, TextStyle>;

export type Spacing = keyof typeof spacing;

// How route lines and stops are drawn on the map. Widths and radii are [zoom, size in dp] stops.
export const mapRoute = {
  // Dark outline under every line and dot, for contrast against the dark base map
  casingColor: colors.canvas,
  casingExtraWidth: spacing.xs,
  lineWidthStops: [
    [10, 3],
    [14, 6],
    [18, 12],
  ],
  // The return direction is drawn as a lighter band with dashes, so it reads as different from the outbound line
  returnBandOpacity: 0.45,
  returnDashColor: colors.textPrimary,
  returnDashWidthRatio: 0.4,
  returnDashPattern: [2, 2],
  // Direction arrows are small V shapes drawn as lines. Each band is used inside its zoom range,
  // so the arrows stay a readable size on screen.
  arrowWingAngleDeg: 30,
  // Where the first arrow sits, as a fraction of the spacing. The two directions differ,
  // so their arrows do not stack where they share a street.
  arrowStartFraction: { outbound: 0.25, return: 0.75 },
  arrowWidthStops: [
    [10, 1.5],
    [18, 3],
  ],
  arrowBands: [
    { minZoom: 0, maxZoom: 13, sizeM: 260, spacingM: 2400 },
    { minZoom: 13, maxZoom: 15.5, sizeM: 60, spacingM: 600 },
    { minZoom: 15.5, maxZoom: 24, sizeM: 14, spacingM: 140 },
  ],
  stopColor: colors.textPrimary,
  stopSelectedColor: colors.amber,
  stopRadiusStops: [
    [10, 3],
    [14, 6],
    [18, 10],
  ],
  stopSelectedScale: 1.6,
  stopStrokeWidth: 2,
} as const;
