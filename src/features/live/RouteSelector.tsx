import { ArrowRight, ChevronRight, Map as MapIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Chip } from '@/components';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

export type RouteOption = {
  code: string;
  name: string;
  color: string;
  // First, middle and last stop codes along the outbound line
  stops: string[];
};

export type VehicleFilter = 'all' | 'seats';

type RouteSelectorProps = {
  routes: readonly RouteOption[];
  selectedCode: string | null;
  filter: VehicleFilter;
  onShow: (code: string, filter: VehicleFilter) => void;
  onClose: () => void;
};

const BADGE = spacing.xl + spacing.xs;
const ICON_SIZE = spacing.md + spacing.xs;
const SMALL_ICON = spacing.md;
// The panel never covers the whole map
const PANEL_MAX_HEIGHT = '75%';

// The route list (restyle): a panel over the map. Tapping a route opens it in place with its stops,
// a vehicle filter and "Show on map".
export function RouteSelector({ routes, selectedCode, filter: initialFilter, onShow, onClose }: RouteSelectorProps) {
  const styles = useStyles();
  const { colors, typography, routeBadgeText } = useTheme();
  const [open, setOpen] = useState<string | null>(selectedCode ?? routes[0]?.code ?? null);
  const [filter, setFilter] = useState<VehicleFilter>(initialFilter);
  return (
    <View style={styles.backdrop}>
      <Pressable style={styles.grow} onPress={onClose} accessibilityLabel={strings.live.selector.close} />
      <View style={styles.panel}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <View style={styles.grow}>
            <Text style={typography.headlineSm} accessibilityRole="header">
              {strings.live.selector.title}
            </Text>
            <Text style={typography.bodySm}>{strings.live.selector.body}</Text>
          </View>
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={strings.live.selector.close}>
            <X color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {routes.map((route) => {
            const expanded = route.code === open;
            return (
              <View key={route.code} style={[styles.row, expanded && styles.rowOpen]}>
                <Pressable
                  style={styles.rowHead}
                  onPress={() => setOpen(expanded ? null : route.code)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <View style={[styles.badge, { backgroundColor: route.color }]}>
                    <Text style={[typography.labelLg, { color: routeBadgeText }]}>{route.code}</Text>
                  </View>
                  <Text style={[typography.labelLg, styles.grow]}>{route.name}</Text>
                  {!expanded ? <ChevronRight color={colors.textSecondary} size={ICON_SIZE} /> : null}
                </Pressable>
                {expanded ? (
                  <View style={styles.body}>
                    {route.stops.length > 0 ? (
                      <View style={styles.stops}>
                        {route.stops.map((stop, index) => (
                          <View key={`${stop}-${index}`} style={styles.stop}>
                            {index > 0 ? <ArrowRight color={colors.textTertiary} size={SMALL_ICON} /> : null}
                            <View style={[styles.dot, { backgroundColor: route.color }]} />
                            <Text style={typography.bodySm}>{stop}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Text style={typography.overline}>{strings.live.selector.showOnMap}</Text>
                    <View style={styles.stops}>
                      <Chip label={strings.live.selector.all} selected={filter === 'all'} onPress={() => setFilter('all')} />
                      <Chip label={strings.live.selector.seats} selected={filter === 'seats'} onPress={() => setFilter('seats')} />
                    </View>
                    <Button label={strings.live.selector.show(route.code)} leadingIcon={MapIcon} onPress={() => onShow(route.code, filter)} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },
  grow: {
    flex: 1,
  },
  panel: {
    maxHeight: PANEL_MAX_HEIGHT,
    paddingBottom: spacing.md,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.card,
  },
  handle: {
    alignSelf: 'center',
    width: spacing.xl,
    height: spacing.xs,
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    paddingTop: spacing.sm,
  },
  close: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  row: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceLow,
  },
  rowOpen: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  rowHead: {
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BADGE,
  },
  body: {
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingBottom: spacing.sm + spacing.xs,
  },
  stops: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.sm,
  },
}));
