import type { TextStyle } from 'react-native';

// Light palette. Text colors meet WCAG AA contrast (4.5:1) on both canvas and surface.
export const colors = {
  canvas: '#F4F6F9',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  // Buttons, selected options and key figures (teal, AA on white)
  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  // Brand accents, for fills only: too light for text on a light background
  cyan: '#00F5D4',
  amber: '#FFB703',
  crimson: '#DC2626',
  emerald: '#059669',
  // Amber that is dark enough for text
  warning: '#B45309',
  locationDot: '#2563EB',
  // Outline drawn under route lines so light route colors read on the light map
  routeCasing: '#134E4A',
  walk: '#475569',
  // Dimmed backdrop behind bottom sheets
  scrim: 'rgba(15, 23, 42, 0.45)',
  textPrimary: '#0F172A',
  textMuted: '#475569',
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
