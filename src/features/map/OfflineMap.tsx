import {
  Camera,
  Map,
  type CameraRef,
  type StyleSpecification,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';

import { buildOfflineStyle, type MapPalette } from '@/data/map/offlineStyle';
import { TILESET } from '@/data/map/tileset';
import { MAP_OVERZOOM_LEVELS } from '@/shared/config';
import type { Bounds } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { strings } from '@/strings';
import { colors, mapRoute, spacing, typography } from '@/theme';

const PALETTE: MapPalette = {
  background: colors.canvas,
  land: colors.surface,
  water: colors.canvas,
  landuse: colors.emerald,
  building: colors.textMuted,
  road: colors.textMuted,
  boundary: colors.textMuted,
};

const PADDING = { top: spacing.xl, right: spacing.xl, bottom: spacing.xl, left: spacing.xl };

export type MapStatus = 'loading' | 'loaded' | 'failed';

// Where to move the camera. A new `key` repeats the move even if the target is unchanged,
// for example when "Show whole route" is tapped twice.
export type MapFocus =
  | { key: number; kind: 'bounds'; bounds: Bounds }
  | { key: number; kind: 'center'; center: LatLon };

type OfflineMapProps = {
  // Style source URL of the installed tile file (see prepareOfflineTiles)
  tilesUrl: string;
  // Area shown when the map first opens
  initialBounds: Bounds;
  // Moves the camera when it changes
  focus?: MapFocus | null;
  onStatusChange?: (status: MapStatus) => void;
  onViewChange?: (view: ViewStateChangeEvent) => void;
  // Called with the tapped position, for picking a point by hand
  onPress?: (position: LatLon) => void;
  // Map content drawn on top of the base map: route line, stops, vehicle markers and, later, the blue dot
  children?: ReactNode;
};

export function OfflineMap({
  tilesUrl,
  initialBounds,
  focus,
  onStatusChange,
  onViewChange,
  onPress,
  children,
}: OfflineMapProps) {
  const camera = useRef<CameraRef>(null);
  // The style object must keep its identity between renders, or the map reloads it
  const mapStyle = useMemo(() => buildOfflineStyle(tilesUrl, PALETTE) as unknown as StyleSpecification, [tilesUrl]);

  useEffect(() => {
    if (!focus) return;
    const animation = { duration: mapRoute.cameraAnimationMs };
    if (focus.kind === 'bounds') {
      camera.current?.fitBounds(focus.bounds, { padding: PADDING, ...animation });
    } else {
      camera.current?.easeTo({ center: [focus.center.lon, focus.center.lat], ...animation });
    }
  }, [focus]);

  const handleRegionDidChange = (event: NativeSyntheticEvent<ViewStateChangeEvent>) => onViewChange?.(event.nativeEvent);

  return (
    <View style={styles.root}>
      <Map
        style={styles.map}
        mapStyle={mapStyle}
        logo={false}
        attribution={false}
        onDidFinishLoadingMap={() => onStatusChange?.('loaded')}
        onDidFailLoadingMap={() => onStatusChange?.('failed')}
        onRegionDidChange={handleRegionDidChange}
        onPress={
          onPress
            ? (event) => {
                const [lon, lat] = event.nativeEvent.lngLat;
                onPress({ lat, lon });
              }
            : undefined
        }
      >
        <Camera
          ref={camera}
          initialViewState={{ bounds: initialBounds, padding: PADDING }}
          minZoom={TILESET.minZoom}
          maxZoom={TILESET.maxZoom + MAP_OVERZOOM_LEVELS}
          maxBounds={TILESET.bounds}
        />
        {children}
      </Map>
      <View style={styles.attribution} pointerEvents="none">
        <Text style={typography.caption}>{strings.common.attribution}</Text>
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
    flex: 1,
  },
  attribution: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
  },
});
