// Colour tokens for the two themes. Pure data with no React Native import, so the contrast test
// can check every pair in plain Node.
//
// Light follows the prose "Colors" section of docs/DESIGN.md (Emjay's decision, plan v2 Revision 2).
// Two of its text colours failed WCAG AA and were darkened, keeping their fills:
//   text-tertiary #747775 -> #5f6368 (it was 4.07:1 on #f1f3f4)
//   amber text    #ea8600 -> #9a5700 (it was 2.48:1 on its own fill #fef7e0; #9a5700 is 4.66:1 on #e8eaed)
// Restyle (2026-10-05, Emjay's mockup): one look across the app. Light: a soft grey canvas with white
// cards and the blue primary. Dark: the same layout and the same blue family, lightened for dark
// backgrounds, so both themes read as one app.

export type ThemeScheme = 'light' | 'dark';

export type Palette = {
  // Backgrounds, from the screen up to raised containers
  canvas: string;
  // Cards and list rows on the canvas
  card: string;
  surfaceLow: string;
  surface: string;
  surfaceHigh: string;
  // The bottom sheet over the map
  sheet: string;
  // 1 dp borders of unselected chips and inputs. Decorative: a chip is identified by its label.
  outline: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  onPrimary: string;
  // Selected chips and tonal buttons
  primaryContainer: string;
  onPrimaryContainer: string;
  success: string;
  successContainer: string;
  warning: string;
  warningContainer: string;
  danger: string;
  dangerContainer: string;
  // Shadows of floating elements
  shadow: string;
  // Dims the map behind a panel
  scrim: string;
};

// What is drawn on the map: route decoration, stops, trip markers and, from S5, vehicles.
// Everything here is a graphical object and must reach 3:1 against the map's land colour.
export type MapPaint = {
  // Outline under route lines and arrows, the colour of the map around them
  casing: string;
  returnDash: string;
  returnArrow: string;
  stop: string;
  stopStroke: string;
  stopSelected: string;
  tripRide: string;
  tripWalk: string;
  tripOrigin: string;
  tripDestination: string;
  tripPointStroke: string;
  occupancyGreen: string;
  occupancyAmber: string;
  occupancyRed: string;
  stale: string;
  // The rider's own position (blue dot) and its white edge; the accuracy ring is the dot colour, faint
  locationDot: string;
  locationDotStroke: string;
};

// Colours of the label-free base map (src/data/map/offlineStyle.ts)
export type BaseMapPalette = {
  background: string;
  land: string;
  water: string;
  landuse: string;
  building: string;
  road: string;
  // Drawn under roads to separate them from the land; null for no casing
  roadCasing: string | null;
  boundary: string;
  landuseOpacity: number;
  buildingOpacity: number;
  roadOpacity: number;
  boundaryOpacity: number;
};

export const PALETTES: Record<ThemeScheme, Palette> = {
  light: {
    canvas: '#f5f6f8',
    card: '#ffffff',
    surfaceLow: '#f8f9fa',
    surface: '#f1f3f4',
    surfaceHigh: '#e8eaed',
    sheet: '#ffffff',
    outline: '#e3e6ea',
    textPrimary: '#1f1f1f',
    textSecondary: '#444746',
    textTertiary: '#5f6368',
    primary: '#0b57d0',
    onPrimary: '#ffffff',
    primaryContainer: '#e8f0fe',
    onPrimaryContainer: '#0b57d0',
    success: '#137333',
    successContainer: '#e6f4ea',
    warning: '#9a5700',
    warningContainer: '#fef7e0',
    danger: '#b3261e',
    dangerContainer: '#fce8e6',
    shadow: '#3c4043',
    scrim: 'rgba(31, 31, 31, 0.32)',
  },
  dark: {
    canvas: '#0e1116',
    card: '#171c25',
    surfaceLow: '#141820',
    surface: '#1a1f29',
    surfaceHigh: '#232a36',
    sheet: '#141820',
    outline: '#2c3442',
    textPrimary: '#f1f3f5',
    textSecondary: '#c4cad4',
    textTertiary: '#97a0ae',
    primary: '#8ab4f8',
    onPrimary: '#0a1a33',
    primaryContainer: '#1d2b45',
    onPrimaryContainer: '#d3e3fd',
    success: '#6dd58c',
    successContainer: '#123222',
    warning: '#f6c65b',
    warningContainer: '#3a2e0f',
    danger: '#f2b8b5',
    dangerContainer: '#3f1d1b',
    shadow: '#000000',
    scrim: 'rgba(0, 0, 0, 0.55)',
  },
};

// ST2-C3: neutral grey in both themes, with no blue: the tiles mark fishponds, mangroves and the river
// mouth as water, which read as land on the ground; route colours stand out on the grey
export const BASE_MAPS: Record<ThemeScheme, BaseMapPalette> = {
  light: {
    background: '#f4f4f4',
    land: '#f4f4f4',
    water: '#dedede',
    landuse: '#e6e6e6',
    building: '#e2e2e2',
    road: '#ffffff',
    roadCasing: '#d4d4d4',
    boundary: '#9e9e9e',
    landuseOpacity: 0.7,
    buildingOpacity: 1,
    roadOpacity: 1,
    boundaryOpacity: 0.5,
  },
  dark: {
    background: '#121212',
    land: '#1c1c1c',
    water: '#121212',
    landuse: '#ffffff',
    building: '#9e9e9e',
    road: '#9e9e9e',
    roadCasing: null,
    boundary: '#9e9e9e',
    landuseOpacity: 0.04,
    buildingOpacity: 0.12,
    roadOpacity: 0.55,
    boundaryOpacity: 0.3,
  },
};

