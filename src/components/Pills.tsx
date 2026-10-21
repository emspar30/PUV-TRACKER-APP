import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const CHIP_HEIGHT = spacing.xl;
const CHECK_SIZE = spacing.md;
// Extra touch area so a 32 dp chip still has a 48 dp target
const CHIP_HIT_SLOP = (MIN_TOUCH_TARGET - CHIP_HEIGHT) / 2;
const DOT_SIZE = spacing.sm;
// CA1.1: a chip that cannot be picked now (as Button's disabled look)
const DISABLED_OPACITY = 0.5;

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

// A small status label such as "Live", "Stale · 3 min" or "No data", with a coloured dot
export function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tones = {
    success: { fill: colors.successContainer, text: colors.success },
    warning: { fill: colors.warningContainer, text: colors.warning },
    // The driver app's admin screen (a stopped beacon)
    danger: { fill: colors.dangerContainer, text: colors.danger },
    neutral: { fill: colors.surface, text: colors.textSecondary },
  };
  const { fill, text } = tones[tone];
  return (
    <View style={[styles.status, { backgroundColor: fill }]} accessibilityRole="text">
      <View style={[styles.dot, { backgroundColor: text }]} />
      <Text style={[styles.statusText, { color: text }]}>{label}</Text>
    </View>
  );
}

// A filter or choice chip (docs/DESIGN.md): outlined when off, tonal blue with a check when on
export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={!onPress || disabled}
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected, disabled } : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {selected ? <Check color={colors.onPrimaryContainer} size={CHECK_SIZE} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

// A route code on the route's colour, for example "R4". Never truncated. `small` (ST2-B) for a list
// where the badge sits under the main text and must not outweigh it.
export function LineBadge({ code, color, small = false }: { code: string; color: string; small?: boolean }) {
  const styles = useStyles();
  const { routeBadgeText } = useTheme();
  return (
    <View style={[styles.badge, small && styles.badgeSmall, { backgroundColor: color }]}>
      <Text style={[styles.badgeText, small && styles.badgeTextSmall, { color: routeBadgeText }]}>{code}</Text>
    </View>
  );
}

// A route choice chip (UX3): the route badge in its colour, with a check when selected. Tapping toggles.
export function RouteChip({
  code,
  color,
  selected,
  onPress,
  accessibilityLabel,
}: {
  code: string;
  color: string;
  selected: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={[styles.chip, styles.routeChip, selected && styles.chipSelected]}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !onPress }}
      accessibilityLabel={accessibilityLabel}
    >
      {selected ? <Check color={colors.onPrimaryContainer} size={CHECK_SIZE} /> : null}
      <LineBadge code={code} color={color} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  routeChip: {
    paddingHorizontal: spacing.xs,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + spacing.xs / 2,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE,
  },
  statusText: {
    ...typography.labelMd,
  },
  chip: {
    height: CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
  },
  chipSelected: {
    borderColor: colors.primaryContainer,
    backgroundColor: colors.primaryContainer,
  },
  chipDisabled: {
    opacity: DISABLED_OPACITY,
  },
  chipText: {
    ...typography.labelLg,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  badge: {
    minWidth: spacing.xl,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.badge,
  },
  badgeText: {
    ...typography.labelLg,
    fontWeight: '700',
  },
  badgeSmall: {
    minWidth: spacing.lg,
    paddingHorizontal: spacing.xs + spacing.xs / 2,
    paddingVertical: 0,
  },
  badgeTextSmall: {
    ...typography.labelMd,
    fontWeight: '700',
  },
}));
