import { ArrowDownUp, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LatLon } from '@/shared/geo/haversine';
import type { RouteStop } from '@/shared/routing/types';
import { MIN_TOUCH_TARGET, colors, mapRoute, radii, spacing, typography } from '@/theme';

const ICON_SIZE = spacing.md + spacing.xs;

export type PickTarget = 'origin' | 'destination';

// A point chosen by hand: tapped on the map, or a stop picked from the list
export type PickedPoint = LatLon & { label: string };

const TARGET_LABEL: Record<PickTarget, string> = { origin: 'Origin', destination: 'Destination' };
const TARGET_COLOR: Record<PickTarget, string> = {
  origin: mapRoute.tripOriginColor,
  destination: mapRoute.tripDestinationColor,
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
  const values: Record<PickTarget, PickedPoint | null> = { origin, destination };

  return (
    <View style={styles.root}>
      <View style={styles.fieldsRow}>
        <View style={styles.fields}>
          {(['origin', 'destination'] as const).map((target) => (
            <Pressable
              key={target}
              style={[styles.field, active === target && styles.fieldActive]}
              onPress={() => onActivate(target)}
              accessibilityRole="button"
              accessibilityState={{ selected: active === target }}
              accessibilityLabel={`${TARGET_LABEL[target]}: ${values[target]?.label ?? 'not set'}`}
            >
              <View style={[styles.dot, { backgroundColor: TARGET_COLOR[target] }]} />
              <View style={styles.fieldText}>
                <Text style={typography.caption}>{TARGET_LABEL[target]}</Text>
                <Text style={typography.body} numberOfLines={1}>
                  {values[target]?.label ?? 'Tap the map or pick a stop'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
        <View style={styles.actions}>
          <Pressable
            style={styles.iconButton}
            onPress={onSwap}
            accessibilityRole="button"
            accessibilityLabel="Swap origin and destination"
          >
            <ArrowDownUp color={colors.textMuted} size={ICON_SIZE} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear both points">
            <X color={colors.textMuted} size={ICON_SIZE} />
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stops}>
        {stops.map((stop) => (
          <Pressable
            key={stop.code}
            style={styles.stop}
            onPress={() => onPickStop(stop)}
            accessibilityRole="button"
            accessibilityLabel={`Set ${TARGET_LABEL[active].toLowerCase()} to stop ${stop.code}, ${stop.name}`}
          >
            <Text style={typography.body}>{stop.code}</Text>
            <Text style={typography.caption} numberOfLines={1}>
              {stop.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderColor: colors.cyan,
  },
  fieldText: {
    flex: 1,
  },
  dot: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: spacing.sm,
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
  stops: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stop: {
    minHeight: MIN_TOUCH_TARGET,
    maxWidth: spacing.xl * 6,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
});
