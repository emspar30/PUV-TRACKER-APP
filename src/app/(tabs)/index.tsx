import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { Bus, LocateFixed, Maximize, Megaphone, X, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, Vibration, View } from 'react-native';
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
import { ReportSheet } from '@/features/report/ReportSheet';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useCommuterPosition } from '@/features/map/useCommuterPosition';
import { useLiveLocation } from '@/features/map/useLiveLocation';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { TrackingLayers } from '@/features/tracking/TrackingLayers';
import { TrackingPanel } from '@/features/tracking/TrackingPanel';
import { useRouteLayers } from '@/features/map/useRouteLayers';
import { useVehicles } from '@/features/vehicles/useVehicles';
import { VehicleMarkers } from '@/features/vehicles/VehicleMarkers';
import {
  ENERGY_TRACKING_COST,
  MAP_FOLLOW_ZOOM,
  MAX_WALK_PER_LEG_M,
  TRACK_ALERT_ETA_S,
  TRACK_OTHERS_OPACITY,
  TRACKING_SESSION_MIN,
} from '@/shared/config';
import { canReportWithGps } from '@/shared/checkin/geofence';
import { nearestStop } from '@/shared/routing/describe';
import { boundsOfLines, clipBounds } from '@/shared/geo/bounds';
import { projectOntoLine } from '@/shared/geo/line';
import type { RouteDirection } from '@/shared/routing/types';
import { ageSeconds, routeCoverage } from '@/shared/telemetry/coverage';
import { nextStopOf } from '@/shared/telemetry/nextStop';
import { seatTier } from '@/shared/telemetry/occupancy';
import { isStopped } from '@/shared/telemetry/stopped';
import { crossesAlert, etaTo, trackProgress } from '@/shared/tracking/eta';
import { routeCodesOf } from '@/shared/ui/routeVisibility';
import { startTrackingSession } from '@/state/energyStore';
import { showDialog } from '@/state/dialogStore';
import { useHintsStore } from '@/state/hintsStore';
import { useLocationStore } from '@/state/locationStore';
import { useSettingsStore } from '@/state/settingsStore';
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
  const [topHeight, setTopHeight] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [directionView, setDirectionView] = useState<DirectionView>('both');
  const seatFilter = useSettingsStore((store) => store.seatFilter);
  const arrivalAlert = useSettingsStore((store) => store.arrivalAlert);
  const defaultRoute = useSettingsStore((store) => store.defaultRoute);
  const [filter, setFilter] = useState<VehicleFilter>(seatFilter ? 'seats' : 'all');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_VEHICLE_ZOOM);
  // L2: the tracked multicab and the in-app arrival alert
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [alertOn, setAlertOn] = useState(false);
  const previousEtaS = useRef<number | null>(null);
  // SB2: when the paid session ends, and a guard so one tap never pays twice
  const [trackEndsAtMs, setTrackEndsAtMs] = useState(Number.POSITIVE_INFINITY);
  const startingTrack = useRef(false);
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

  // G0: the commuter's GPS fix, a simulated stop (Demo settings) or a long-press pin
  const commuter = useCommuterPosition();
  // RP1: the Report panel; "with GPS" needs a good fix or the simulated stop
  const [reportOpen, setReportOpen] = useState(false);
  const fixAccuracyM = useLocationStore((store) => store.fix?.accuracyM ?? null);
  const gpsAvailable = canReportWithGps(commuter ? { ...commuter, accuracyM: commuter.source === 'gps' ? fixAccuracyM : null } : null);
  // The stop of the picked route nearest to the commuter, shown as "Your stop"
  const myStop = commuter && selectedRoute ? (nearestStop(layers.stops, commuter)?.stop ?? null) : null;
  // A session lasts TRACKING_SESSION_MIN; tapping Track again starts (and pays for) a new one
  if (trackedId && live.nowMs >= trackEndsAtMs) {
    setTrackedId(null);
    setAlertOn(false);
  }
  const tracked = trackedId ? (live.vehicles.find((candidate) => candidate.id === trackedId) ?? null) : null;
  // The rider may walk to the route, so the boarding point may be up to a walk away from the line
  const trackedEta = tracked && commuter ? etaTo(tracked, lines, commuter, MAX_WALK_PER_LEG_M) : null;
  const trackedEtaS = trackedEta?.kind === 'approaching' ? trackedEta.etaS : null;

  // A short vibration once, when the ETA first reaches the alert threshold
  useEffect(() => {
    if (alertOn && crossesAlert(previousEtaS.current, trackedEtaS, TRACK_ALERT_ETA_S)) Vibration.vibrate();
    previousEtaS.current = trackedEtaS;
  }, [alertOn, trackedEtaS]);

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
    setTrackedId(null);
    setSelectorOpen(false);
    dismissHint('live');
    frame(code);
  };

  // SB2: tracking one PUV is paid with Energy (free while Energy is off); signing in comes first
  // on live data (D6)
  const startTracking = async (id: string) => {
    if (startingTrack.current) return;
    startingTrack.current = true;
    const session = await startTrackingSession();
    startingTrack.current = false;
    if (!session.ok) {
      if (session.reason === 'sign_in') router.push('/sign-in');
      else if (session.reason === 'not_enough_energy')
        // The crowdsourcing loop: a report earns the Energy that tracking spends
        showDialog({
          tone: 'warning',
          icon: Zap,
          title: strings.live.tracking.noEnergyTitle,
          body: strings.live.tracking.noEnergyBody(ENERGY_TRACKING_COST, TRACKING_SESSION_MIN),
          actions: [
            { label: strings.live.tracking.earnByReporting, onPress: () => setReportOpen(true) },
            { label: strings.common.close, variant: 'secondary' },
          ],
        });
      else showDialog({ tone: 'danger', title: strings.live.tracking.failedTitle, body: session.message ?? strings.checkin.failedBody });
      return;
    }
    const target = live.vehicles.find((candidate) => candidate.id === id);
    setTrackEndsAtMs(session.endsAtMs);
    setTrackedId(id);
    setSelectedVehicle(id);
    setAlertOn(arrivalAlert);
    previousEtaS.current = null;
    if (target && commuter) {
      const bounds = boundsOfLines([[[target.lon, target.lat], [commuter.lon, commuter.lat]]]);
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds }));
    }
  };

  const stopTracking = () => {
    setTrackedId(null);
    setAlertOn(false);
  };

  // The simulated position (Demo settings) is centred directly; otherwise the GPS flow of G0:
  // the explainer and permission prompt the first time, then follow the fix
  const locate = () => {
    if (commuter?.source === 'simulated') {
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: commuter, zoom: MAP_FOLLOW_ZOOM }));
      return;
    }
    location.locateMe();
  };

  // Settings, Default route: picked once when the Map first opens
  const [defaultApplied, setDefaultApplied] = useState(false);
  if (!defaultApplied && defaultRoute && lines.some((line) => line.routeCode === defaultRoute)) {
    setDefaultApplied(true);
    setSelectedRoute(defaultRoute);
  }

  const hideRoute = () => {
    setTrackedId(null);
    setSelectedRoute(null);
    setSelectedVehicle(null);
    setSelectedStop(null);
    frame(null);
  };

  // "View R4 on Map" from My Rides opens this tab with that route. Each tap carries a new time
  // stamp; it is applied once, while rendering, with no effect.
  const params = useLocalSearchParams<{ route?: string; at?: string }>();
  const [appliedRequest, setAppliedRequest] = useState<string | undefined>(undefined);
  if (params.at !== undefined && params.at !== appliedRequest) {
    setAppliedRequest(params.at);
    const ofRoute = lines.filter((line) => line.routeCode === params.route);
    if (params.route && ofRoute.length > 0) {
      setSelectedRoute(params.route);
      setFilter('all');
      setDirectionView('both');
      setSelectedVehicle(null);
      setSelectedStop(null);
      setTrackedId(null);
      setSelectorOpen(false);
      const bounds = clipBounds(boundsOfLines(ofRoute.map((line) => line.coordinates)), TILESET.bounds);
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds }));
    }
  }

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
        attributionTop={insets.top + spacing.sm + topHeight + spacing.sm}
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
            selectedId={trackedId ?? selectedVehicle}
            othersOpacity={trackedId ? TRACK_OTHERS_OPACITY : 1}
            onPressVehicle={(id) => {
              if (trackedId) return;
              setSelectedVehicle(id);
              setSelectedStop(null);
            }}
          />
        ) : null}
        {commuter && selectedRoute ? (
          <TrackingLayers
            commuter={commuter}
            showPin={commuter.source !== 'gps'}
            vehicle={tracked}
            line={tracked ? (lines.find((line) => line.id === tracked.lineId) ?? null) : null}
            labels={state.tiles.glyphsUrl !== null}
          />
        ) : null}
        {!location.locationAllowed ? <OriginPin /> : null}
        <BlueDot />
      </OfflineMap>

      <View
        style={[styles.top, { top: insets.top + spacing.sm }]}
        pointerEvents="box-none"
        onLayout={(event) => setTopHeight(event.nativeEvent.layout.height)}
      >
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
          <Pressable style={styles.report} onPress={() => setReportOpen(true)} accessibilityRole="button" accessibilityLabel={strings.report.title}>
            <Megaphone color={colors.onPrimary} size={ICON_SIZE} />
            <Text style={[typography.labelLg, styles.reportText]}>{strings.report.button}</Text>
          </Pressable>
          <RoundButton icon={Bus} label={strings.live.selector.open} onPress={() => setSelectorOpen(true)} />
          {selectedRoute ? <RoundButton icon={Maximize} label={strings.map.showWholeRoute} onPress={() => frame(selectedRoute)} /> : null}
          <RoundButton
            icon={LocateFixed}
            label={location.following ? strings.location.following : strings.location.locateMe}
            onPress={locate}
            active={commuter?.source === 'simulated' || (location.following && location.locationAllowed)}
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
        {trackedId ? (
          <TrackingPanel
            vehicle={tracked}
            nowMs={live.nowMs}
            eta={trackedEta}
            progress={tracked ? trackProgress(tracked, lines, layers.stops, myStop) : { passed: null, next: null, mine: myStop }}
            alertOn={alertOn}
            alertMessage={
              alertOn && trackedEtaS !== null && trackedEtaS <= TRACK_ALERT_ETA_S
                ? strings.live.tracking.alertNow(strings.live.tracking.minutes(trackedEtaS))
                : null
            }
            onToggleAlert={() => setAlertOn((value) => !value)}
            onStop={stopTracking}
          />
        ) : vehicle ? (
          <VehicleCard
            vehicle={vehicle}
            nowMs={live.nowMs}
            nextStop={nextStopOf(vehicle, lines, layers.stops)?.code ?? null}
            stopped={vehicle.layover === true || isStopped(vehicle.recentSpeeds, vehicle.lastPacketMs)}
            eta={(() => {
              const eta = commuter ? etaTo(vehicle, lines, commuter, MAX_WALK_PER_LEG_M) : null;
              return eta?.kind === 'approaching' ? strings.live.tracking.minutes(eta.etaS) : null;
            })()}
            onTrack={() => void startTracking(vehicle.id)}
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

      {reportOpen ? (
        <ReportSheet
          routes={routeOptions}
          initialRoute={selectedRoute}
          vehicles={repos.vehicles.source === 'live' ? live.vehicles.map((item) => ({ id: item.id, label: item.label })) : []}
          gpsAvailable={gpsAvailable}
          onClose={() => setReportOpen(false)}
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
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  report: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    ...elevation.level3,
  },
  reportText: {
    color: colors.onPrimary,
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
