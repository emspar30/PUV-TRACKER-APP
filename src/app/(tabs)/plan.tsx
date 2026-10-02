import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouteData } from '@/data/RouteDataProvider';
import { OfflineMap } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { DevBenchmark } from '@/features/plan/DevBenchmark';
import { formatCoordinates } from '@/features/plan/format';
import { PointPicker, type PickTarget, type PickedPoint } from '@/features/plan/PointPicker';
import { TripLayers } from '@/features/plan/TripLayers';
import { TripFailure, TripResult } from '@/features/plan/TripResult';
import { discountMultiplier } from '@/shared/fare/fare';
import { boundsOfLines } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { fareForItinerary, planTrip } from '@/shared/routing/plan';
import type { RouteDirection, RouteStop } from '@/shared/routing/types';
import { useProfileStore } from '@/state/profileStore';
import { colors, spacing, typography } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };

export default function PlanScreen() {
  const routeData = useRouteData();
  const { state: tiles } = useOfflineTiles();
  const classification = useProfileStore((state) => state.classification);

  const [origin, setOrigin] = useState<PickedPoint | null>(null);
  const [destination, setDestination] = useState<PickedPoint | null>(null);
  const [active, setActive] = useState<PickTarget>('origin');

  const initialBounds = useMemo(
    () => boundsOfLines(routeData.lines.map((line) => line.coordinates)),
    [routeData.lines],
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

  const handleMapPress = useCallback(
    (position: LatLon) => pick({ ...position, label: `Pinned point (${formatCoordinates(position.lat, position.lon)})` }),
    [pick],
  );

  const handlePickStop = useCallback(
    (stop: RouteStop) => pick({ lat: stop.lat, lon: stop.lon, label: `Stop ${stop.code}` }),
    [pick],
  );

  const swap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  const clear = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setActive('origin');
  }, []);

  // Runs on the device from local data: no network is involved
  const plan = useMemo(
    () => (origin && destination ? planTrip(routeData.lines, origin, destination) : null),
    [routeData.lines, origin, destination],
  );
  const itinerary = plan?.ok ? plan.itinerary : null;
  const fare = useMemo(
    () => (itinerary ? fareForItinerary(routeData.lines, itinerary, discountMultiplier(classification)) : null),
    [routeData.lines, itinerary, classification],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.map}>
        {tiles.status === 'ready' ? (
          <OfflineMap tilesUrl={tiles.tiles.url} initialBounds={initialBounds} onPress={handleMapPress}>
            <RouteLines lines={routeData.lines} visible={ALL_DIRECTIONS} />
            <StopDots stops={routeData.stops} selectedCode={null} />
            <TripLayers lines={routeData.lines} origin={origin} destination={destination} itinerary={itinerary} />
          </OfflineMap>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={typography.caption}>
              {tiles.status === 'error' ? 'The offline map is unavailable. You can still pick stops below.' : 'Preparing the offline map'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.panel}>
      <ScrollView contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
        <PointPicker
          origin={origin}
          destination={destination}
          active={active}
          onActivate={setActive}
          stops={routeData.stops}
          onPickStop={handlePickStop}
          onSwap={swap}
          onClear={clear}
        />
        {plan && !plan.ok ? <TripFailure reason={plan.reason} /> : null}
        {itinerary && fare ? (
          <TripResult
            itinerary={itinerary}
            fare={fare}
            classification={classification}
            isPlaceholder={routeData.isPlaceholder}
          />
        ) : null}
        {!plan ? (
          <Text style={typography.caption}>
            Choose an origin and a destination by tapping the map or picking a stop. Planning works offline.
          </Text>
        ) : null}
        <DevBenchmark lines={routeData.lines} />
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  map: {
    flex: 2,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  panel: {
    flex: 3,
  },
  panelContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
});
