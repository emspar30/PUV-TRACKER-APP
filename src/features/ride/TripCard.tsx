import { ArrowUpDown, LocateFixed, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import type { PickTarget, PickedPoint } from './PointPills';

type TripCardProps = {
  origin: PickedPoint | null;
  destination: PickedPoint | null;
  // The field the next map tap or stop fills
  active: PickTarget;
  onActivate: (target: PickTarget) => void;
  onClear: (target: PickTarget) => void;
  onSwap: () => void;
  // Fills From with the commuter's position; omitted when there is none
  onUseMyPosition?: () => void;
};

const ICON_SIZE = spacing.md + spacing.xs;
const MARKER = spacing.sm + spacing.xs;

// Starting point and destination (restyle): two fields joined by a dotted line, with swap on the right
export function TripCard({ origin, destination, active, onActivate, onClear, onSwap, onUseMyPosition }: TripCardProps) {
  const styles = useStyles();
  const { colors, typography, mapPaint, elevation } = useTheme();

  const field = (target: PickTarget, point: PickedPoint | null) => {
    const selected = active === target;
    const label = target === 'origin' ? strings.ride.start : strings.ride.destination;
    return (
      <Pressable
        style={[styles.field, selected && styles.fieldActive]}
        onPress={() => onActivate(target)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}, ${point?.label ?? strings.ride.choose}`}
      >
        <View style={styles.grow}>
          <Text style={typography.overline}>{label}</Text>
          <Text style={[typography.labelLg, !point && styles.placeholder]} numberOfLines={1}>
            {point?.label ?? strings.ride.choose}
          </Text>
        </View>
        {target === 'origin' && onUseMyPosition ? (
          <Pressable style={styles.icon} onPress={onUseMyPosition} accessibilityRole="button" accessibilityLabel={strings.ride.useMyPosition}>
            <LocateFixed color={colors.primary} size={ICON_SIZE} />
          </Pressable>
        ) : null}
        {point && (target === 'destination' || !onUseMyPosition) ? (
          <Pressable
            style={styles.icon}
            onPress={() => onClear(target)}
            accessibilityRole="button"
            accessibilityLabel={strings.ride.clearField(label)}
          >
            <X color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.card, elevation.level2]}>
      <View style={styles.rail}>
        <View style={[styles.marker, { borderColor: mapPaint.tripOrigin }]} />
        <View style={styles.dots} />
        <View style={[styles.marker, styles.markerEnd, { backgroundColor: mapPaint.tripDestination }]} />
      </View>
      <View style={styles.fields}>
        {field('origin', origin)}
        {field('destination', destination)}
      </View>
      <Pressable style={styles.swap} onPress={onSwap} accessibilityRole="button" accessibilityLabel={strings.ride.swap}>
        <ArrowUpDown color={colors.textPrimary} size={ICON_SIZE} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  rail: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER,
    borderWidth: 3,
    backgroundColor: colors.card,
  },
  markerEnd: {
    borderWidth: 0,
  },
  dots: {
    flex: 1,
    width: 0,
    marginVertical: spacing.xs,
    borderLeftWidth: 2,
    borderStyle: 'dotted',
    borderColor: colors.outline,
  },
  fields: {
    flex: 1,
    gap: spacing.sm,
  },
  field: {
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.sm + spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceLow,
  },
  fieldActive: {
    borderColor: colors.primary,
  },
  grow: {
    flex: 1,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  icon: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swap: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
  },
}));