// Map label colours (LB1b): text on a halo in the map's land colour. Place and barangay names use
// `text`; road and street names the quieter `muted`. Both must reach 4.5:1 on the halo (contrast test).
export type MapLabelPaint = { text: string; muted: string; halo: string };

export const MAP_LABELS: Record<ThemeScheme, MapLabelPaint> = {
  light: { text: '#3c4043', muted: '#5f6368', halo: '#f4f4f4' },
  dark: { text: '#e0e0e0', muted: '#ababab', halo: '#1c1c1c' },
};

export const MAP_PAINTS: Record<ThemeScheme, MapPaint> = {
  light: {
    casing: '#ffffff',
    returnDash: '#ffffff',
    returnArrow: '#1f1f1f',
    stop: '#ffffff',
    stopStroke: '#444746',
    stopSelected: '#c26401',
    tripRide: '#c26401',
    tripWalk: '#444746',
    tripOrigin: '#137333',
    tripDestination: '#b3261e',
    tripPointStroke: '#ffffff',
    occupancyGreen: '#137333',
    occupancyAmber: '#c26401',
    occupancyRed: '#b3261e',
    stale: '#5f6368',
    locationDot: '#1a73e8',
    locationDotStroke: '#ffffff',
  },
  dark: {
    casing: '#0B0F17',
    returnDash: '#FFFFFF',
    returnArrow: '#FFFFFF',
    stop: '#FFFFFF',
    stopStroke: '#0B0F17',
    stopSelected: '#FFB703',
    tripRide: '#FFB703',
    tripWalk: '#FFFFFF',
    tripOrigin: '#10B981',
    tripDestination: '#EF233C',
    tripPointStroke: '#FFFFFF',
    occupancyGreen: '#34D399',
    occupancyAmber: '#FFB703',
    occupancyRed: '#FF6B7A',
    stale: '#94A3B8',
    locationDot: '#4C8DFF',
    locationDotStroke: '#FFFFFF',
  },
};

// Route colours on the light theme, by public route code. The dark theme uses the colour stored with
// the route (the database value, #00F5D4 for R4), which is unreadable on a light map. Each entry
// must reach 3:1 as a line on the light land and 4.5:1 for white badge text (checked by a test).
export const LIGHT_ROUTE_COLORS: Readonly<Record<string, string>> = {
  // Dark: #60A5FA
  R1: '#1d4ed8',
  // Dark: #F472B6
  R2: '#be185d',
  // Dark: #10B981
  R3: '#1e7e34',
  // Dark: #00F5D4
  R4: '#00796b',
  // Dark: #F97316
  R5: '#c2410c',
  // Dark: #FACC15
  R14: '#a16207',
};

// Text on a route badge
// N1: neutral author badges in the feed (PRD 19 D2), a tinted circle with a dark (light theme) or
// light (dark theme) initial. As many as FEED_BADGE_COLOR_COUNT.
export type FeedBadgeColor = { fill: string; ink: string };
export const FEED_BADGES: Record<ThemeScheme, readonly FeedBadgeColor[]> = {
  light: [
    { fill: '#e8f0fe', ink: '#0b57d0' },
    { fill: '#e6f4ea', ink: '#137333' },
    { fill: '#fef7e0', ink: '#9a5700' },
    { fill: '#fce8e6', ink: '#b3261e' },
    { fill: '#f3e8fd', ink: '#7627bb' },
    { fill: '#e4f7fb', ink: '#00727a' },
  ],
  dark: [
    { fill: '#1d2b45', ink: '#d3e3fd' },
    { fill: '#123222', ink: '#6dd58c' },
    { fill: '#3a2e0f', ink: '#f6c65b' },
    { fill: '#3f1d1b', ink: '#f2b8b5' },
    { fill: '#2e1f42', ink: '#e2c6ff' },
    { fill: '#0f3236', ink: '#7fdfe8' },
  ],
};

export const ROUTE_BADGE_TEXT: Record<ThemeScheme, string> = {
  light: '#ffffff',
  dark: '#0B0F17',
};

export function routeColor(scheme: ThemeScheme, routeCode: string, storedColor: string): string {
  if (scheme === 'dark') return storedColor;
  return LIGHT_ROUTE_COLORS[routeCode] ?? storedColor;
}

type TextToken = keyof Palette;

// Every text colour and the backgrounds it may sit on. The contrast test checks each pair at 4.5:1.
export const TEXT_PAIRS: readonly (readonly [text: TextToken, background: TextToken])[] = [
  ...(['textPrimary', 'textSecondary', 'textTertiary', 'primary', 'success', 'warning', 'danger'] as const).flatMap(
    (text) => (['canvas', 'card', 'surfaceLow', 'surface', 'surfaceHigh', 'sheet'] as const).map((bg) => [text, bg] as const),
  ),
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['textPrimary', 'primaryContainer'],
  ['primary', 'primaryContainer'],
  ['textSecondary', 'primaryContainer'],
  ['success', 'successContainer'],
  ['warning', 'warningContainer'],
  ['danger', 'dangerContainer'],
  // Text on the failure card
  ['textPrimary', 'dangerContainer'],
  ['textSecondary', 'dangerContainer'],
];
