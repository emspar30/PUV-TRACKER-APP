import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { BellRing, Bus, CircleCheck, Crosshair, LocateFixed, RadioTower, X, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, Vibration, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo, RoundButton, SkeletonCard, TopBar, type StatusTone } from '@/components';
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
import { RelayBar } from '@/features/report/RelayBar';
import { ReportSheet } from '@/features/report/ReportSheet';
import { useRelayBroadcast } from '@/features/report/useRelayBroadcast';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { placeOf, useCommuterPosition } from '@/features/map/useCommuterPosition';
import { useSkeleton } from '@/features/loading/useSkeleton';
import { useLiveLocation } from '@/features/map/useLiveLocation';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { TrackingLayers } from '@/features/tracking/TrackingLayers';
import { TrackingBar } from '@/features/tracking/TrackingBar';
import { TrackingPanel } from '@/features/tracking/TrackingPanel';
import { useRouteLayers } from '@/features/map/useRouteLayers';
import { useVehicles } from '@/features/vehicles/useVehicles';
import { VehicleMarkers } from '@/features/vehicles/VehicleMarkers';
import {
  ENERGY_TRACKING_COST,
  MAP_FOLLOW_ZOOM,
  MAX_WALK_PER_LEG_M,
  ROUTE_STOP_MAX_DISTANCE_M,
  TRACK_ALERT_ETA_S,
  TRACK_ARRIVED_M,
  TRACK_ARRIVED_PASS_M,
  TRACK_DISTANCE_ALERTS_M,
  TRACK_OTHERS_OPACITY,
  TRACKING_SESSION_MIN,
  SKELETON_MIN_MS,
} from '@/shared/config';
import { canReportWithGps } from '@/shared/checkin/geofence';
import { nearestStop } from '@/shared/routing/describe';
import { boundsOfLines, clipBounds } from '@/shared/geo/bounds';
import { projectOntoLine } from '@/shared/geo/line';
import { withReturnLegs } from '@/shared/routing/loop';
import type { RouteDirection } from '@/shared/routing/types';
import { isNight } from '@/shared/backend/rules';
import { ageSeconds, routeCoverage } from '@/shared/telemetry/coverage';
import { nextStopOf } from '@/shared/telemetry/nextStop';
import { seatTier } from '@/shared/telemetry/occupancy';
import { isStopped } from '@/shared/telemetry/stopped';
import { crossedDistance, crossesAlert, etaNow, etaTo, hasArrived, trackProgress } from '@/shared/tracking/eta';
import { inRouteOrder } from '@/shared/relay/broadcast';
import { routeCodesOf, stopsForRoute } from '@/shared/ui/routeVisibility';
import { startTrackingSession } from '@/state/energyStore';
import { showDialog } from '@/state/dialogStore';
import { useSessionStore } from '@/state/sessionStore';
import { useHintsStore } from '@/state/hintsStore';
import { useLocationStore } from '@/state/locationStore';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/state/toastStore';
import { useRelayStore } from '@/state/relayStore';
import { useTrackingStore } from '@/state/trackingStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md + spacing.xs;
// The route list shows each route's first, middle and last stop
const LIST_STOPS = 3;
const HALF = 2;
// Both directions always show; the vehicle icon tells which way each one goes
const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };

