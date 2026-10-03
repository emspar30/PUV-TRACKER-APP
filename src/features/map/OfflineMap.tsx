import {
  Camera,
  Map,
  type CameraRef,
  type LngLatBounds,
  type MapProps,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MAP_BOUNDS, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from '@/shared/config';
import type { LatLon } from '@/shared/geo/haversine';
import { withTileSource } from '@/shared/map/offlineStyle';
import { strings } from '@/strings';
import { colors, spacing, typography } from '@/theme';

import baseStyle from '../../../assets/map/style.json';
import { prepareTiles } from './tiles';

const BOUNDS: LngLatBounds = [...MAP_BOUNDS];

type OfflineMapProps = {
  cameraRef?: Ref<CameraRef>;
  // Area shown first; defaults to the whole tile set
  initialBounds?: LngLatBounds;
  onPress?: (point: LatLon) => void;
  onLongPress?: (point: LatLon) => void;
  // Called when the rider moves the map by hand
  onUserMove?: () => void;
  // Map content drawn above the base map: sources and layers
  children?: ReactNode;
};

// MapLibre map that reads only the on-device tile set. It has no remote sources.
export function OfflineMap({
  cameraRef,
  initialBounds = BOUNDS,
  onPress,
  onLongPress,
  onUserMove,
  children,
}: OfflineMapProps) {
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    prepareTiles()
      .then((tilesUrl) => {
        if (active) setMapStyle(withTileSource(baseStyle, tilesUrl) as StyleSpecification);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (failed || !mapStyle) {
    return (
      <View style={styles.placeholder}>
        <Text style={typography.caption}>{failed ? strings.map.loadFailed : strings.map.loading}</Text>
      </View>
    );
  }

  const handlePress: MapProps['onPress'] = (event) => {
    const [lon, lat] = event.nativeEvent.lngLat;
    onPress?.({ lat, lon });
  };

  const handleLongPress: MapProps['onLongPress'] = (event) => {
    const [lon, lat] = event.nativeEvent.lngLat;
    onLongPress?.({ lat, lon });
  };

  const handleRegionWillChange: MapProps['onRegionWillChange'] = (event) => {
    if (event.nativeEvent.userInteraction) onUserMove?.();
  };

  return (
    <Map
      mapStyle={mapStyle}
      logo={false}
      attribution={false}
      touchPitch={false}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onRegionWillChange={handleRegionWillChange}
      onDidFailLoadingMap={() => setFailed(true)}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ bounds: initialBounds }}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        maxBounds={BOUNDS}
      />
      {children}
    </Map>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.canvas,
  },
});
