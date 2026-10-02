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
