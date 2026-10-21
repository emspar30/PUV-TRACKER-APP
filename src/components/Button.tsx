import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  // Shown after the label, such as an arrow
  icon?: LucideIcon;
  // Shown before the label, such as a mail icon
  leadingIcon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'text';
  disabled?: boolean;
  accessibilityLabel?: string;
};

const ICON_SIZE = spacing.md + spacing.xs;
const BUTTON_HEIGHT = MIN_TOUCH_TARGET + spacing.xs;

// The app's buttons (restyle): a filled blue pill for the main action, an outlined card-colour pill
// for a second choice, a red pill for an action that cannot be undone, and a plain text button
// for Skip or Later
export function Button({ label, onPress, icon: Icon, leadingIcon: Leading, variant = 'primary', disabled, accessibilityLabel }: ButtonProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const textColor = variant === 'primary' || variant === 'success' || variant === 'danger' ? colors.onPrimary : variant === 'secondary' ? colors.textPrimary : colors.primary;
  return (
    <Pressable
      style={({ pressed }) => [styles.base, styles[variant], disabled && styles.disabled, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityLabel={accessibilityLabel}
    >
      {Leading ? <Leading color={textColor} size={ICON_SIZE} /> : null}
      {/* Backlog 123: on the HONOR X8c the system font draws a label a few pixels wider than React
          Native measures it (any font family: MagicOS substitutes its own), so "Turn beacon off" lost
          its last word to a hidden second line. One line, shrunk slightly only where it would not fit */}
      <Text style={[typography.labelLg, { color: textColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
      {Icon ? <Icon color={textColor} size={ICON_SIZE} /> : null}
    </Pressable>
  );
}

const PRESSED_OPACITY = 0.85;
const DISABLED_OPACITY = 0.5;

const useStyles = makeStyles(({ colors }) => ({
  base: {
    minHeight: BUTTON_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  // Something switched on, such as the arrival alert
  success: {
    backgroundColor: colors.success,
  },
  // A choice that cannot be undone, such as Reset
  danger: {
    backgroundColor: colors.danger,
  },
  text: {
    minHeight: MIN_TOUCH_TARGET,
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
  pressed: {
    opacity: PRESSED_OPACITY,
  },
}));
