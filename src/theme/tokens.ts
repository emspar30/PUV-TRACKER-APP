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

export const BASE_MAPS: Record<ThemeScheme, BaseMapPalette> = {
  light: {
    background: '#f8f9fa',
    land: '#f8f9fa',
    water: '#dde8f8',
    landuse: '#e6f4ea',
    building: '#e8eaed',
    road: '#ffffff',
    roadCasing: '#dadce0',
    boundary: '#9aa0a6',
    landuseOpacity: 0.7,
    buildingOpacity: 1,
    roadOpacity: 1,
    boundaryOpacity: 0.5,
  },
  dark: {
    background: '#0B0F17',
    land: '#161F30',
    water: '#0B0F17',
    landuse: '#10B981',
    building: '#94A3B8',
    road: '#94A3B8',
    roadCasing: null,
    boundary: '#94A3B8',
    landuseOpacity: 0.06,
    buildingOpacity: 0.12,
    roadOpacity: 0.55,
    boundaryOpacity: 0.3,
  },
};

// Map label colours (LB1b): text on a halo in the map's land colour. Place and barangay names use
// `text`; road and street names the quieter `muted`. Both must reach 4.5:1 on the halo (contrast test).
export type MapLabelPaint = { text: string; muted: string; halo: string };

export const MAP_LABELS: Record<ThemeScheme, MapLabelPaint> = {
  light: { text: '#3c4043', muted: '#5f6368', halo: '#f8f9fa' },
  dark: { text: '#E2E8F0', muted: '#A7B4C6', halo: '#161F30' },
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
  // Dark: #10B981
  R3: '#1e7e34',
  // Dark: #00F5D4
  R4: '#00796b',
  // Dark: #F97316
  R5: '#c2410c',
};

// Text on a route badge
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

// Colours of the preset avatar drawings (src/features/profile/Avatar.tsx). They are illustrations,
// the same in both themes. Skin tones and hair colours are shared by both avatar sets.
export const AVATAR_ART = {
  skin: ['#F3CDAF', '#DDA67E', '#B47A52', '#7E5234'],
  hair: { black: '#1F1A17', darkBrown: '#3D2A1F', brown: '#6E4A2E', grey: '#8A8A8A' },
  // Shirt colour, then the matching background
  outfits: {
    teal: ['#00897B', '#B2DFDB'],
    amber: ['#F9A825', '#FFE9A8'],
    blue: ['#1E88E5', '#BBDEFB'],
    green: ['#43A047', '#C8E6C9'],
    purple: ['#8E24AA', '#E1BEE7'],
    orange: ['#EF6C00', '#FFD8B0'],
    rose: ['#D81B60', '#F8BBD0'],
  },
  ink: '#2B2B2B',
  cap: '#C62828',
} as const;
