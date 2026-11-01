import { PALETTES } from '@/theme/tokens';

// The app's own light colours (src/theme/tokens.ts) as CSS variables (--canvas, --primary, ...), so the
// console and the apps never drift apart. The console is light only (owner, 2026-10-28).
export function applyTheme() {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(PALETTES.light)) root.style.setProperty(`--${name}`, value);
  root.style.colorScheme = 'light';
}
