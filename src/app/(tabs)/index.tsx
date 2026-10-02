import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { MapDevOverlay } from '@/features/map/MapDevOverlay';
import { OfflineMap, type MapFocus, type MapStatus } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { RoutePanel, type SelectedStop } from '@/features/map/RoutePanel';
import { StopDots } from '@/features/map/StopDots';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { boundsOfLines } from '@/shared/geo/bounds';
import { projectOntoLine } from '@/shared/geo/line';
import type { RouteDirection } from '@/shared/routing/types';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const LOGO_SIZE = spacing.xl * 3;

export default function MapScreen() {
  const { state, retry } = useOfflineTiles();
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [view, setView] = useState<ViewStateChangeEvent | null>(null);
  const [visible, setVisible] = useState(ALL_DIRECTIONS);
  const [selectedStopCode, setSelectedStopCode] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  // Lines and stops come from the local database, not from the seed file
  const { lines: routeLines, stops: routeStops, isPlaceholder } = useRouteData();
  // Open on the whole route
  const initialBounds = useMemo(() => boundsOfLines(routeLines.map((line) => line.coordinates)), [routeLines]);

  const selected = useMemo<SelectedStop | null>(() => {
    const stop = routeStops.find((candidate) => candidate.code === selectedStopCode);
    if (!stop) return null;
    const outbound = routeLines.find((line) => line.direction === 'outbound');
    return { stop, alongRouteKm: outbound ? projectOntoLine(outbound.coordinates, stop).chainageKm : null };
  }, [routeStops, routeLines, selectedStopCode]);

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

  const toggleDirection = useCallback((direction: RouteDirection) => {
    setVisible((current) => ({ ...current, [direction]: !current[direction] }));
  }, []);

  const showWholeRoute = useCallback(() => {
    setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds: initialBounds }));
  }, [initialBounds]);

  if (state.status === 'preparing') {
    return (
      <View style={styles.centered}>
        <Logo size={LOGO_SIZE} />
        <Text style={typography.body}>{strings.loading.tiles}</Text>
        <Text style={[typography.caption, styles.detail]}>{strings.loading.tilesFirstRun}</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    if (__DEV__) console.log(`[map] tiles error: ${state.message}`);
    return (
      <View style={styles.centered}>
        <Text style={typography.body}>{strings.loading.tilesFailed}</Text>
        <Text style={[typography.caption, styles.detail]}>{state.message}</Text>
        <Pressable style={styles.button} onPress={retry} accessibilityRole="button">
          <Text style={typography.body}>{strings.common.tryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.map}>
        <OfflineMap
          tilesUrl={state.tiles.url}
          initialBounds={initialBounds}
          focus={focus}
          onStatusChange={handleStatusChange}
          onViewChange={handleViewChange}
        >
          <RouteLines lines={routeLines} visible={visible} />
          <StopDots stops={routeStops} selectedCode={selectedStopCode} onPressStop={setSelectedStopCode} />
        </OfflineMap>
        <MapDevOverlay install={state.tiles.install} mapStatus={mapStatus} view={view} />
      </View>
      <View style={styles.panel}>
        <RoutePanel
          lines={routeLines}
          stops={routeStops}
          visible={visible}
          onToggleDirection={toggleDirection}
          selected={selected}
          onSelectStop={setSelectedStopCode}
          onShowWholeRoute={showWholeRoute}
          isPlaceholder={isPlaceholder}
          offlineReady={mapStatus === 'loaded'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  map: {
    flex: 5,
  },
  panel: {
    flex: 4,
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
