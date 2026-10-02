import { Eye, EyeOff } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RouteDirection, RouteLine, RouteStop } from '@/data/routeSource';
import { MIN_TOUCH_TARGET, colors, mapRoute, radii, spacing, typography } from '@/theme';

const DIRECTION_LABEL: Record<RouteDirection, string> = { outbound: 'Outbound', return: 'Return' };
const ICON_SIZE = spacing.md;

type RoutePanelProps = {
  lines: RouteLine[];
  stops: RouteStop[];
  visible: Record<RouteDirection, boolean>;
  onToggleDirection: (direction: RouteDirection) => void;
  selectedStopCode: string | null;
  onSelectStop: (code: string | null) => void;
  isPlaceholder: boolean;
};

// Shown under the map: direction switches and the stop list. All text lives here, not on the map.
export function RoutePanel({
  lines,
  stops,
  visible,
  onToggleDirection,
  selectedStopCode,
  onSelectStop,
  isPlaceholder,
}: RoutePanelProps) {
  const routeCode = lines[0]?.routeCode;

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <Text style={typography.body}>{routeCode ? `Route ${routeCode}` : 'Route'}</Text>
        {isPlaceholder ? <Text style={styles.placeholder}>Placeholder data</Text> : null}
      </View>

      <View style={styles.row}>
        {lines.map((line) => {
          const shown = visible[line.direction];
          const Icon = shown ? Eye : EyeOff;
          const isReturn = line.direction === 'return';
          return (
            <Pressable
              key={line.id}
              style={[styles.chip, !shown && styles.chipOff]}
              onPress={() => onToggleDirection(line.direction)}
              accessibilityRole="switch"
              accessibilityState={{ checked: shown }}
              accessibilityLabel={`${DIRECTION_LABEL[line.direction]} line`}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: line.color, opacity: isReturn ? mapRoute.returnBandOpacity : 1 },
                  isReturn && styles.swatchReturn,
                ]}
              />
              <Text style={typography.body}>{DIRECTION_LABEL[line.direction]}</Text>
              <Icon color={colors.textMuted} size={ICON_SIZE} />
            </Pressable>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {stops.map((stop) => {
          const selected = stop.code === selectedStopCode;
          return (
            <Pressable
              key={stop.code}
              style={[styles.stop, selected && styles.stopSelected]}
              onPress={() => onSelectStop(selected ? null : stop.code)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Stop ${stop.code}, ${stop.name}`}
            >
              <Text style={typography.body}>{stop.code}</Text>
              <Text style={typography.caption} numberOfLines={1}>
                {stop.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.canvas,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholder: {
    ...typography.caption,
    color: colors.amber,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  chipOff: {
    opacity: 0.5,
  },
  swatch: {
    width: spacing.lg,
    height: spacing.xs,
    borderRadius: spacing.xs,
  },
  swatchReturn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: mapRoute.returnDashColor,
  },
  stop: {
    minHeight: MIN_TOUCH_TARGET,
    maxWidth: spacing.xl * 6,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  stopSelected: {
    borderColor: mapRoute.stopSelectedColor,
  },
});
