import { ArrowLeftRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import type { LatLon } from '@/shared/geo/haversine';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;
const DOT_SIZE = spacing.sm + spacing.xs / 2;

export type PickTarget = 'origin' | 'destination';

// A point chosen by hand: tapped on the map, or a stop. Named from the nearest stop.
export type PickedPoint = LatLon & {
  // "TSO" for a stop, "Near TSO" for a pin
  label: string;
};

type PointPillsProps = {
  origin: PickedPoint | null;
  destination: PickedPoint | null;
  // The field the next map tap or stop choice fills
  active: PickTarget;
  onActivate: (target: PickTarget) => void;
  onSwap: () => void;
};

// From and To, side by side with a swap button between them. Fits the sheet's peek height.
export function PointPills({ origin, destination, active, onActivate, onSwap }: PointPillsProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pill target="origin" point={origin} active={active === 'origin'} onPress={() => onActivate('origin')} />
      <Pressable style={styles.swap} onPress={onSwap} accessibilityRole="button" accessibilityLabel={strings.ride.swap}>
        <ArrowLeftRight color={colors.textSecondary} size={ICON_SIZE} />
      </Pressable>
      <Pill
        target="destination"
        point={destination}
        active={active === 'destination'}
        onPress={() => onActivate('destination')}
      />
    </View>
  );
}

function Pill({
  target,
  point,
  active,
  onPress,
}: {
  target: PickTarget;
  point: PickedPoint | null;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { typography, mapRoute } = useTheme();
  const name = target === 'origin' ? strings.ride.from : strings.ride.to;
  const dot = target === 'origin' ? mapRoute.tripOriginColor : mapRoute.tripDestinationColor;
  return (
    <Pressable
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${name}, ${point?.label ?? strings.ride.placeholder}`}
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={styles.text}>
        <Text style={typography.labelSm}>{name}</Text>
        <Text style={point ? typography.labelLg : typography.bodySm} numberOfLines={1}>
          {point?.label ?? strings.ride.placeholder}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pill: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.surfaceLow,
    backgroundColor: colors.surfaceLow,
  },
  pillActive: {
    borderColor: colors.primary,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE,
  },
  text: {
    flex: 1,
  },
  swap: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
