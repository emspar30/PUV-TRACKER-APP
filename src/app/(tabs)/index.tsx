import { useIsFocused } from 'expo-router';
import { Bus, LocateFixed, Maximize, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo, RoundButton, TopBar, type StatusTone } from '@/components';
import { useRepositories } from '@/data/live/useRepositories';
import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { ActiveRouteCard } from '@/features/live/ActiveRouteCard';
import { ExploreCard } from '@/features/live/ExploreCard';
import { RouteSelector, type RouteOption, type VehicleFilter } from '@/features/live/RouteSelector';
import { VehicleCard } from '@/features/live/VehicleCard';
import { BlueDot } from '@/features/map/BlueDot';
import { LocationExplainer } from '@/features/map/LocationExplainer';
import { OfflineMap, type MapFocus } from '@/features/map/OfflineMap';
import { OriginPin } from '@/features/map/OriginPin';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useLiveLocation } from '@/features/map/useLiveLocation';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { useRouteLayers } from '@/features/map/useRouteLayers';
import { useVehicles } from '@/features/vehicles/useVehicles';
import { VehicleMarkers } from '@/features/vehicles/VehicleMarkers';
import { MAP_FOLLOW_ZOOM } from '@/shared/config';
import { boundsOfLines, clipBounds } from '@/shared/geo/bounds';
import { projectOntoLine } from '@/shared/geo/line';
import type { RouteDirection } from '@/shared/routing/types';
import { ageSeconds, routeCoverage } from '@/shared/telemetry/coverage';
import { nextStopOf } from '@/shared/telemetry/nextStop';
import { seatTier } from '@/shared/telemetry/occupancy';
import { isStopped } from '@/shared/telemetry/stopped';
import { routeCodesOf } from '@/shared/ui/routeVisibility';
import { useHintsStore } from '@/state/hintsStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md + spacing.xs;
// Zoom assumed for the heading cones until the camera first reports one
const DEFAULT_VEHICLE_ZOOM = 12;
// The route list shows each route's first, middle and last stop
const LIST_STOPS = 3;
const HALF = 2;
// Which directions of the picked route show; the swap button steps through them
type DirectionView = 'both' | RouteDirection;
const SHOWS: Record<DirectionView, Record<RouteDirection, boolean>> = {
  both: { outbound: true, return: true },
  outbound: { outbound: true, return: false },
  return: { outbound: false, return: true },
};

