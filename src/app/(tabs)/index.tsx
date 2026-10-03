import type { CameraRef } from '@maplibre/maplibre-react-native';
import { LocateFixed } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components';
import { BlueDot } from '@/features/map/BlueDot';
import { LocationExplainer } from '@/features/map/LocationExplainer';
import { OfflineMap } from '@/features/map/OfflineMap';
import { OriginPin } from '@/features/map/OriginPin';
import { RouteLegend } from '@/features/map/RouteLegend';
import { RouteLines } from '@/features/map/RouteLines';
import { useLocationTracking } from '@/features/map/useLocationTracking';
import { askLocationPermission } from '@/services/location';
import { MAP_BOUNDS, MAP_FOLLOW_ZOOM } from '@/shared/config';
import { containsPoint } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { selectShowExplainer, useLocationStore } from '@/state/locationStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

const ICON_SIZE = 24;

export default function MapScreen() {
  useLocationTracking();

  const cameraRef = useRef<CameraRef>(null);
  // The camera follows the rider until they move the map by hand
  const [following, setFollowing] = useState(true);

  const permission = useLocationStore((state) => state.permission);
  const canAskAgain = useLocationStore((state) => state.canAskAgain);
  const fix = useLocationStore((state) => state.fix);
  const showExplainer = useLocationStore(selectShowExplainer);
  const acceptExplainer = useLocationStore((state) => state.acceptExplainer);
  const dismissExplainer = useLocationStore((state) => state.dismissExplainer);
  const reopenExplainer = useLocationStore((state) => state.reopenExplainer);
  const requestPermission = useLocationStore((state) => state.requestPermission);
  const setManualOrigin = useLocationStore((state) => state.setManualOrigin);

  const locationAllowed = permission === 'granted';
  const reducedMode = (permission === 'undetermined' || permission === 'denied') && !showExplainer;
  const fixOnMap = fix !== null && containsPoint(MAP_BOUNDS, fix);

  useEffect(() => {
    if (!following || !fix || !fixOnMap) return;
    try {
      cameraRef.current?.easeTo({ center: [fix.lon, fix.lat], zoom: MAP_FOLLOW_ZOOM });
    } catch {
      // The map is not ready yet; the next fix moves the camera
    }
  }, [following, fix, fixOnMap]);

  const handleContinue = () => {
    acceptExplainer();
    void requestPermission(askLocationPermission);
  };

  const handleTurnOn = () => {
    // Android stops showing the prompt after repeated denials; Settings is then the only way
    if (canAskAgain) reopenExplainer();
    else void Linking.openSettings();
  };

  const handleLongPress = useCallback(
    (point: LatLon) => {
      if (!locationAllowed) setManualOrigin(point);
    },
    [locationAllowed, setManualOrigin],
  );

  const handleUserMove = useCallback(() => setFollowing(false), []);

  return (
    <Screen title={strings.map.title} mode="fill">
      <OfflineMap cameraRef={cameraRef} onLongPress={handleLongPress} onUserMove={handleUserMove}>
        <RouteLines />
        {!locationAllowed && <OriginPin />}
        <BlueDot />
      </OfflineMap>

      <View style={styles.top} pointerEvents="box-none">
        {reducedMode && (
          <View style={styles.notice}>
            <Text style={[typography.caption, styles.noticeText]}>{strings.map.locationOff}</Text>
            <Pressable style={styles.noticeButton} onPress={handleTurnOn} accessibilityRole="button">
              <Text style={[typography.caption, styles.noticeButtonLabel]}>
                {canAskAgain ? strings.map.turnOnLocation : strings.map.openSettings}
              </Text>
            </Pressable>
          </View>
        )}
        {fix !== null && !fixOnMap && (
          <View style={styles.notice}>
            <Text style={[typography.caption, styles.noticeText]}>{strings.map.outsideMap}</Text>
          </View>
        )}
      </View>

      <View style={styles.bottom} pointerEvents="box-none">
        {fixOnMap && (
          <Pressable
            style={styles.recenter}
            onPress={() => setFollowing(true)}
            accessibilityRole="button"
            accessibilityLabel={strings.map.recenter}
          >
            <LocateFixed color={following ? colors.primary : colors.textMuted} size={ICON_SIZE} />
          </Pressable>
        )}
        {showExplainer && <LocationExplainer onContinue={handleContinue} onNotNow={dismissExplainer} />}
        {!showExplainer && <RouteLegend />}
        <Text style={[typography.caption, styles.attribution]}>{strings.map.attribution}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    gap: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: MIN_TOUCH_TARGET,
  },
  noticeText: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  noticeButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeButtonLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  recenter: {
    alignSelf: 'flex-end',
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attribution: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
