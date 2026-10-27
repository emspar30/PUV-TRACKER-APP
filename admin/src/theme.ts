import { PALETTES, type ThemeScheme } from '@/theme/tokens';

// The app's own colours (src/theme/tokens.ts) as CSS variables (--canvas, --primary, ...), light or
// dark as the system is, so the console and the apps never drift apart
function apply(scheme: ThemeScheme) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(PALETTES[scheme])) root.style.setProperty(`--${name}`, value);
  root.style.colorScheme = scheme;
}

export function followSystemTheme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  apply(dark.matches ? 'dark' : 'light');
  dark.addEventListener('change', (event) => apply(event.matches ? 'dark' : 'light'));
}