// Map tab (restyle of Live): a full-screen map with the top bar, an Explore card until a route is
// picked, the route list as a panel, the picked route's card on top, and a card for a tapped
// multicab or stop. Vehicles come from the repository: demo (AF3) or the database (L1).
export default function MapScreen() {
  const styles = useStyles();
  const { colors, typography, routeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, retry } = useOfflineTiles();
  const { lines, stops } = useRouteData();
  // B8: the bottom card shows a skeleton on the first visit
  const loadingCard = useSkeleton(SKELETON_MIN_MS);

  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [bottomHeight, setBottomHeight] = useState(0);
  const [topHeight, setTopHeight] = useState(0);
  // B8: the round buttons sit at the right, above the card: they do not take map height
  const [buttonsHeight, setButtonsHeight] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const seatFilter = useSettingsStore((store) => store.seatFilter);
  const arrivalAlert = useSettingsStore((store) => store.arrivalAlert);
  const defaultRoute = useSettingsStore((store) => store.defaultRoute);
  const [filter, setFilter] = useState<VehicleFilter>(seatFilter ? 'seats' : 'all');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  // L2, B2: the tracked multicab and its alerts live in a store, so picking another route never
  // ends tracking; only Stop or the end of the paid session (SB2) does
  const trackedId = useTrackingStore((store) => store.vehicleId);
  const trackedRoute = useTrackingStore((store) => store.routeCode);
  const trackEndsAtMs = useTrackingStore((store) => store.endsAtMs);
  const alertOn = useTrackingStore((store) => store.alertOn);
  const setAlertOn = useTrackingStore((store) => store.setAlertOn);
  const startTrack = useTrackingStore((store) => store.start);
  const stopTracking = useTrackingStore((store) => store.stop);
  const previousEtaS = useRef<number | null>(null);
  const previousKm = useRef<number | null>(null);
  // A guard so one tap never pays twice
  const startingTrack = useRef(false);
  const dismissHint = useHintsStore((store) => store.dismiss);
  const fittedOnce = useRef(false);

  const repos = useRepositories();
  const teamAccount = useSessionStore((state) => state.teamAccount);
  const location = useLiveLocation((center) =>
    setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center, zoom: MAP_FOLLOW_ZOOM })),
  );

  const layers = useRouteLayers(lines, stops, 'live', selectedRoute);
  const directions = ALL_DIRECTIONS;

  // Tabs stay mounted; vehicles refresh only while Map is the tab in front
  const focused = useIsFocused();
  const live = useVehicles(repos.vehicles, focused ? selectedRoute : null);
  // B2: each route with one stored leg also has its stand-in other leg, so ETAs follow a vehicle round
  const loopLines = useMemo(() => withReturnLegs(lines), [lines]);
  // The tracked multicab's own feed, kept running on another route and on other tabs, so its alerts
  // still come; on its own route with Map in front, the route's feed already has it
  const onTrackedRoute = trackedRoute !== null && trackedRoute === selectedRoute;
  const trackedFeed = useVehicles(repos.vehicles, trackedRoute && !(focused && onTrackedRoute) ? trackedRoute : null);
  const trackSource = focused && onTrackedRoute ? live : trackedFeed;
  const trackedStops = useMemo(() => stopsForRoute(lines, stops, trackedRoute), [lines, stops, trackedRoute]);
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
  // G0: a mock or stale fix does not count (the screen redraws at least every live tick)
  const fix = useLocationStore((store) => store.fix);
  const gpsAvailable = canReportWithGps(placeOf(commuter, fix, live.nowMs));
  // B4: a relay sent with GPS shares the location until the rider reaches their destination
  const relay = useRelayBroadcast(commuter);
  const stopRelay = useRelayStore((store) => store.stop);
  const relayStopsOf = useCallback(
    (code: string) =>
      inRouteOrder(
        lines.filter((line) => line.routeCode === code).map((line) => line.coordinates),
        stopsForRoute(lines, stops, code),
      ),
    [lines, stops],
  );
  // The stop of the tracked route nearest to the commuter, shown as "Your stop"
  const myStop = commuter && trackedRoute ? (nearestStop(trackedStops, commuter)?.stop ?? null) : null;
  // A session lasts TRACKING_SESSION_MIN; tapping Track again starts (and pays for) a new one
  const sessionOver = trackedId !== null && trackSource.nowMs >= trackEndsAtMs;
  useEffect(() => {
    if (sessionOver) stopTracking();
  }, [sessionOver, stopTracking]);
  const tracked = trackedId && !sessionOver ? (trackSource.vehicles.find((candidate) => candidate.id === trackedId) ?? null) : null;
  const trackedProgress = tracked ? trackProgress(tracked, loopLines, trackedStops, myStop) : { passed: null, next: null, mine: myStop };
  // The rider may walk to the route, so the boarding point may be up to a walk away from the line
  const etaToMe = tracked && commuter ? etaTo(tracked, loopLines, commuter, MAX_WALK_PER_LEG_M) : null;
  // No usable boarding point (no position, outside the map, or not on this route): the ETA to the
  // vehicle's next stop instead, so tracking always shows a time while the vehicle is on its line
  const etaToNext =
    tracked && (!etaToMe || etaToMe.kind === 'unknown') && trackedProgress.next
      ? etaTo(tracked, loopLines, trackedProgress.next, ROUTE_STOP_MAX_DISTANCE_M)
      : null;
  const measuredEta = etaToNext?.kind === 'approaching' ? etaToNext : etaToMe;
  const etaTarget: 'mine' | 'next' = etaToNext?.kind === 'approaching' ? 'next' : 'mine';
  // L2: counted down by the age of the last packet, and hidden once the vehicle is no longer Live
  const trackedEta = measuredEta && tracked ? etaNow(measuredEta, ageSeconds(tracked.lastPacketMs, trackSource.nowMs)) : measuredEta;
  // The arrival alert is for the commuter's own boarding point only
  const trackedEtaS = trackedEta?.kind === 'approaching' && etaTarget === 'mine' ? trackedEta.etaS : null;

  // A short vibration once, when the ETA first reaches the alert threshold
  useEffect(() => {
    if (alertOn && crossesAlert(previousEtaS.current, trackedEtaS, TRACK_ALERT_ETA_S)) Vibration.vibrate();
    previousEtaS.current = trackedEtaS;
  }, [alertOn, trackedEtaS]);

  // B2: a toast and a short vibration as the multicab comes within 1 km, 500 m, 250 m and 100 m of
  // the commuter, while the alert is on. In-app only, on any tab. When it reaches the commuter's
  // boarding point (or went by between readings), tracking ends by itself, alert on or off.
  const trackedKm = measuredEta?.kind === 'approaching' && etaTarget === 'mine' ? measuredEta.distanceKm : null;
  const trackedLabel = tracked?.label ?? null;
  useEffect(() => {
    const previous = previousKm.current;
    previousKm.current = trackedKm;
    if (hasArrived(previous, trackedKm, TRACK_ARRIVED_M, TRACK_ARRIVED_PASS_M)) {
      previousKm.current = null;
      stopTracking();
      Vibration.vibrate();
      showToast({
        icon: CircleCheck,
        title: strings.live.tracking.arrivedTitle,
        body: trackedLabel ? strings.live.tracking.arrivedBody(trackedLabel) : undefined,
      });
      return;
    }
    const crossedM = alertOn ? crossedDistance(previous, trackedKm, TRACK_DISTANCE_ALERTS_M) : null;
    if (crossedM === null) return;
    Vibration.vibrate();
    showToast({
      icon: BellRing,
      title: strings.live.tracking.nearTitle(strings.checkin.distance(crossedM)),
      body: trackedLabel ? strings.live.tracking.nearBody(trackedLabel) : undefined,
    });
  }, [alertOn, trackedKm, trackedLabel, stopTracking]);

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
    setSelectedVehicle(null);
    setSelectedStop(null);
    setSelectorOpen(false);
    dismissHint('live');
    frame(code);
  };

  // SB2: tracking one PUV is paid with Energy (free while Energy is off); signing in comes first
  // on live data (D6)
  const startTracking = async (id: string) => {
    const routeCode = live.vehicles.find((candidate) => candidate.id === id)?.routeCode ?? selectedRoute;
    if (startingTrack.current || !routeCode) return;
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
    startTrack({ vehicleId: id, routeCode, endsAtMs: session.endsAtMs, alertOn: arrivalAlert });
    setSelectedVehicle(id);
    previousEtaS.current = null;
    previousKm.current = null;
    if (target && commuter) {
      const bounds = boundsOfLines([[[target.lon, target.lat], [commuter.lon, commuter.lat]]]);
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds }));
    }
  };

  // B2: back to the tracked multicab from anywhere on the map: its route, centred on the vehicle
  const jumpToTracked = () => {
    if (!trackedRoute) return;
    if (trackedRoute !== selectedRoute) {
      setSelectedRoute(trackedRoute);
      setSelectedStop(null);
    }
    setSelectedVehicle(trackedId);
    if (tracked) setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: tracked, zoom: MAP_FOLLOW_ZOOM }));
    else frame(trackedRoute);
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
      setSelectedVehicle(null);
      setSelectedStop(null);
        setSelectorOpen(false);
      const bounds = clipBounds(boundsOfLines(ofRoute.map((line) => line.coordinates)), TILESET.bounds);
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds }));
    }
  }

  const selectStop = useCallback(
    (code: string | null) => {
      setSelectedStop(code);
      setSelectedVehicle(null);
      const stop = stops.find((candidate) => candidate.code === code);
      if (stop) setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: stop }));
    },
    [stops],
  );

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

  // L1: at night the server shows only stopped multicabs (PRD 10.4), so an empty live route says
  // Night Mode rather than No data. The server decides; this only labels it.
  const night = repos.vehicles.source === 'live' && isNight(live.nowMs);
  // Live vehicles are for team accounts only in v0; a signed-in account off the list is told why
  const teamOnly = repos.vehicles.source === 'live' && teamAccount === false && coverage.coverage === 'none';
  const status: { label: string; tone: StatusTone } =
    coverage.coverage === 'live'
      ? { label: strings.live.active.count(vehicles.length), tone: 'success' }
      : coverage.coverage === 'stale'
        ? { label: strings.live.status.stale(strings.live.age(coverage.youngestAgeS ?? 0)), tone: 'warning' }
        : { label: night ? strings.live.status.night : strings.live.status.noData, tone: 'neutral' };
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
        bottomInset={Math.max(bottomHeight - buttonsHeight - spacing.sm, 0) + spacing.md}
        topInset={insets.top + spacing.sm + topHeight}
        attributionTop={insets.top + spacing.sm + topHeight + spacing.sm}
        onStatusChange={handleStatusChange}
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
            labels={state.tiles.glyphsUrl !== null}
            selectedId={onTrackedRoute ? trackedId : selectedVehicle}
            othersOpacity={onTrackedRoute ? TRACK_OTHERS_OPACITY : 1}
            onPressVehicle={(id) => {
              if (onTrackedRoute) return;
              setSelectedVehicle(id);
              setSelectedStop(null);
            }}
          />
        ) : null}
        {commuter && selectedRoute ? (
          <TrackingLayers
            commuter={commuter}
            showPin={commuter.source !== 'gps'}
            vehicle={onTrackedRoute ? tracked : null}
            line={onTrackedRoute && tracked ? (loopLines.find((line) => line.id === tracked.lineId) ?? null) : null}
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
            note={
              teamOnly
                ? strings.live.status.teamOnly
                : night
                  ? coverage.coverage === 'none'
                    ? strings.live.status.nightHidden
                    : strings.live.status.night
                  : null
            }
            onClose={hideRoute}
          />
        ) : null}
      </View>

      <View style={styles.bottom} onLayout={(event) => setBottomHeight(event.nativeEvent.layout.height)} pointerEvents="box-none">
        <View style={styles.buttons} pointerEvents="box-none" onLayout={(event) => setButtonsHeight(event.nativeEvent.layout.height)}>
          {trackedId ? <RoundButton icon={Crosshair} label={strings.live.tracking.jumpTo} onPress={jumpToTracked} active /> : null}
          <RoundButton icon={RadioTower} label={strings.report.title} onPress={() => setReportOpen(true)} />
          <RoundButton icon={Bus} label={strings.live.selector.open} onPress={() => setSelectorOpen(true)} />
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
        {relay ? <RelayBar routeCode={relay.routeCode} destination={relay.destination.name} onStop={stopRelay} /> : null}
        {trackedId && trackedRoute && !onTrackedRoute ? (
          <TrackingBar
            label={tracked?.label ?? null}
            routeCode={trackedRoute}
            eta={trackedEta?.kind === 'approaching' ? strings.live.tracking.minutes(trackedEta.etaS) : null}
            onPress={jumpToTracked}
          />
        ) : null}
        {/* The bottom card slides up whenever it changes (tracking, a vehicle, a stop, explore) */}
        <Animated.View
          key={loadingCard ? 'skeleton' : onTrackedRoute && trackedId ? 'track' : vehicle ? `vehicle-${vehicle.id}` : stop ? `stop-${stop.code}` : selectedRoute ? 'none' : 'explore'}
          entering={FadeInDown.duration(motion.cardMs)}
        >
          {loadingCard ? (
          <SkeletonCard />
        ) : onTrackedRoute && trackedId ? (
          <TrackingPanel
            vehicle={tracked}
            nowMs={live.nowMs}
            eta={trackedEta}
            progress={trackedProgress}
            etaTarget={etaTarget}
            alertOn={alertOn}
            alertMessage={
              alertOn && trackedEtaS !== null && trackedEtaS <= TRACK_ALERT_ETA_S
                ? strings.live.tracking.alertNow(strings.live.tracking.minutes(trackedEtaS))
                : null
            }
            onToggleAlert={() => setAlertOn(!alertOn)}
            onStop={stopTracking}
          />
        ) : vehicle ? (
          <VehicleCard
            vehicle={vehicle}
            nowMs={live.nowMs}
            nextStop={nextStopOf(vehicle, loopLines, layers.stops)?.code ?? null}
            stopped={vehicle.layover === true || isStopped(vehicle.recentSpeeds, vehicle.lastPacketMs)}
            eta={(() => {
              const eta = commuter ? etaNow(etaTo(vehicle, loopLines, commuter, MAX_WALK_PER_LEG_M), ageSeconds(vehicle.lastPacketMs, live.nowMs)) : null;
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
        </Animated.View>
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
          stopsOf={relayStopsOf}
          position={commuter}
          gpsAvailable={gpsAvailable}
          checkGps={() => canReportWithGps(placeOf(commuter, useLocationStore.getState().fix, Date.now()))}
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
