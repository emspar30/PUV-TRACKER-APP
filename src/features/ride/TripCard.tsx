import { ArrowUpDown, ChevronDown, ChevronUp, LocateFixed, Star, X } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

import type { PickTarget, PickedPoint } from './PointPills';

type TripCardProps = {
  origin: PickedPoint | null;
  destination: PickedPoint | null;
  // The field the next map tap, stop or search result fills
  active: PickTarget;
  onActivate: (target: PickTarget) => void;
  onClear: (target: PickTarget) => void;
  onSwap: () => void;
  // Fills From with the commuter's position; omitted when there is none
  onUseMyPosition?: () => void;
  // F3: saves To as one of the frequent destinations, or removes it again; filled star once saved
  onToggleDestination?: () => void;
  destinationSaved?: boolean;
  // ST2-C2: the field being typed in, and what is typed
  searching: PickTarget | null;
  query: string;
  onQuery: (text: string) => void;
  onSubmitQuery: () => void;
  // ST2-C2: folded to one line over the map
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

const ICON_SIZE = spacing.md + spacing.xs;
const MARKER = spacing.sm + spacing.xs;
// The clear and star buttons sit close together; each keeps a 48 dp target through its hit slop
const FIELD_ICON = spacing.xl + spacing.xs;
const FIELD_ICON_SLOP = (MIN_TOUCH_TARGET - FIELD_ICON) / 2;

// Starting point and destination (restyle): two fields joined by a dotted line, with swap on the
// right. ST2-C2: a card floating over the map, folded to one line on demand; tapping a field lets
// the rider type a stop or a saved place.
export function TripCard({
  origin,
  destination,
  active,
  onActivate,
  onClear,
  onSwap,
  onUseMyPosition,
  onToggleDestination,
  destinationSaved,
  searching,
  query,
  onQuery,
  onSubmitQuery,
  collapsed,
  onToggleCollapsed,
}: TripCardProps) {
  const styles = useStyles();
  const { colors, typography, mapPaint, elevation } = useTheme();

  if (collapsed) {
    const summary = [origin?.label ?? strings.ride.start, destination?.label ?? strings.ride.destination].join('  →  ');
    return (
      <Pressable
        style={[styles.card, styles.folded, elevation.level2]}
        onPress={onToggleCollapsed}
        accessibilityRole="button"
        accessibilityLabel={strings.ride.expandTrip(summary)}
      >
        <View style={[styles.marker, { borderColor: mapPaint.tripOrigin }]} />
        <Text style={[typography.labelLg, styles.grow]} numberOfLines={1}>
          {summary}
        </Text>
        <ChevronDown color={colors.textSecondary} size={ICON_SIZE} />
      </Pressable>
    );
  }

  const field = (target: PickTarget, point: PickedPoint | null) => {
    const selected = active === target;
    const typing = searching === target;
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
          {typing ? (
            <TextInput
              style={[typography.labelLg, styles.input]}
              value={query}
              onChangeText={onQuery}
              onSubmitEditing={onSubmitQuery}
              placeholder={point?.label ?? strings.ride.searchPlaceholder}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={strings.ride.searchField(label)}
            />
          ) : (
            <Text style={[typography.labelLg, !point && styles.placeholder]} numberOfLines={1}>
              {point?.label ?? strings.ride.choose}
            </Text>
          )}
        </View>
        {target === 'origin' && onUseMyPosition ? (
          <Pressable
            style={styles.icon}
            hitSlop={FIELD_ICON_SLOP}
            onPress={onUseMyPosition}
            accessibilityRole="button"
            accessibilityLabel={strings.ride.useMyPosition}
          >
            <LocateFixed color={colors.primary} size={ICON_SIZE} />
          </Pressable>
        ) : null}
        {target === 'destination' && point && onToggleDestination ? (
          <Pressable
            style={styles.icon}
            hitSlop={FIELD_ICON_SLOP}
            onPress={onToggleDestination}
            accessibilityRole="button"
            accessibilityState={{ selected: destinationSaved === true }}
            accessibilityLabel={destinationSaved ? strings.places.remove(point.label) : strings.places.save}
          >
            <Star color={colors.warning} fill={destinationSaved ? colors.warning : 'transparent'} size={ICON_SIZE} />
          </Pressable>
        ) : null}
        {point && (target === 'destination' || !onUseMyPosition) ? (
          <Pressable
            style={[styles.icon, styles.lastIcon]}
            hitSlop={FIELD_ICON_SLOP}
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
      <View style={styles.side}>
        <Pressable style={styles.round} onPress={onToggleCollapsed} accessibilityRole="button" accessibilityLabel={strings.ride.collapseTrip}>
          <ChevronUp color={colors.textSecondary} size={ICON_SIZE} />
        </Pressable>
        <Pressable style={[styles.round, styles.swap]} onPress={onSwap} accessibilityRole="button" accessibilityLabel={strings.ride.swap}>
          <ArrowUpDown color={colors.textPrimary} size={ICON_SIZE} />
        </Pressable>
      </View>
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
  folded: {
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
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
  input: {
    padding: 0,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  icon: {
    width: FIELD_ICON,
    height: FIELD_ICON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastIcon: {
    marginRight: spacing.xs,
  },
  side: {
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  round: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  swap: {
    borderWidth: 1,
    borderColor: colors.outline,
  },
}));