// Map tab (restyle of Live): a full-screen map with the top bar, an Explore card until a route is
// picked, the route list as a panel, the picked route's card on top, and a card for a tapped
// multicab or stop. Vehicles come from the repository: demo (AF3) or the database (L1).
export default function MapScreen() {
  const styles = useStyles();
  const { colors, typography, routeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, retry } = useOfflineTiles();
  const { lines, stops } = useRouteData();

  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [bottomHeight, setBottomHeight] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [directionView, setDirectionView] = useState<DirectionView>('both');
  const [filter, setFilter] = useState<VehicleFilter>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_VEHICLE_ZOOM);
  const dismissHint = useHintsStore((store) => store.dismiss);
  const fittedOnce = useRef(false);

  const repos = useRepositories();
  const location = useLiveLocation((center) =>
    setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center, zoom: MAP_FOLLOW_ZOOM })),
  );

  const layers = useRouteLayers(lines, stops, 'live', selectedRoute);
  const routeLines = useMemo(() => lines.filter((line) => line.routeCode === selectedRoute), [lines, selectedRoute]);
  const directions = SHOWS[directionView];

  // Tabs stay mounted; vehicles refresh only while Map is the tab in front
  const focused = useIsFocused();
  const live = useVehicles(repos.vehicles, focused ? selectedRoute : null);
  const vehicles = useMemo(() => {
    const directionOf = new Map(lines.map((line) => [line.id, line.direction]));
    return live.vehicles.filter(
      (vehicle) =>
        directions[directionOf.get(vehicle.lineId) ?? 'outbound'] && (filter === 'all' || seatTier(vehicle.seatsTaken) === 'green'),
    );
  }, [live.vehicles, lines, directions, filter]);
  const coverage = routeCoverage(vehicles.map((vehicle) => ageSeconds(vehicle.lastPacketMs, live.nowMs)));

  // The routes' box, clipped to the tile set so the opening view always has map data (RR1)
  const initialBounds = useMemo(() => clipBounds(boundsOfLines(lines.map((line) => line.coordinates)), TILESET.bounds), [lines]);
  const colorOfRoute = useCallback(
    (code: string) => {
      const line = lines.find((candidate) => candidate.routeCode === code);
      return line ? routeColor(code, line.color) : colors.primary;
    },
    [lines, routeColor, colors.primary],
  );

  const routeOptions = useMemo<RouteOption[]>(
    () =>
      routeCodesOf(lines).map((code) => {
        const ofRoute = lines.filter((line) => line.routeCode === code);
        const main = ofRoute.find((line) => line.direction === 'outbound') ?? ofRoute[0];
        const onRoute = stops
          .filter((stop) => stop.routeCodes?.includes(code))
          .sort((a, b) => projectOntoLine(main.coordinates, a).chainageKm - projectOntoLine(main.coordinates, b).chainageKm);
        const picks =
          onRoute.length <= LIST_STOPS ? onRoute : [onRoute[0], onRoute[Math.floor(onRoute.length / HALF)], onRoute[onRoute.length - 1]];
        return { code, name: main.name, color: colorOfRoute(code), stops: picks.map((stop) => stop.code) };
      }),
    [lines, stops, colorOfRoute],
  );

  const frame = useCallback(
    (code: string | null) => {
      const ofRoute = code ? lines.filter((line) => line.routeCode === code) : lines;
      const bounds = clipBounds(boundsOfLines(ofRoute.map((line) => line.coordinates)), TILESET.bounds);
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds }));
    },
    [lines],
  );

  const showRoute = (code: string, nextFilter: VehicleFilter) => {
    setSelectedRoute(code);
    setFilter(nextFilter);
    setDirectionView('both');
    setSelectedVehicle(null);
    setSelectedStop(null);
    setSelectorOpen(false);
    dismissHint('live');
    frame(code);
  };

  const hideRoute = () => {
    setSelectedRoute(null);
    setSelectedVehicle(null);
    setSelectedStop(null);
    frame(null);
  };

  // Both, then each stored direction in turn
  const directionSteps: DirectionView[] = [
    'both',
    ...(['outbound', 'return'] as const).filter((direction) => routeLines.some((line) => line.direction === direction)),
  ];
  const swap = () => setDirectionView((current) => directionSteps[(directionSteps.indexOf(current) + 1) % directionSteps.length]);

  const selectStop = useCallback(
    (code: string | null) => {
      setSelectedStop(code);
      setSelectedVehicle(null);
      const stop = stops.find((candidate) => candidate.code === code);
      if (stop) setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: stop }));
    },
    [stops],
  );

  const handleViewChange = useCallback((next: { zoom: number }) => setZoom(next.zoom), []);
  // Once the map is ready and the bottom card measured, frame all routes above it
  const handleStatusChange = useCallback(() => {
    if (fittedOnce.current) return;
    fittedOnce.current = true;
    frame(null);
  }, [frame]);

  if (state.status === 'preparing') {
    return (
      <View style={styles.centered}>
        <Logo size={LOGO_SIZE} />
        <Text style={typography.bodyLg}>{strings.loading.tiles}</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={typography.bodyLg}>{strings.loading.tilesFailed}</Text>
        <Text style={[typography.bodySm, styles.center]}>{state.message}</Text>
        <Pressable style={styles.retry} onPress={retry} accessibilityRole="button">
          <Text style={typography.labelLg}>{strings.common.tryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  const status: { label: string; tone: StatusTone } =
    coverage.coverage === 'live'
      ? { label: strings.live.active.count(vehicles.length), tone: 'success' }
      : coverage.coverage === 'stale'
        ? { label: strings.live.status.stale(strings.live.age(coverage.youngestAgeS ?? 0)), tone: 'warning' }
        : { label: strings.live.status.noData, tone: 'neutral' };
  const directionLabel = directionView === 'both' ? strings.live.active.both : strings.direction[directionView];
  const vehicle = vehicles.find((candidate) => candidate.id === selectedVehicle) ?? null;
  const stop = stops.find((candidate) => candidate.code === selectedStop) ?? null;
  const selectedOption = routeOptions.find((option) => option.code === selectedRoute) ?? null;

  return (
    <View style={styles.root}>
      <OfflineMap
        tilesUrl={state.tiles.url}
        glyphsUrl={state.tiles.glyphsUrl}
        labelsDimmed={selectedRoute !== null}
        initialBounds={initialBounds}
        focus={focus}
        bottomInset={bottomHeight}
        onStatusChange={handleStatusChange}
        onViewChange={handleViewChange}
        onLongPress={location.setManualOrigin}
        onUserMove={location.stopFollowing}
      >
        <RouteLines lines={layers.lines} visible={directions} opacity={layers.opacity} />
        <StopDots stops={layers.stops} selectedCode={selectedStop} onPressStop={selectStop} />
        {selectedRoute ? (
          <VehicleMarkers
            vehicles={vehicles}
            nowMs={live.nowMs}
            color={colorOfRoute(selectedRoute)}
            zoom={zoom}
            labels={state.tiles.glyphsUrl !== null}
            selectedId={selectedVehicle}
            onPressVehicle={(id) => {
              setSelectedVehicle(id);
              setSelectedStop(null);
            }}
          />
        ) : null}
        {!location.locationAllowed ? <OriginPin /> : null}
        <BlueDot />
      </OfflineMap>

      <View style={[styles.top, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        <TopBar />
        {selectedOption ? (
          <ActiveRouteCard
            code={selectedOption.code}
            name={selectedOption.name}
            color={selectedOption.color}
            status={status}
            direction={directionLabel}
            onSwap={directionSteps.length > 1 ? swap : undefined}
            onClose={hideRoute}
          />
        ) : null}
      </View>

      <View style={styles.bottom} onLayout={(event) => setBottomHeight(event.nativeEvent.layout.height)} pointerEvents="box-none">
        <View style={styles.buttons} pointerEvents="box-none">
          <RoundButton icon={Bus} label={strings.live.selector.open} onPress={() => setSelectorOpen(true)} />
          {selectedRoute ? <RoundButton icon={Maximize} label={strings.map.showWholeRoute} onPress={() => frame(selectedRoute)} /> : null}
          <RoundButton
            icon={LocateFixed}
            label={location.following ? strings.location.following : strings.location.locateMe}
            onPress={location.locateMe}
            active={location.following && location.locationAllowed}
          />
        </View>
        {location.showExplainer ? <LocationExplainer onContinue={location.continueExplainer} onNotNow={location.dismissExplainer} /> : null}
        {location.reducedMode ? (
          <View style={styles.notice}>
            <Text style={[typography.bodySm, styles.grow]}>{strings.location.off}</Text>
            <Pressable style={styles.noticeButton} onPress={location.locateMe} accessibilityRole="button">
              <Text style={[typography.labelLg, styles.noticeAction]}>
                {location.canAskAgain ? strings.location.turnOn : strings.location.openSettings}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {vehicle ? (
          <VehicleCard
            vehicle={vehicle}
            nowMs={live.nowMs}
            nextStop={nextStopOf(vehicle, lines, layers.stops)?.code ?? null}
            stopped={vehicle.layover === true || isStopped(vehicle.recentSpeeds, vehicle.lastPacketMs)}
            onClose={() => setSelectedVehicle(null)}
          />
        ) : stop ? (
          <View style={styles.stopCard}>
            <View style={styles.grow}>
              <Text style={typography.headlineSm}>{stop.code}</Text>
              <Text style={typography.bodyMd} numberOfLines={2}>
                {stop.name}
              </Text>
            </View>
            <Pressable
              style={styles.iconButton}
              onPress={() => setSelectedStop(null)}
              accessibilityRole="button"
              accessibilityLabel={strings.live.closeStop}
            >
              <X color={colors.textSecondary} size={ICON_SIZE} />
            </Pressable>
          </View>
        ) : !selectedRoute ? (
          <ExploreCard onAllRoutes={() => setSelectorOpen(true)} />
        ) : null}
      </View>

      {selectorOpen ? (
        <RouteSelector
          routes={routeOptions}
          selectedCode={selectedRoute}
          filter={filter}
          onShow={showRoute}
          onClose={() => setSelectorOpen(false)}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.canvas,
  },
  center: {
    textAlign: 'center',
  },
  retry: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  top: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  bottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.sm,
  },
  buttons: {
    alignSelf: 'flex-end',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  notice: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  noticeButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeAction: {
    color: colors.primary,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...elevation.level3,
  },
  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
