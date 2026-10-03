import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { MIN_TOUCH_TARGET, makeStyles, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.lg;

// A 48 dp round map button (docs/DESIGN.md "Icon Actions"): white surface, soft shadow, grey icon
export function RoundButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Icon color={colors.textSecondary} size={ICON_SIZE} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  button: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sheet,
    ...elevation.level2,
  },
}));
