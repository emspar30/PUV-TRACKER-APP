import { ArrowUpDown, LocateFixed, MapPin, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

export type FieldValue = {
  kind: 'here' | 'stop' | 'point';
  title: string;
  subtitle?: string;
};

type TripCardProps = {
  from: FieldValue | null;
  to: FieldValue | null;
  onPressFrom: () => void;
  onPressTo: () => void;
  onSwap: () => void;
};

const ICON_SIZE = 18;
const DOT_SIZE = 12;
const RAIL_DOTS = 3;

function Field({
  label,
  placeholder,
  value,
  onPress,
}: {
  label: string;
  placeholder: string;
  value: FieldValue | null;
  onPress: () => void;
}) {
  const isHere = value?.kind === 'here';
  const Icon: LucideIcon | null = isHere ? LocateFixed : value ? MapPin : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value?.title ?? placeholder}`}
      style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.valueRow}>
        {Icon && <Icon color={isHere ? colors.locationDot : colors.textMuted} size={ICON_SIZE} />}
        <Text
          numberOfLines={1}
          style={[styles.value, !value && styles.placeholder, isHere && styles.valueHere]}
        >
          {value?.title ?? placeholder}
        </Text>
      </View>
      {value?.subtitle ? (
        <Text numberOfLines={1} style={typography.caption}>
          {value.subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

// "From" and "To" as two tappable fields joined by a rail, with a swap button
export function TripCard({ from, to, onPressFrom, onPressTo, onSwap }: TripCardProps) {
  const canSwap = from !== null && to !== null;

  return (
    <View style={styles.card}>
      <View style={styles.rail}>
        <View style={styles.startDot} />
        {Array.from({ length: RAIL_DOTS }, (_, i) => (
          <View key={i} style={styles.railDot} />
        ))}
        <MapPin color={colors.crimson} size={ICON_SIZE} />
      </View>

      <View style={styles.fields}>
        <Field label={strings.plan.from} placeholder={strings.plan.fromPlaceholder} value={from} onPress={onPressFrom} />
        <View style={styles.divider} />
        <Field label={strings.plan.to} placeholder={strings.plan.toPlaceholder} value={to} onPress={onPressTo} />
      </View>

      <Pressable
        onPress={onSwap}
        disabled={!canSwap}
        accessibilityRole="button"
        accessibilityLabel={strings.plan.swap}
        style={({ pressed }) => [styles.swap, pressed && styles.fieldPressed, !canSwap && styles.disabled]}
      >
        <ArrowUpDown color={colors.primary} size={ICON_SIZE + 2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    gap: spacing.sm,
  },
  rail: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  startDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.emerald,
    backgroundColor: colors.surface,
  },
  railDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
  fields: {
    flex: 1,
  },
  field: {
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  fieldPressed: {
    backgroundColor: colors.canvas,
  },
  fieldLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  value: {
    ...typography.body,
    flexShrink: 1,
    fontWeight: '600',
  },
  valueHere: {
    color: colors.locationDot,
  },
  placeholder: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  swap: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
