import { CircleCheck, Eye, EyeOff, Maximize, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { DirectedLine as RouteLine, RouteDirection, RouteStop } from '@/shared/routing/types';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

const DIRECTION_LABEL: Record<RouteDirection, string> = {
  outbound: strings.direction.outbound,
  return: strings.direction.return,
};
const ICON_SIZE = spacing.md + spacing.xs;

export type SelectedStop = {
  stop: RouteStop;
  // Distance from the start of the outbound line to this stop
  alongRouteKm: number | null;
};

type RoutePanelProps = {
  lines: RouteLine[];
  stops: RouteStop[];
  visible: Record<RouteDirection, boolean>;
  onToggleDirection: (direction: RouteDirection) => void;
  selected: SelectedStop | null;
  onSelectStop: (code: string | null) => void;
  onShowWholeRoute: () => void;
  isPlaceholder: boolean;
  // True when the offline map is installed and the route data is loaded
  offlineReady: boolean;
};

// Shown under the map: status, the selected stop, direction switches, a legend and the stop list.
// All text lives here, in native views; nothing is written on the map itself.
export function RoutePanel({
  lines,
  stops,
  visible,
  onToggleDirection,
  selected,
  onSelectStop,
  onShowWholeRoute,
  isPlaceholder,
  offlineReady,
}: RoutePanelProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const routeCode = lines[0]?.routeCode;

  return (
    <ScrollView style={styles.panel} contentContainerStyle={styles.content}>
      <View style={styles.spread}>
        <Text style={typography.body}>{routeCode ? strings.map.route(routeCode) : strings.tabs.map}</Text>
        {offlineReady ? (
          <View style={styles.badge} accessibilityLabel={strings.map.offlineReadyHint}>
            <CircleCheck color={colors.success} size={ICON_SIZE} />
            <Text style={styles.badgeText}>{strings.map.offlineReady}</Text>
          </View>
        ) : null}
      </View>
      {isPlaceholder ? <Text style={styles.amber}>{strings.common.placeholderDetail}</Text> : null}

      {selected ? (
        <View style={styles.card}>
          <View style={styles.cardText}>
            <Text style={typography.body}>{strings.map.stop(selected.stop.code)}</Text>
            <Text style={typography.caption}>{selected.stop.name}</Text>
            {selected.alongRouteKm !== null ? (
              <Text style={typography.caption}>{strings.map.stopAlongRoute(selected.alongRouteKm)}</Text>
            ) : null}
            {isPlaceholder ? <Text style={styles.amber}>{strings.common.placeholderData}</Text> : null}
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={() => onSelectStop(null)}
            accessibilityRole="button"
            accessibilityLabel={strings.common.close}
          >
            <X color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        </View>
      ) : (
        <Text style={typography.caption}>{strings.map.stopHint}</Text>
      )}

      <View style={styles.wrap}>
        {lines.map((line) => {
          const shown = visible[line.direction];
          const Icon = shown ? Eye : EyeOff;
          const isReturn = line.direction === 'return';
          return (
            <Pressable
              key={line.id}
              style={[styles.chip, shown && styles.chipOn]}
              onPress={() => onToggleDirection(line.direction)}
              accessibilityRole="switch"
              accessibilityState={{ checked: shown }}
              accessibilityLabel={strings.map.showDirection(DIRECTION_LABEL[line.direction])}
            >
              <View style={[styles.swatch, { backgroundColor: line.color }, isReturn && styles.swatchReturn]} />
              <Text style={typography.body}>{DIRECTION_LABEL[line.direction]}</Text>
              <Icon color={shown ? colors.textPrimary : colors.textSecondary} size={ICON_SIZE} />
            </Pressable>
          );
        })}
        <Pressable style={styles.chip} onPress={onShowWholeRoute} accessibilityRole="button">
          <Maximize color={colors.textSecondary} size={ICON_SIZE} />
          <Text style={typography.body}>{strings.map.showWholeRoute}</Text>
        </Pressable>
      </View>

      <View style={styles.legend} accessibilityLabel={strings.map.legendTitle}>
        <LegendRow text={strings.map.legendOutbound}>
          <View style={[styles.swatch, { backgroundColor: lines[0]?.color ?? colors.primary }]} />
        </LegendRow>
        <LegendRow text={strings.map.legendReturn}>
          <View style={[styles.swatch, { backgroundColor: lines[0]?.color ?? colors.primary }, styles.swatchReturn]} />
        </LegendRow>
        <LegendRow text={strings.map.legendStops}>
          <View style={styles.legendDot} />
        </LegendRow>
        <Text style={typography.caption}>{strings.map.legendArrows}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stopsScroll}
        contentContainerStyle={styles.stops}
      >
        {stops.map((stop) => {
          const isSelected = stop.code === selected?.stop.code;
          return (
            <Pressable
              key={stop.code}
              style={[styles.stop, isSelected && styles.stopSelected]}
              onPress={() => onSelectStop(isSelected ? null : stop.code)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${strings.map.stop(stop.code)}, ${stop.name}`}
            >
              <Text style={typography.body}>{stop.code}</Text>
              <Text style={typography.caption} numberOfLines={2}>
                {stop.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </ScrollView>
  );
}

function LegendRow({ text, children }: { text: string; children: ReactNode }) {
  const styles = useStyles();
  const { typography } = useTheme();
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendMark}>{children}</View>
      <Text style={[typography.caption, styles.grow]}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography, mapRoute }) => ({
  panel: {
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  spread: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    color: colors.success,
  },
  amber: {
    ...typography.caption,
    color: colors.warning,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: mapRoute.stopSelectedColor,
    backgroundColor: colors.surface,
  },
  cardText: {
    flex: 1,
    gap: spacing.xs,
  },
  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
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
  // A switched-on direction has an outline; a switched-off one keeps full-contrast text
  chipOn: {
    borderColor: colors.textSecondary,
  },
  swatch: {
    width: spacing.lg,
    height: spacing.xs,
    borderRadius: spacing.xs,
  },
  swatchReturn: {
    height: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: mapRoute.returnDashColor,
  },
  legend: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendMark: {
    width: spacing.xl,
    alignItems: 'center',
  },
  legendDot: {
    width: spacing.sm + spacing.xs,
    height: spacing.sm + spacing.xs,
    borderRadius: spacing.sm,
    backgroundColor: mapRoute.stopColor,
  },
  grow: {
    flex: 1,
  },
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
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  stopSelected: {
    borderColor: mapRoute.stopSelectedColor,
  },
}));
