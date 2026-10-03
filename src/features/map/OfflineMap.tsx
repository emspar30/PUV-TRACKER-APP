import {
  Camera,
  Map,
  type CameraRef,
  type StyleSpecification,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Text, View, type NativeSyntheticEvent } from 'react-native';

import { buildOfflineStyle } from '@/data/map/offlineStyle';
import { TILESET } from '@/data/map/tileset';
import { MAP_OVERZOOM_LEVELS } from '@/shared/config';
import type { Bounds } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

const PADDING = { top: spacing.xl, right: spacing.xl, bottom: spacing.xl, left: spacing.xl };

export type MapStatus = 'loading' | 'loaded' | 'failed';

// Where to move the camera. A new `key` repeats the move even if the target is unchanged,
// for example when "Show whole route" is tapped twice.
export type MapFocusTarget = { kind: 'bounds'; bounds: Bounds } | { kind: 'center'; center: LatLon };
export type MapFocus = MapFocusTarget & { key: number };

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
  // Height of anything covering the bottom of the map, such as a bottom sheet. Fitted areas keep clear of it.
  bottomInset?: number;
  // Where the OpenStreetMap credit sits: a distance from the top, or (by default) the bottom-left corner
  attributionTop?: number;
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
  bottomInset = 0,
  attributionTop,
  children,
}: OfflineMapProps) {
  const styles = useStyles();
  const { scheme, typography, mapRoute, baseMap } = useTheme();
  const camera = useRef<CameraRef>(null);
  // The style object must keep its identity between renders, or the map reloads it.
  // It changes only with the tile file or the theme.
  const mapStyle = useMemo(() => buildOfflineStyle(tilesUrl, baseMap) as unknown as StyleSpecification, [tilesUrl, baseMap]);

  useEffect(() => {
    if (!focus) return;
    const animation = { duration: mapRoute.cameraAnimationMs };
    if (focus.kind === 'bounds') {
      camera.current?.fitBounds(focus.bounds, { padding: { ...PADDING, bottom: PADDING.bottom + bottomInset }, ...animation });
    } else {
      camera.current?.easeTo({ center: [focus.center.lon, focus.center.lat], ...animation });
    }
    // Only a new focus moves the camera; a change of inset alone does not
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, mapRoute.cameraAnimationMs]);

  const handleRegionDidChange = (event: NativeSyntheticEvent<ViewStateChangeEvent>) => onViewChange?.(event.nativeEvent);

  return (
    <View style={styles.root}>
      {/* A new theme loads a new base style, which drops the route layers drawn on top; mounting the
          map afresh for each theme draws everything again in the new colours. */}
      <Map
        key={scheme}
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
          initialViewState={{ bounds: initialBounds, padding: { ...PADDING, bottom: PADDING.bottom + bottomInset } }}
          minZoom={TILESET.minZoom}
          maxZoom={TILESET.maxZoom + MAP_OVERZOOM_LEVELS}
          maxBounds={TILESET.bounds}
        />
        {children}
      </Map>
      <View
        style={[styles.attribution, attributionTop !== undefined && { top: attributionTop, bottom: undefined }]}
        pointerEvents="none"
      >
        <Text style={typography.caption}>{strings.common.attribution}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
}));
