import type { TextStyle, ViewStyle } from 'react-native';

import {
  BASE_MAPS,
  MAP_PAINTS,
  PALETTES,
  ROUTE_BADGE_TEXT,
  routeColor,
  type BaseMapPalette,
  type MapPaint,
  type Palette,
  type ThemeScheme,
} from './tokens';

export type { BaseMapPalette, MapPaint, Palette, ThemeScheme } from './tokens';

// 8pt spatial grid, with 4pt steps for badges and inline indicators (docs/DESIGN.md)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export type Spacing = keyof typeof spacing;

// Shape tiers from docs/DESIGN.md: line badges, medium containers, cards, the sheet top, pills
export const radii = {
  badge: 4,
  sm: 8,
  md: 12,
  lg: 24,
  sheet: 28,
  pill: 999,
} as const;

// PRD 13 and docs/DESIGN.md: every touch target is at least 48 x 48 dp
export const MIN_TOUCH_TARGET = 48;

// Motion. The sheet settles with a spring, so a flick feels physical.
export const motion = {
  sheetSpring: { damping: 24, stiffness: 240, mass: 0.9 },
  // A drag must move this far before the sheet follows it, so taps inside the sheet still work
  dragSlopDp: 8,
} as const;

// Type scale of docs/DESIGN.md, in dp, set in the Android system font (Roboto)
const SCALE = {
  headlineLg: { fontSize: 26, lineHeight: 32, fontWeight: '600', letterSpacing: -0.3 },
  headlineMd: { fontSize: 22, lineHeight: 28, fontWeight: '500' },
  headlineSm: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  bodySm: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  labelLg: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  labelMd: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
  labelSm: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.5 },
  // A big number, such as the fare
  display: { fontSize: 40, lineHeight: 48, fontWeight: '600', fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyle>;

function buildTypography(colors: Palette) {
  const primary = (style: TextStyle): TextStyle => ({ ...style, color: colors.textPrimary });
  const secondary = (style: TextStyle): TextStyle => ({ ...style, color: colors.textSecondary });
  return {
    headlineLg: primary(SCALE.headlineLg),
    headlineMd: primary(SCALE.headlineMd),
    headlineSm: primary(SCALE.headlineSm),
    bodyLg: primary(SCALE.bodyLg),
    bodyMd: primary(SCALE.bodyMd),
    bodySm: secondary(SCALE.bodySm),
    labelLg: primary(SCALE.labelLg),
    labelMd: primary(SCALE.labelMd),
    labelSm: secondary(SCALE.labelSm),
    display: primary(SCALE.display),
    // Names used before UX2, kept so older screens read the same
    title: primary(SCALE.headlineLg),
    body: primary(SCALE.bodyLg),
    caption: secondary(SCALE.bodySm),
  } satisfies Record<string, TextStyle>;
}

export type Typography = ReturnType<typeof buildTypography>;

// Shapes of the map content. Widths and radii are [zoom, size in dp] stops. Colours come from the theme.
export const MAP_GEOMETRY = {
  casingExtraWidth: spacing.xs,
  lineWidthStops: [
    [10, 3],
    [14, 6],
    [18, 12],
  ],
  // The return direction is a lighter band with dashes, so it reads as different from the outbound line
  returnBandOpacity: 0.45,
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
  stopRadiusStops: [
    [10, 3],
    [14, 6],
    [18, 10],
  ],
  stopSelectedScale: 1.6,
  stopStrokeWidth: 2,
  tripRideWidthScale: 1.2,
  tripWalkWidth: 2,
  tripWalkDashPattern: [1, 2],
  tripPointRadius: 9,
  tripSnapRadius: 4,
  // Camera moves made by the app (fit to a trip, show the whole route)
  cameraAnimationMs: 600,
  // A fitted area is never smaller than this, so two nearby points do not zoom the map in too far
  minFocusSpanDeg: 0.004,
  // Vehicle markers (AF3): sizes on screen, in dp
  vehicle: {
    radius: 7,
    ringWidth: 3,
    stoppedRadius: 2.5,
    coneLengthPx: 22,
    coneHalfAngleDeg: 28,
    coneOpacity: 0.35,
    staleOpacity: 0.5,
    badgeTextSize: 9,
    badgeOffsetEm: 1.3,
    badgeHalo: 1.5,
  },
} as const;

function buildMapRoute(paint: MapPaint) {
  return {
    ...MAP_GEOMETRY,
    casingColor: paint.casing,
    returnDashColor: paint.returnDash,
    returnArrowColor: paint.returnArrow,
    stopColor: paint.stop,
    stopStrokeColor: paint.stopStroke,
    stopSelectedColor: paint.stopSelected,
    tripRideColor: paint.tripRide,
    tripWalkColor: paint.tripWalk,
    tripOriginColor: paint.tripOrigin,
    tripDestinationColor: paint.tripDestination,
    tripPointStrokeColor: paint.tripPointStroke,
  };
}

export type MapRoute = ReturnType<typeof buildMapRoute>;

// Material 3 elevation levels of docs/DESIGN.md, as Android elevation
function buildElevation(colors: Palette) {
  return {
    // Floating chips and pills over the map
    level2: { elevation: 3, shadowColor: colors.shadow } satisfies ViewStyle,
    // The bottom sheet and primary action buttons
    level3: { elevation: 6, shadowColor: colors.shadow } satisfies ViewStyle,
  };
}

export type Theme = {
  scheme: ThemeScheme;
  colors: Palette;
  typography: Typography;
  mapRoute: MapRoute;
  mapPaint: MapPaint;
  baseMap: BaseMapPalette;
  elevation: ReturnType<typeof buildElevation>;
  routeBadgeText: string;
  // A route's colour in this theme: the stored colour in dark, a readable one in light
  routeColor: (routeCode: string, storedColor: string) => string;
};

function buildTheme(scheme: ThemeScheme): Theme {
  const colors = PALETTES[scheme];
  return {
    scheme,
    colors,
    typography: buildTypography(colors),
    mapRoute: buildMapRoute(MAP_PAINTS[scheme]),
    mapPaint: MAP_PAINTS[scheme],
    baseMap: BASE_MAPS[scheme],
    elevation: buildElevation(colors),
    routeBadgeText: ROUTE_BADGE_TEXT[scheme],
    routeColor: (routeCode, storedColor) => routeColor(scheme, routeCode, storedColor),
  };
}

export const THEMES: Record<ThemeScheme, Theme> = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
};

// Light is the default (plan v2, Revision 2)
export const DEFAULT_SCHEME: ThemeScheme = 'light';
