import { router } from 'expo-router';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Logo } from '@/components';
import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { OfflineMap, type MapFocus } from '@/features/map/OfflineMap';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { DEMO_COMMUTER_STOP_CODE, MAP_FOLLOW_ZOOM } from '@/shared/config';
import { simulatedPosition } from '@/shared/demo/simulatedPosition';
import { boundsOfLines, clipBounds } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { useSettingsStore } from '@/state/settingsStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.lg;
const PIN_SIZE = spacing.xl + spacing.sm;

// CA1.1, Demo & simulation: the commuter's simulated spot, anywhere on the map. The map moves under a
// pin fixed in the middle; "Use this spot" keeps where the pin is. Opens on the current spot. The pin
// reaches the tile edge at any zoom (Santo Niño and De Oro sit near it).
export default function SimulatedPinScreen() {
  const styles = useStyles();
  const { colors, typography, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const { lines, stops } = useRouteData();
  const { state: tiles } = useOfflineTiles();
  const setSimulatedPoint = useSettingsStore((state) => state.setSimulatedPoint);
  const initialBounds = useMemo(() => clipBounds(boundsOfLines(lines.map((line) => line.coordinates)), TILESET.bounds), [lines]);

  // The current spot (pinned, or the stop), so the map opens there
  const [focus] = useState<MapFocus | null>(() => {
    const { simulatedStop, simulatedPoint } = useSettingsStore.getState();
    const at = simulatedPosition(stops, simulatedStop, simulatedPoint, DEMO_COMMUTER_STOP_CODE);
    return at ? { key: 1, kind: 'center', center: at, zoom: MAP_FOLLOW_ZOOM } : null;
  });
  // Where the pin is: the middle of the map, as the map last reported it
  const center = useRef<LatLon | null>(focus?.kind === 'center' ? focus.center : null);
  const [ready, setReady] = useState(focus !== null);

  const use = () => {
    if (!center.current) return;
    setSimulatedPoint({ lat: center.current.lat, lon: center.current.lon });
    router.back();
  };

  return (
    <View style={styles.root}>
      {tiles.status === 'ready' ? (
        <OfflineMap
          tilesUrl={tiles.tiles.url}
          glyphsUrl={tiles.tiles.glyphsUrl}
          initialBounds={initialBounds}
          focus={focus}
          centerToEdge
          onViewChange={(view) => {
            center.current = { lon: view.center[0], lat: view.center[1] };
            setReady(true);
          }}
        />
      ) : (
        <View style={styles.centered}>
          <Logo size={spacing.xl * 2} />
        </View>
      )}
      {/* The pin's tip on the map's middle */}
      <View style={styles.pinLayer} pointerEvents="none">
        <MapPin color={colors.primary} fill={colors.card} size={PIN_SIZE} style={styles.pin} />
      </View>
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={[styles.card, elevation.level2]}>
          <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={strings.common.back}>
            <ArrowLeft color={colors.textPrimary} size={ICON_SIZE} />
          </Pressable>
          <View style={styles.grow}>
            <Text style={typography.headlineSm} accessibilityRole="header">
              {strings.demo.pinTitle}
            </Text>
            <Text style={typography.bodySm}>{strings.demo.pinBody}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label={strings.demo.pinUse} leadingIcon={MapPin} onPress={use} disabled={!ready} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Lifted by its own height, so the tip (not the middle of the icon) marks the spot
  pin: {
    marginBottom: PIN_SIZE,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },
  back: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  bottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
  },
}));
