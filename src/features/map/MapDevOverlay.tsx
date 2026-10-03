import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TileInstallResult } from '@/shared/map/tileInstall';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

import type { MapStatus } from './OfflineMap';

type MapDevOverlayProps = {
  install: TileInstallResult;
  mapStatus: MapStatus;
  view: ViewStateChangeEvent | null;
  // Extra distance below the status bar, to sit under other overlays
  offsetTop?: number;
};

// Development builds only: shows how the tiles were installed and where the camera is.
// In a release build `__DEV__` is false and this renders nothing.
export function MapDevOverlay({ install, mapStatus, view, offsetTop = 0 }: MapDevOverlayProps) {
  const styles = useStyles();
  const { typography } = useTheme();
  const insets = useSafeAreaInsets();
  if (!__DEV__) return null;

  return (
    <View style={[styles.overlay, { top: insets.top + spacing.sm + offsetTop }]} pointerEvents="none">
      <Text style={typography.caption}>{strings.dev.overlay(install, mapStatus)}</Text>
      <Text style={typography.caption}>
        {view ? strings.dev.camera(view.zoom, view.center[0], view.center[1]) : strings.dev.cameraIdle}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  overlay: {
    position: 'absolute',
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
  },
}));
