import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { useSettingsStore } from '@/state/settingsStore';

import { THEMES, type Theme } from './theme';
import type { ThemeScheme } from './tokens';

const ThemeContext = createContext<Theme | null>(null);

// Provides the theme the user chose in Settings (stored on the device). Light by default.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useSettingsStore((state) => state.theme);
  return <ThemeContext.Provider value={THEMES[scheme]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider');
  return theme;
}

// Styles that depend on the theme. Each theme's stylesheet is built once and reused:
//   const useStyles = makeStyles(({ colors }) => ({ card: { backgroundColor: colors.surface } }));
//   const styles = useStyles();
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T): () => T {
  const cache: Partial<Record<ThemeScheme, T>> = {};
  return function useStyles(): T {
    const theme = useTheme();
    const cached = cache[theme.scheme];
    if (cached) return cached;
    const created = StyleSheet.create(factory(theme));
    cache[theme.scheme] = created;
    return created;
  };
}
