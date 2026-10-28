import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MIN_TOUCH_TARGET, spacing } from '@/theme';

// The bottom bar floats as a card like the top bar (Emjay's draft, 2026-10-26), spacing.sm above
// the system's navigation area
export const TAB_BAR_HEIGHT = MIN_TOUCH_TARGET + spacing.sm;

// Where the floating bar sits (its gap from the screen's bottom edge), the height it covers there,
// and where a tab's bottom content goes: just above the bar, with the same gap. Every tab runs
// under the bar (a map shows round it) and lifts its own content by `above`.
export function useTabBarSpace(): { bottom: number; space: number; above: number } {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + spacing.sm;
  const space = bottom + TAB_BAR_HEIGHT;
  return { bottom, space, above: space + spacing.sm };
}
