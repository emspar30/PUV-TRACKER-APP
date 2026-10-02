import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TileInstallResult } from '@/shared/map/tileInstall';
import { colors, spacing, typography } from '@/theme';

import type { MapStatus } from './OfflineMap';

const COORDINATE_DECIMALS = 4;

type MapDevOverlayProps = {
  install: TileInstallResult;
  mapStatus: MapStatus;
  view: ViewStateChangeEvent | null;
};

// Development builds only: shows how the tiles were installed and where the camera is.
export function MapDevOverlay({ install, mapStatus, view }: MapDevOverlayProps) {
  const insets = useSafeAreaInsets();
  if (!__DEV__) return null;

  const camera = view
    ? `zoom ${view.zoom.toFixed(2)}  centre ${view.center[0].toFixed(COORDINATE_DECIMALS)}, ${view.center[1].toFixed(COORDINATE_DECIMALS)}`
    : 'camera not moved yet';

  return (
    <View style={[styles.overlay, { top: insets.top + spacing.sm }]} pointerEvents="none">
      <Text style={typography.caption}>
        DEV  tiles: {install}  map: {mapStatus}
      </Text>
      <Text style={typography.caption}>{camera}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
  },
});
