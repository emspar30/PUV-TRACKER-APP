import { ArrowDownUp, X } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { LatLon } from '@/shared/geo/haversine';
import type { RouteStop } from '@/shared/routing/types';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;

export type PickTarget = 'origin' | 'destination';

// A point chosen by hand: tapped on the map, or a stop picked from the list
export type PickedPoint = LatLon & {
  // What the point is called, for example "Near TSO, 120 m from the route" or "Stop TSO"
  label: string;
  // Coordinates, shown small under the label
  detail: string;
};

const TARGET_LABEL: Record<PickTarget, string> = {
  origin: strings.plan.origin,
  destination: strings.plan.destination,
};

type PointPickerProps = {
  origin: PickedPoint | null;
  destination: PickedPoint | null;
  active: PickTarget;
  onActivate: (target: PickTarget) => void;
  stops: RouteStop[];
  onPickStop: (stop: RouteStop) => void;
  onSwap: () => void;
  onClear: () => void;
};

// Origin and destination fields, set by hand. The highlighted field is the one that the next
// map tap or stop choice fills in.
export function PointPicker({
  origin,
  destination,
  active,
  onActivate,
  stops,
  onPickStop,
  onSwap,
  onClear,
}: PointPickerProps) {
  const styles = useStyles();
  const { colors, typography, mapRoute } = useTheme();
  const targetColor: Record<PickTarget, string> = {
    origin: mapRoute.tripOriginColor,
    destination: mapRoute.tripDestinationColor,
  };
  const values: Record<PickTarget, PickedPoint | null> = { origin, destination };

  return (
    <View style={styles.root}>
      <View style={styles.fieldsRow}>
        <View style={styles.fields}>
          {(['origin', 'destination'] as const).map((target) => {
            const value = values[target];
            return (
              <Pressable
                key={target}
                style={[styles.field, active === target && styles.fieldActive]}
                onPress={() => onActivate(target)}
                accessibilityRole="button"
                accessibilityState={{ selected: active === target }}
                accessibilityLabel={`${TARGET_LABEL[target]}: ${value?.label ?? strings.plan.notSet}`}
              >
                <View style={[styles.dot, { backgroundColor: targetColor[target] }]} />
                <View style={styles.fieldText}>
                  <Text style={typography.caption}>{TARGET_LABEL[target]}</Text>
                  <Text style={typography.body}>{value?.label ?? strings.plan.notSet}</Text>
                  {value ? <Text style={typography.caption}>{value.detail}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.actions}>
          <Pressable
            style={styles.iconButton}
            onPress={onSwap}
            accessibilityRole="button"
            accessibilityLabel={strings.plan.swap}
          >
            <ArrowDownUp color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={strings.plan.clear}
          >
            <X color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stopsScroll}
        contentContainerStyle={styles.stops}
        keyboardShouldPersistTaps="handled"
      >
        {stops.map((stop) => (
          <Pressable
            key={stop.code}
            style={styles.stop}
            onPress={() => onPickStop(stop)}
            accessibilityRole="button"
            accessibilityLabel={strings.plan.pickStopFor(TARGET_LABEL[active].toLowerCase(), stop.code, stop.name)}
          >
            <Text style={typography.body}>{stop.code}</Text>
            <Text style={typography.caption} numberOfLines={2}>
              {stop.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, mapRoute }) => ({
  root: {
    gap: spacing.sm,
  },
  fieldsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fields: {
    flex: 1,
    gap: spacing.sm,
  },
  field: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  fieldActive: {
    borderColor: colors.primary,
  },
  fieldText: {
    flex: 1,
  },
  dot: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: mapRoute.tripPointStrokeColor,
  },
  actions: {
    gap: spacing.sm,
  },
  iconButton: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    width: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  // Lets the chip row run to the screen edge while scrolling, instead of being cut at the panel padding
  stopsScroll: {
    marginHorizontal: -spacing.md,
  },
  stops: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  stop: {
    minHeight: MIN_TOUCH_TARGET,
    width: spacing.xl * 5,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
}));
