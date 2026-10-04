import {
  Camera,
  Map,
  type CameraRef,
  type StyleSpecification,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Text, View, type NativeSyntheticEvent } from 'react-native';

import { GLYPH_FONT_REGULAR, LABEL_PROOF } from '@/data/map/glyphset';
import { buildOfflineStyle } from '@/data/map/offlineStyle';
import { TILESET } from '@/data/map/tileset';
import { MAP_LABEL_PROOF_DEV, MAP_OVERZOOM_LEVELS } from '@/shared/config';
import type { Bounds } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { useSettingsStore } from '@/state/settingsStore';
import { strings } from '@/strings';

import { MapLabels } from './MapLabels';
import { makeStyles, spacing, useTheme } from '@/theme';

const PADDING = { top: spacing.xl, right: spacing.xl, bottom: spacing.xl, left: spacing.xl };

export type MapStatus = 'loading' | 'loaded' | 'failed';

// Where to move the camera. A new `key` repeats the move even if the target is unchanged,
// for example when "Show whole route" is tapped twice.
// A centre move may also set the zoom, for example when following the blue dot.
export type MapFocusTarget = { kind: 'bounds'; bounds: Bounds } | { kind: 'center'; center: LatLon; zoom?: number };
export type MapFocus = MapFocusTarget & { key: number };

type OfflineMapProps = {
  // Style source URL of the installed tile file (see prepareOfflineTiles)
  tilesUrl: string;
  // Style glyph template of the installed label fonts (see prepareOfflineTiles); null when missing
  glyphsUrl?: string | null;
  // Area shown when the map first opens
  initialBounds: Bounds;
  // Moves the camera when it changes
  focus?: MapFocus | null;
  onStatusChange?: (status: MapStatus) => void;
  onViewChange?: (view: ViewStateChangeEvent) => void;
  // Called with the tapped position, for picking a point by hand
  onPress?: (position: LatLon) => void;
  // Called with the long-pressed position (the manual origin pin when location is off, PRD 4.2)
  onLongPress?: (position: LatLon) => void;
  // Called when the user starts moving the map by hand (stops following the blue dot)
  onUserMove?: () => void;
  // Height of anything covering the bottom of the map, such as a bottom sheet. Fitted areas keep clear of it.
  bottomInset?: number;
  // Where the OpenStreetMap credit sits: a distance from the top, or (by default) the bottom-left corner
  attributionTop?: number;
  // LB1b: labels at LABEL_DIMMED_OPACITY while a route is selected
  labelsDimmed?: boolean;
  // Map content drawn on top of the base map: route line, stops, vehicle markers and, later, the blue dot
  children?: ReactNode;
};

export function OfflineMap({
  tilesUrl,
  glyphsUrl,
  initialBounds,
  focus,
  onStatusChange,
  onViewChange,
  onPress,
  onLongPress,
  onUserMove,
  bottomInset = 0,
  attributionTop,
  labelsDimmed = false,
  children,
}: OfflineMapProps) {
  const styles = useStyles();
  const { scheme, colors, typography, mapRoute, baseMap } = useTheme();
  const camera = useRef<CameraRef>(null);
  // Labels need the local glyphs; switching them on or off mounts the map afresh, like a theme
  // change, so they always stay under the layers drawn on top
  const labelsOn = useSettingsStore((state) => state.mapLabels);
  const showLabels = labelsOn && !!glyphsUrl;
  // The style object must keep its identity between renders, or the map reloads it.
  // It changes only with the tile file or the theme.
  const mapStyle = useMemo(() => {
    // LB1a: the dev-only test label proves the local glyph files draw
    const proof =
      __DEV__ && MAP_LABEL_PROOF_DEV
        ? { font: GLYPH_FONT_REGULAR, ...LABEL_PROOF, textColor: colors.textPrimary, haloColor: baseMap.land }
        : undefined;
    return buildOfflineStyle(tilesUrl, baseMap, glyphsUrl, proof) as unknown as StyleSpecification;
  }, [tilesUrl, baseMap, glyphsUrl, colors.textPrimary]);

  useEffect(() => {
    if (!focus) return;
    const animation = { duration: mapRoute.cameraAnimationMs };
    if (focus.kind === 'bounds') {
      camera.current?.fitBounds(focus.bounds, { padding: { ...PADDING, bottom: PADDING.bottom + bottomInset }, ...animation });
    } else {
      camera.current?.easeTo({
        center: [focus.center.lon, focus.center.lat],
        ...(focus.zoom !== undefined ? { zoom: focus.zoom } : {}),
        ...animation,
      });
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
        key={`${scheme}-${showLabels ? 'labels' : 'plain'}`}
        style={styles.map}
        mapStyle={mapStyle}
        logo={false}
        attribution={false}
        onDidFinishLoadingMap={() => onStatusChange?.('loaded')}
        onDidFailLoadingMap={() => onStatusChange?.('failed')}
        onRegionDidChange={handleRegionDidChange}
        onRegionWillChange={(event) => {
          if (event.nativeEvent.userInteraction) onUserMove?.();
        }}
        onLongPress={
          onLongPress
            ? (event) => {
                const [lon, lat] = event.nativeEvent.lngLat;
                onLongPress({ lat, lon });
              }
            : undefined
        }
        onPress={
          onPress
            ? (event) => {
                const [lon, lat] = event.nativeEvent.lngLat;
                onPress({ lat, lon });
              }
            : undefined
        }
      >
        {/* LB1b: names first, so route lines, stops and vehicles are drawn over them */}
        {showLabels ? <MapLabels dimmed={labelsDimmed} /> : null}
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
