import { Lock, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { MIN_TOUCH_TARGET, makeStyles, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.lg;
const LOCK_SIZE = spacing.md + spacing.xs / 2;
const LOCK_ICON = spacing.sm + spacing.xs / 2;

// A 48 dp round map button (docs/DESIGN.md "Icon Actions"): white surface, soft shadow, grey icon.
// An active button (for example while following the blue dot) shows its icon in the primary colour.
export function RoundButton({
  icon: Icon,
  label,
  onPress,
  active = false,
  locked = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  active?: boolean;
  // ST2-D: greyed, with a small lock, for a control that needs an account (it still opens the prompt)
  locked?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={styles.button}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Icon color={locked ? colors.textTertiary : active ? colors.primary : colors.textSecondary} size={ICON_SIZE} />
      {locked ? (
        <View style={styles.lock}>
          <Lock color={colors.onPrimary} size={LOCK_ICON} />
        </View>
      ) : null}
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
  lock: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: LOCK_SIZE,
    height: LOCK_SIZE,
    borderRadius: LOCK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textSecondary,
  },
}));
