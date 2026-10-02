import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TileInstallResult } from '@/shared/map/tileInstall';
import { strings } from '@/strings';
import { colors, spacing, typography } from '@/theme';

import type { MapStatus } from './OfflineMap';

type MapDevOverlayProps = {
  install: TileInstallResult;
  mapStatus: MapStatus;
  view: ViewStateChangeEvent | null;
};

// Development builds only: shows how the tiles were installed and where the camera is.
// In a release build `__DEV__` is false and this renders nothing.
export function MapDevOverlay({ install, mapStatus, view }: MapDevOverlayProps) {
  const insets = useSafeAreaInsets();
  if (!__DEV__) return null;

  return (
    <View style={[styles.overlay, { top: insets.top + spacing.sm }]} pointerEvents="none">
      <Text style={typography.caption}>{strings.dev.overlay(install, mapStatus)}</Text>
      <Text style={typography.caption}>
        {view ? strings.dev.camera(view.zoom, view.center[0], view.center[1]) : strings.dev.cameraIdle}
      </Text>
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
