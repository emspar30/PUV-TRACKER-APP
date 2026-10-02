import { Camera, Map, type StyleSpecification, type ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';

import { buildOfflineStyle, type MapPalette } from '@/data/map/offlineStyle';
import { TILESET } from '@/data/map/tileset';
import { MAP_OVERZOOM_LEVELS } from '@/shared/config';
import type { Bounds } from '@/shared/geo/bounds';
import { colors, spacing, typography } from '@/theme';

const PALETTE: MapPalette = {
  background: colors.canvas,
  land: colors.surface,
  water: colors.canvas,
  landuse: colors.emerald,
  building: colors.textMuted,
  road: colors.textMuted,
  boundary: colors.textMuted,
};

const INITIAL_PADDING = { top: spacing.xl, right: spacing.xl, bottom: spacing.xl, left: spacing.xl };

export type MapStatus = 'loading' | 'loaded' | 'failed';

type OfflineMapProps = {
  // Style source URL of the installed tile file (see prepareOfflineTiles)
  tilesUrl: string;
  // Area shown when the map first opens
  initialBounds: Bounds;
  onStatusChange?: (status: MapStatus) => void;
  onViewChange?: (view: ViewStateChangeEvent) => void;
  // Map content drawn on top of the base map: route line, stops, vehicle markers and, later, the blue dot
  children?: ReactNode;
};

export function OfflineMap({ tilesUrl, initialBounds, onStatusChange, onViewChange, children }: OfflineMapProps) {
  // The style object must keep its identity between renders, or the map reloads it
  const mapStyle = useMemo(() => buildOfflineStyle(tilesUrl, PALETTE) as unknown as StyleSpecification, [tilesUrl]);

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
      >
        <Camera
          initialViewState={{ bounds: initialBounds, padding: INITIAL_PADDING }}
          minZoom={TILESET.minZoom}
          maxZoom={TILESET.maxZoom + MAP_OVERZOOM_LEVELS}
          maxBounds={TILESET.bounds}
        />
        {children}
      </Map>
      <View style={styles.attribution} pointerEvents="none">
        <Text style={typography.caption}>{TILESET.attribution}</Text>
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
