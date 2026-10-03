import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouteData } from '@/data/RouteDataProvider';
import { OfflineMap, type MapFocus } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { DevBenchmark } from '@/features/plan/DevBenchmark';
import { PointPicker, type PickTarget, type PickedPoint } from '@/features/plan/PointPicker';
import { TripLayers, type TripPin } from '@/features/plan/TripLayers';
import { TripFailure, TripResult, type FailureAction } from '@/features/plan/TripResult';
import { discountMultiplier } from '@/shared/fare/fare';
import { boundsOfLines, withMinimumSpan } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { describePoint, nearestStop, snapToRoute } from '@/shared/routing/describe';
import { fareForItinerary, planTrip } from '@/shared/routing/plan';
import type { RouteDirection, RouteStop } from '@/shared/routing/types';
import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const ICON_SIZE = spacing.md + spacing.xs;
// A point this close to the route is described as being on it
const ON_ROUTE_M = 10;

export default function PlanScreen() {
  const styles = useStyles();
  const { colors, typography, mapRoute } = useTheme();
  const routeData = useRouteData();
  const { lines, stops } = routeData;
  const { state: tiles } = useOfflineTiles();
  const classification = useProfileStore((state) => state.classification);

  const [origin, setOrigin] = useState<PickedPoint | null>(null);
  const [destination, setDestination] = useState<PickedPoint | null>(null);
  const [active, setActive] = useState<PickTarget>('origin');
  const [collapsed, setCollapsed] = useState(false);
  const [clearCount, setClearCount] = useState(0);

  const initialBounds = useMemo(() => boundsOfLines(lines.map((line) => line.coordinates)), [lines]);

  // Names a tapped point from the nearest stop and its distance to the route
  const pinnedPoint = useCallback(
    (position: LatLon): PickedPoint => {
      const { nearestStopCode, routeDistanceM } = describePoint(lines, stops, position);
      const label =
        nearestStopCode === null || routeDistanceM === null
          ? strings.plan.pinnedPoint
          : routeDistanceM < ON_ROUTE_M
            ? strings.plan.onRouteNearStop(nearestStopCode)
            : strings.plan.nearStop(nearestStopCode, routeDistanceM);
      return { ...position, label, detail: strings.plan.coordinates(position.lat, position.lon) };
    },
    [lines, stops],
  );

  const stopPoint = useCallback(
    (stop: RouteStop): PickedPoint => ({ lat: stop.lat, lon: stop.lon, label: strings.plan.stopLabel(stop.code), detail: stop.name }),
    [],
  );

  // Fill the highlighted field, then move on to the destination so two taps make a trip
  const pick = useCallback(
    (point: PickedPoint) => {
      if (active === 'origin') {
        setOrigin(point);
        setActive('destination');
      } else {
        setDestination(point);
      }
    },
    [active],
  );

  const swap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  const clear = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setActive('origin');
    setClearCount((count) => count + 1);
  }, []);

  // Keep both points in view whenever either one changes; after "clear", go back to the whole route.
  // A new object each time is what tells the map to move.
  const focus = useMemo<MapFocus | null>(() => {
    if (origin && destination) {
      const bounds = boundsOfLines([
        [
          [origin.lon, origin.lat],
          [destination.lon, destination.lat],
        ],
      ]);
      return { key: clearCount, kind: 'bounds', bounds: withMinimumSpan(bounds, mapRoute.minFocusSpanDeg) };
    }
    const only = origin ?? destination;
    if (only) return { key: clearCount, kind: 'center', center: { lat: only.lat, lon: only.lon } };
    return clearCount > 0 ? { key: clearCount, kind: 'bounds', bounds: initialBounds } : null;
  }, [origin, destination, clearCount, initialBounds, mapRoute.minFocusSpanDeg]);

  // Runs on the device from local data: no network is involved
  const plan = useMemo(
    () => (origin && destination ? planTrip(lines, origin, destination) : null),
    [lines, origin, destination],
  );
  const itinerary = plan?.ok ? plan.itinerary : null;
  const fare = useMemo(
    () => (itinerary ? fareForItinerary(lines, itinerary, discountMultiplier(classification)) : null),
    [lines, itinerary, classification],
  );

  const pinOf = useCallback(
    (point: PickedPoint | null): TripPin | null =>
      point ? { point, snapped: describePoint(lines, stops, point).snapped } : null,
    [lines, stops],
  );
  const originPin = useMemo(() => pinOf(origin), [pinOf, origin]);
  const destinationPin = useMemo(() => pinOf(destination), [pinOf, destination]);

  // Ways out of a failed plan
  const failureActions = useMemo<FailureAction[]>(() => {
    if (!plan || plan.ok || !origin || !destination) return [];
    if (plan.reason === 'destination_not_ahead') return [{ label: strings.plan.swapToFix, onPress: swap }];

    const tooFar = plan.reason === 'origin_too_far' ? origin : plan.reason === 'destination_too_far' ? destination : null;
    if (!tooFar) return [];
    const isOrigin = plan.reason === 'origin_too_far';
    const set = isOrigin ? setOrigin : setDestination;
    const actions: FailureAction[] = [
      {
        label: isOrigin ? strings.plan.moveOriginToRoute : strings.plan.moveDestinationToRoute,
        onPress: () => set(pinnedPoint(snapToRoute(lines, tooFar))),
      },
    ];
    const nearest = nearestStop(stops, tooFar);
    if (nearest) {
      actions.push({
        label: isOrigin
          ? strings.plan.useNearestStopForOrigin(nearest.stop.code)
          : strings.plan.useNearestStopForDestination(nearest.stop.code),
        onPress: () => set(stopPoint(nearest.stop)),
      });
    }
    return actions;
  }, [plan, origin, destination, lines, stops, swap, pinnedPoint, stopPoint]);

  const CollapseIcon = collapsed ? ChevronUp : ChevronDown;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.map}>
        {tiles.status === 'ready' ? (
          <OfflineMap
            tilesUrl={tiles.tiles.url}
            initialBounds={initialBounds}
            focus={focus}
            onPress={(position) => pick(pinnedPoint(position))}
          >
            <RouteLines lines={lines} visible={ALL_DIRECTIONS} />
            <StopDots stops={stops} selectedCode={null} />
            <TripLayers lines={lines} origin={originPin} destination={destinationPin} itinerary={itinerary} />
          </OfflineMap>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={typography.caption}>
              {tiles.status === 'error' ? strings.loading.mapUnavailableOnPlan : strings.loading.tiles}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        style={styles.collapseBar}
        onPress={() => setCollapsed((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={collapsed ? strings.plan.expand : strings.plan.collapse}
      >
        <Text style={[typography.caption, styles.grow]} numberOfLines={1}>
          {itinerary && fare
            ? strings.plan.summary(itinerary.rideKm, fare.rounded)
            : collapsed
              ? strings.plan.expand
              : strings.plan.collapse}
        </Text>
        <CollapseIcon color={colors.textSecondary} size={ICON_SIZE} />
      </Pressable>

      {collapsed ? null : (
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
            <PointPicker
              origin={origin}
              destination={destination}
              active={active}
              onActivate={setActive}
              stops={stops}
              onPickStop={(stop) => pick(stopPoint(stop))}
              onSwap={swap}
              onClear={clear}
            />
            {plan && !plan.ok ? <TripFailure failure={plan} actions={failureActions} /> : null}
            {itinerary && fare ? (
              <TripResult
                itinerary={itinerary}
                fare={fare}
                classification={classification}
                isPlaceholder={routeData.isPlaceholder}
              />
            ) : null}
            {!plan ? <Text style={typography.caption}>{strings.plan.intro}</Text> : null}
            {!plan && routeData.isPlaceholder ? (
              <Text style={styles.amber}>{strings.common.placeholderDetail}</Text>
            ) : null}
            <DevBenchmark lines={lines} />
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  map: {
    flex: 5,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  collapseBar: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  grow: {
    flex: 1,
  },
  panel: {
    flex: 6,
  },
  panelContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  amber: {
    ...typography.caption,
    color: colors.warning,
  },
}));
