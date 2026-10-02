import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getRouteLines } from '@/data/routeSource';
import { MapDevOverlay } from '@/features/map/MapDevOverlay';
import { OfflineMap, type MapStatus } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { boundsOfLines } from '@/shared/geo/bounds';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

export default function MapScreen() {
  const { state, retry } = useOfflineTiles();
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [view, setView] = useState<ViewStateChangeEvent | null>(null);

  const routeLines = useMemo(() => getRouteLines(), []);
  // Open on the whole route
  const initialBounds = useMemo(() => boundsOfLines(routeLines.map((line) => line.coordinates)), [routeLines]);

  const handleStatusChange = useCallback((status: MapStatus) => {
    if (__DEV__) console.log(`[map] status: ${status}`);
    setMapStatus(status);
  }, []);

  const handleViewChange = useCallback((next: ViewStateChangeEvent) => {
    if (__DEV__) {
      console.log(`[map] view: zoom ${next.zoom.toFixed(2)} centre ${next.center[0]}, ${next.center[1]}`);
      setView(next);
    }
  }, []);

  if (state.status === 'preparing') {
    return (
      <View style={styles.centered}>
        <Text style={typography.body}>Preparing the offline map</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    if (__DEV__) console.log(`[map] tiles error: ${state.message}`);
    return (
      <View style={styles.centered}>
        <Text style={typography.body}>The offline map could not be set up.</Text>
        <Text style={[typography.caption, styles.detail]}>{state.message}</Text>
        <Pressable style={styles.button} onPress={retry} accessibilityRole="button">
          <Text style={typography.body}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <OfflineMap
        tilesUrl={state.tiles.url}
        initialBounds={initialBounds}
        onStatusChange={handleStatusChange}
        onViewChange={handleViewChange}
      >
        <RouteLines lines={routeLines} />
      </OfflineMap>
      <MapDevOverlay install={state.tiles.install} mapStatus={mapStatus} view={view} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.canvas,
  },
  detail: {
    textAlign: 'center',
  },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
});
