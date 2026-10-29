import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { BellRing, Bus, CircleCheck, Crosshair, LocateFixed, Minus, Plus, X, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, Vibration, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo, RoundButton, SkeletonCard, TopBar, type StatusTone } from '@/components';
import { useRepositories } from '@/data/live/useRepositories';
import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { ActiveRouteCard } from '@/features/live/ActiveRouteCard';
import { CoverageNudge } from '@/features/live/CoverageNudge';
import { TunieButton } from '@/features/assistant/TunieButton';
import { RouteSelector, type RouteOption, type VehicleFilter } from '@/features/live/RouteSelector';
import { NightStopsCard } from '@/features/live/NightStopsCard';
import { useNightPassages } from '@/features/live/useNightPassages';
import { VehicleCard } from '@/features/live/VehicleCard';
import { BlueDot } from '@/features/map/BlueDot';
import { LocationExplainer } from '@/features/map/LocationExplainer';
import { OfflineMap, type MapFocus } from '@/features/map/OfflineMap';
import { OriginPin } from '@/features/map/OriginPin';
import { RelayBar } from '@/features/report/RelayBar';
import { useGpsBroadcast } from '@/features/report/useGpsBroadcast';
import { useRelayBroadcast } from '@/features/report/useRelayBroadcast';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useCommuterPosition } from '@/features/map/useCommuterPosition';
import { useSkeleton } from '@/features/loading/useSkeleton';
import { useLiveLocation } from '@/features/map/useLiveLocation';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { TrackingLayers } from '@/features/tracking/TrackingLayers';
import { TourTarget } from '@/features/tour/TourTarget';
import { TrackingBar } from '@/features/tracking/TrackingBar';
import { TrackingPanel } from '@/features/tracking/TrackingPanel';
import { useTrackLocation } from '@/features/tracking/trackLocation';
import { useTabBarSpace } from '@/navigation/useTabBarSpace';
import { useRouteLayers } from '@/features/map/useRouteLayers';
import { useRoutesVehicles } from '@/features/vehicles/useRoutesVehicles';
import { useVehicles } from '@/features/vehicles/useVehicles';
import { useTourStore } from '@/state/tourStore';
import { promptSignIn } from '@/features/auth/promptSignIn';
import { VehicleMarkers } from '@/features/vehicles/VehicleMarkers';
import { useVehicleRelays } from '@/features/vehicles/useVehicleRelays';
import {
  ENERGY_TRACKING_COST,
  MAP_FOLLOW_ZOOM,
  MAP_MIN_ZOOM,
  MAP_OVERZOOM_LEVELS,
  MAP_ZOOM_STEP,
  MAX_WALK_PER_LEG_M,
  ROUTE_STOP_MAX_DISTANCE_M,
  TRACK_ALERT_ETA_S,
  TRACK_ARRIVED_M,
  TRACK_ARRIVED_PASS_M,
  TRACK_DISTANCE_ALERTS_M,
  TRACK_NEAR_BADGE_M,
  TRACK_OTHERS_OPACITY,
  TRACKING_SESSION_MIN,
  SKELETON_MIN_MS,
  TOUR_START_DELAY_MS,
} from '@/shared/config';
import { bestAlternative, overlappingRoutes } from '@/shared/routing/alternatives';
import { nearestStop } from '@/shared/routing/describe';
import { boundsOfLines, clipBounds } from '@/shared/geo/bounds';
import { haversineMeters, type LatLon } from '@/shared/geo/haversine';
import { projectOntoLine } from '@/shared/geo/line';
import { withReturnLegs } from '@/shared/routing/loop';
import type { RouteDirection } from '@/shared/routing/types';
import { isNight } from '@/shared/backend/rules';
import { ageSeconds, coverageOf, nudgeShown, routeCoverage } from '@/shared/telemetry/coverage';
import { displayPosition, isGhostAge } from '@/shared/telemetry/deadReckoning';
import { nextStopOf } from '@/shared/telemetry/nextStop';
import { seatTier } from '@/shared/telemetry/occupancy';
import { vehicleStatus } from '@/shared/telemetry/vehicleStatus';
import { crossedDistance, crossesAlert, etaDistanceKm, etaNow, etaTo, hasArrived, trackProgress } from '@/shared/tracking/eta';
import { routeCodesOf, stopsForRoute } from '@/shared/ui/routeVisibility';
import { startTrackingSession } from '@/state/energyStore';
import { showDialog } from '@/state/dialogStore';
import { useSessionStore } from '@/state/sessionStore';
import { useHintsStore } from '@/state/hintsStore';
import { useLocationStore } from '@/state/locationStore';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/state/toastStore';
import { useRelayFormStore } from '@/state/relayFormStore';
import { useRelayStore } from '@/state/relayStore';
import { useTrackingStore } from '@/state/trackingStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const LOGO_SIZE = spacing.xl * 3;
const KMH_PER_MPS = 3.6;
// CA1.1: a camera report within this many zoom levels of where the zoom buttons sent it has arrived
const ZOOM_SETTLED = 0.01;
const ICON_SIZE = spacing.md + spacing.xs;
// The route list shows each route's first, middle and last stop
const LIST_STOPS = 3;
const HALF = 2;
const METERS_PER_KM = 1000;
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
  // CA1.1: where the camera is (from the map's reports), and where the zoom buttons last sent it, so
  // quick taps add up before the camera reports back
  const view = useRef<{ center: LatLon; zoom: number } | null>(null);
  const aim = useRef<{ center: LatLon; zoom: number } | null>(null);
  // CA1.1: Locate zoomed in on the commuter and the map has not been moved since: the next tap zooms out
  const zoomedIn = useRef(false);
  const [bottomHeight, setBottomHeight] = useState(0);
  const [topHeight, setTopHeight] = useState(0);
  // B8: the round buttons sit at the right, above the card: they do not take map height
  const [buttonsHeight, setButtonsHeight] = useState(0);
  // When one column of round buttons would reach the cards at the top, + and - move to a second
  // column at its left. The map's own height, the right column's and the + and - group's.
  const [rootHeight, setRootHeight] = useState(0);
  const [column, setColumn] = useState({ height: 0, withZoom: true });
  const [zoomHeight, setZoomHeight] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  // CA1.1: the Map opens on the route last picked (kept on the phone), else All routes
  const [selectedRoute, setSelectedRoute] = useState<string | null>(() => useSettingsStore.getState().mapRoute);
  const setMapRoute = useSettingsStore((store) => store.setMapRoute);
  useEffect(() => setMapRoute(selectedRoute), [selectedRoute, setMapRoute]);
  const seatFilter = useSettingsStore((store) => store.seatFilter);
  // VS1: relays naming a multicab, for the status mark on its marker and the pill on its card
  const relays = useVehicleRelays();
  const arrivalAlert = useSettingsStore((store) => store.arrivalAlert);
  const [filter, setFilter] = useState<VehicleFilter>(seatFilter ? 'seats' : 'all');
  // The Map tab stays mounted, so turning the Seat filter on or off in Settings is applied here when
  // it changes (once, while rendering); a route's own filter chip still wins until the next change
  const [appliedSeatFilter, setAppliedSeatFilter] = useState(seatFilter);
  if (seatFilter !== appliedSeatFilter) {
    setAppliedSeatFilter(seatFilter);
    setFilter(seatFilter ? 'seats' : 'all');
  }
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

  // ST2-D: the tips tour starts by itself once, the first time the Map tab shows after the
  // introduction, when its controls are laid out
  const tourDone = useTourStore((state) => state.done);
  const tourRunning = useTourStore((state) => state.step !== null);
  const startTour = useTourStore((state) => state.start);
  useEffect(() => {
    if (tourDone || tourRunning || !focused) return;
    const timer = setTimeout(startTour, TOUR_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [tourDone, tourRunning, focused, startTour]);
  const live = useVehicles(repos.vehicles, focused ? selectedRoute : null);
  // CA1.1: with no route picked (All routes), the running multicabs of every route; a tap on one picks
  // its route
  const overviewRoutes = useMemo(() => routeCodesOf(lines), [lines]);
  const overview = useRoutesVehicles(repos.vehicles, overviewRoutes, !focused || selectedRoute !== null);
  const overviewVehicles = useMemo(
    () =>
      overview.vehicles.filter(
        (vehicle) =>
          coverageOf(ageSeconds(vehicle.lastPacketMs, overview.nowMs)) !== 'none' && (filter === 'all' || seatTier(vehicle.seatsTaken) === 'green'),
      ),
    [overview.vehicles, overview.nowMs, filter],
  );
  // B2: each route with one stored leg also has its stand-in other leg, so ETAs follow a vehicle round
  const loopLines = useMemo(() => withReturnLegs(lines), [lines]);
  // CA1.1 relay details: the lines of the route being relayed, both directions
  const relayRoute = useRelayStore((store) => store.session?.routeCode ?? null);
  const relayLines = useMemo(
    () => loopLines.filter((line) => line.routeCode === relayRoute).map((line) => line.coordinates),
    [loopLines, relayRoute],
  );
  // CF1: each vehicle's line by its id (return legs included), so an Estimated marker moves along it
  const lineOf = useMemo(() => {
    const byId = new Map(loopLines.map((line) => [line.id, line.coordinates]));
    return (lineId: string) => byId.get(lineId);
  }, [loopLines]);
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
  const trackLocation = useTrackLocation(focused);
  // Emjay, 2026-10-26: Relay is the middle button of the bottom bar; the Map opens the same form
  const openRelayForm = useRelayFormStore((store) => store.show);
  const fix = useLocationStore((store) => store.fix);
  // B4: a relay runs until the rider reaches their destination
  const relay = useRelayBroadcast(commuter);
  // T1: a team account's relay on the live map moves its multicab's marker; buffered through dead
  // zones. RL2a: a Crowdsource relay sends no positions
  const uplink = useGpsBroadcast(relay?.mode === 'live' ? relay : null, repos.vehicles.source === 'live' && teamAccount === true);

  // L1: at night the server shows only stopped multicabs (PRD 10.4), so an empty live route says
  // Night Mode rather than No data. The server decides; this only labels it.
  const night = repos.vehicles.source === 'live' && isNight(live.nowMs);
  // NM1 (PRD 10.4): at night, live or demo, the picked route shows the stops its multicabs passed
  const nightStops = useNightPassages(repos.vehicles, focused && selectedRoute && isNight(live.nowMs) ? selectedRoute : null);
  // Live vehicles are for team accounts only in v0; a signed-in account off the list is told why
  const offTeam = repos.vehicles.source === 'live' && teamAccount === false;
  // CF1 coverage nudge: the picked route has no Live multicab (whatever the seat filter), by day,
  // for anyone who could see one. Overlapping routes are then watched for an alternative nearby.
  const nudgeOn =
    focused &&
    nudgeShown({ routePicked: selectedRoute !== null, lastPacketsMs: live.vehicles.map((item) => item.lastPacketMs), nowMs: live.nowMs, night, offTeam });
  const overlapping = useMemo(() => (selectedRoute ? overlappingRoutes(stops, selectedRoute) : []), [stops, selectedRoute]);
  const others = useRoutesVehicles(repos.vehicles, overlapping, !nudgeOn);
  const alternative = useMemo(
    () =>
      nudgeOn && selectedRoute
        ? bestAlternative({ routeCode: selectedRoute, lines, stops, vehicles: others.vehicles, nowMs: others.nowMs, anchor: commuter })
        : null,
    [nudgeOn, selectedRoute, lines, stops, others.vehicles, others.nowMs, commuter],
  );
  const stopRelay = useRelayStore((store) => store.stop);
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
  // vehicle's next stop instead, so tracking always shows a time while the vehicle is on its line.
  // Only then: a multicab that has gone past the commuter keeps its distance round to them, so the
  // panel never shows the next stop's falling distance as if it were the commuter's (Emjay, 2026-10-26)
  const etaToNext =
    tracked && (!etaToMe || (etaToMe.kind === 'unknown' && etaToMe.reason === 'off_line')) && trackedProgress.next
      ? etaTo(tracked, loopLines, trackedProgress.next, ROUTE_STOP_MAX_DISTANCE_M)
      : null;
  const measuredEta = etaToNext?.kind === 'approaching' ? etaToNext : etaToMe;
  const etaTarget: 'mine' | 'next' = etaToNext?.kind === 'approaching' ? 'next' : 'mine';
  // Already past the commuter on its current leg: whatever distance shows is to its next time round
  const trackedPassedMe = tracked && commuter ? etaTo(tracked, loopLines, commuter, MAX_WALK_PER_LEG_M, { round: false }).kind === 'passed' : false;
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
  // The measured distance to the commuter, also while the ETA is hidden (slow, too far; PRD 19.4)
  const trackedKm = etaDistanceKm(etaToMe);
  // CA1.1: the Map tab's red dot, seen from every tab, while the tracked multicab is near
  const trackedNear = trackedKm !== null && trackedKm * METERS_PER_KM <= TRACK_NEAR_BADGE_M;
  const setTrackedNear = useTrackingStore((store) => store.setNear);
  useEffect(() => setTrackedNear(trackedNear), [trackedNear, setTrackedNear]);
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
  // A remembered route that newer route data no longer has: back to All routes
  if (selectedRoute && lines.length > 0 && !lines.some((line) => line.routeCode === selectedRoute)) setSelectedRoute(null);
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
        // EQ-13: the route's name without the leg ("Route 1 (Bancasi - Downtown)"), as in My Rides
        return { code, name: main.name.split(',')[0] ?? main.name, color: colorOfRoute(code), stops: picks.map((stop) => stop.code) };
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

  // CA1.1: "All routes" in the selector: no route picked, every shown route's multicabs on the map
  const showAllRoutes = () => {
    setSelectedRoute(null);
    setSelectedVehicle(null);
    setSelectedStop(null);
    setSelectorOpen(false);
    dismissHint('live');
    setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds: initialBounds }));
  };

  // SB2: tracking one PUV is paid with Energy (free while Energy is off). AU1: everyone here is
  // signed in; the server can still answer that the session is gone
  const startTracking = async (id: string) => {
    const routeCode = live.vehicles.find((candidate) => candidate.id === id)?.routeCode ?? selectedRoute;
    if (startingTrack.current || !routeCode) return;
    // Emjay, 2026-10-26: no tracking (and no Energy spent) without the phone's location; Track is
    // greyed out then, so this only catches a tap in the moment before the setting is read again
    if (trackLocation.status !== 'on') return;
    startingTrack.current = true;
    const session = await startTrackingSession();
    startingTrack.current = false;
    if (!session.ok) {
      if (session.reason === 'sign_in') promptSignIn();
      else if (session.reason === 'not_enough_energy')
        // The crowdsourcing loop: a report earns the Energy that tracking spends
        showDialog({
          tone: 'warning',
          icon: Zap,
          title: strings.live.tracking.noEnergyTitle,
          body: strings.live.tracking.noEnergyBody(ENERGY_TRACKING_COST, TRACKING_SESSION_MIN),
          actions: [
            { label: strings.live.tracking.earnByReporting, onPress: openRelayForm },
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
  // CA1.1: a second tap (with the map not moved since) zooms out as far as it goes, still on the
  // commuter. A simulated stop or a dropped pin is centred directly. A GPS position outside the Butuan
  // map (an emulator's default location is in California) cannot be shown: the commuter is told so,
  // and the map shows all of Butuan instead of doing nothing.
  const locate = () => {
    if (zoomedIn.current && commuter) {
      zoomedIn.current = false;
      location.stopFollowing();
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: commuter, zoom: MAP_MIN_ZOOM }));
      return;
    }
    // A simulated position (Demo & simulation) or a dropped pin comes before the GPS
    if (commuter && commuter.source !== 'gps') {
      zoomedIn.current = true;
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: commuter, zoom: MAP_FOLLOW_ZOOM }));
      return;
    }
    if (location.locationAllowed && location.fix && !location.fixOnMap) {
      zoomedIn.current = false;
      showToast({ icon: LocateFixed, title: strings.location.outsideMapTitle, body: strings.location.outsideMapBody });
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds: initialBounds }));
      return;
    }
    zoomedIn.current = commuter !== null;
    location.locateMe();
  };

  // CA1.1: + and - zoom one step about the middle of the map
  const zoomBy = (levels: number) => {
    const from = aim.current ?? view.current;
    if (!from) return;
    const zoom = Math.min(Math.max(from.zoom + levels, MAP_MIN_ZOOM), TILESET.maxZoom + MAP_OVERZOOM_LEVELS);
    aim.current = { center: from.center, zoom };
    zoomedIn.current = false;
    setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: from.center, zoom }));
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

  // Once the map is ready and the bottom card measured, frame the remembered route, or all routes, above it
  const handleStatusChange = useCallback(() => {
    if (fittedOnce.current) return;
    fittedOnce.current = true;
    frame(selectedRoute);
  }, [frame, selectedRoute]);

  // The map runs under the floating bottom bar (2026-10-26); the cards and buttons stay above it
  const bottomGap = useTabBarSpace().above;
  // Height free for the buttons: between the cards at the top and the card at the bottom
  const buttonsRoom =
    rootHeight - (insets.top + spacing.sm + topHeight + spacing.sm) - Math.max(bottomHeight - buttonsHeight, 0) - bottomGap;
  // The height of all the buttons in one column, whichever way they were laid out when measured
  const oneColumnHeight = column.withZoom ? column.height : column.height + spacing.sm + zoomHeight;
  const zoomBeside = rootHeight > 0 && oneColumnHeight > buttonsRoom;

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

  const teamOnly = offTeam && coverage.coverage === 'none';
  const status: { label: string; tone: StatusTone } =
    coverage.coverage === 'live'
      ? { label: strings.live.active.count(vehicles.length), tone: 'success' }
      : coverage.coverage === 'stale'
        ? { label: strings.live.status.stale(strings.live.age(coverage.youngestAgeS ?? 0)), tone: 'warning' }
        : { label: night ? strings.live.status.night : strings.live.status.noData, tone: 'neutral' };
  const vehicle = vehicles.find((candidate) => candidate.id === selectedVehicle) ?? null;
  // The tapped multicab's ETA to the commuter, and how far it is from them (PRD 7.4): along the
  // route when the line reaches them, else in a straight line
  const vehicleEta = vehicle && commuter ? etaNow(etaTo(vehicle, loopLines, commuter, MAX_WALK_PER_LEG_M), ageSeconds(vehicle.lastPacketMs, live.nowMs)) : null;
  const vehicleKm = vehicle && commuter ? (etaDistanceKm(vehicleEta) ?? haversineMeters(vehicle, commuter) / METERS_PER_KM) : null;
  const stop = stops.find((candidate) => candidate.code === selectedStop) ?? null;
  // CA1.1: a card or bar under the buttons (a multicab, a stop, tracking, a relay, a location notice):
  // Tunie stays round then, so the column takes less room; with none it shows "Ask Tunie"
  const infoCardShown =
    loadingCard ||
    vehicle !== null ||
    stop !== null ||
    (onTrackedRoute && trackedId !== null) ||
    relay !== null ||
    (trackedId !== null && trackedRoute !== null && !onTrackedRoute) ||
    location.showExplainer ||
    location.reducedMode;
  const selectedOption = routeOptions.find((option) => option.code === selectedRoute) ?? null;
  const zoomButtons = (
    <TourTarget id="zoom" style={styles.zoom}>
      <View style={styles.zoom} onLayout={(event) => setZoomHeight(event.nativeEvent.layout.height)}>
        <RoundButton icon={Plus} label={strings.live.zoomIn} onPress={() => zoomBy(MAP_ZOOM_STEP)} />
        <RoundButton icon={Minus} label={strings.live.zoomOut} onPress={() => zoomBy(-MAP_ZOOM_STEP)} />
      </View>
    </TourTarget>
  );

  return (
    <View style={styles.root} onLayout={(event) => setRootHeight(event.nativeEvent.layout.height)}>
      <OfflineMap
        tilesUrl={state.tiles.url}
        glyphsUrl={state.tiles.glyphsUrl}
        labelsDimmed={selectedRoute !== null}
        initialBounds={initialBounds}
        focus={focus}
        bottomInset={Math.max(bottomHeight - buttonsHeight - spacing.sm, 0) + bottomGap}
        topInset={insets.top + spacing.sm + topHeight}
        attributionTop={insets.top + spacing.sm + topHeight + spacing.sm}
        onStatusChange={handleStatusChange}
        onLongPress={location.setManualOrigin}
        onUserMove={() => {
          zoomedIn.current = false;
          aim.current = null;
          location.stopFollowing();
        }}
        onViewChange={(event) => {
          view.current = { center: { lon: event.center[0], lat: event.center[1] }, zoom: event.zoom };
          if (aim.current && Math.abs(event.zoom - aim.current.zoom) < ZOOM_SETTLED) aim.current = null;
        }}
      >
        <RouteLines lines={layers.lines} visible={directions} opacity={layers.opacity} />
        <StopDots stops={layers.stops} selectedCode={selectedStop} onPressStop={selectStop} />
        {!selectedRoute ? (
          <VehicleMarkers
            vehicles={overviewVehicles}
            nowMs={overview.nowMs}
            color={colors.primary}
            labels={state.tiles.glyphsUrl !== null}
            lineOf={lineOf}
            relays={relays}
            onPressVehicle={(id) => {
              const picked = overviewVehicles.find((candidate) => candidate.id === id);
              if (!picked) return;
              setSelectedRoute(picked.routeCode);
              setSelectedVehicle(id);
              setSelectedStop(null);
            }}
          />
        ) : null}
        {selectedRoute ? (
          <VehicleMarkers
            vehicles={vehicles}
            nowMs={live.nowMs}
            color={colorOfRoute(selectedRoute)}
            labels={state.tiles.glyphsUrl !== null}
            selectedId={onTrackedRoute ? trackedId : selectedVehicle}
            // CA1.1: one multicab picked (its card open) or tracked: the others fade, so it stands out
            othersOpacity={onTrackedRoute || selectedVehicle !== null ? TRACK_OTHERS_OPACITY : 1}
            lineOf={lineOf}
            relays={relays}
            onPressVehicle={(id) => {
              if (onTrackedRoute) return;
              setSelectedVehicle(id);
              setSelectedStop(null);
            }}
          />
        ) : null}
        {/* CA1.1: the commuter's "You" dot on All routes too (a simulated or pinned spot has no blue dot) */}
        {commuter ? (
          <TrackingLayers
            commuter={commuter}
            showPin={commuter.source !== 'gps'}
            vehicle={onTrackedRoute && tracked ? displayPosition(tracked, lineOf(tracked.lineId), trackSource.nowMs) : null}
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
        <TopBar tour />
        {/* Emjay's draft, 2026-10-26: the Routes button under the top bar opens the route list; a
            picked route opens out of it as a card, and the card's chevron folds it back into the
            button with All routes shown again */}
        {selectedOption ? (
          <Animated.View key="route-card" entering={FadeInRight.duration(motion.cardMs)} exiting={FadeOutRight.duration(motion.cardMs)}>
            <TourTarget id="routes">
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
                onPress={() => setSelectorOpen(true)}
                onCollapse={showAllRoutes}
              />
            </TourTarget>
          </Animated.View>
        ) : (
          <Animated.View key="routes-button" style={styles.routes} entering={FadeIn.duration(motion.cardMs)}>
            <TourTarget id="routes">
              <RoundButton icon={Bus} label={strings.live.selector.open} onPress={() => setSelectorOpen(true)} />
            </TourTarget>
          </Animated.View>
        )}
        {nightStops && selectedOption ? (
          <NightStopsCard
            code={selectedOption.code}
            passages={nightStops.passages}
            nowMs={nightStops.nowMs}
            stopName={(code) => {
              const name = stops.find((candidate) => candidate.code === code)?.name;
              return name ? (name.split(',')[0] ?? name) : code;
            }}
          />
        ) : null}
        {nudgeOn && selectedOption ? (
          <CoverageNudge
            code={selectedOption.code}
            alternative={alternative ? { ...alternative, color: colorOfRoute(alternative.routeCode) } : null}
            onShare={openRelayForm}
            onAlternative={(code) => showRoute(code, 'all')}
          />
        ) : null}
      </View>

      <View
        style={[styles.bottom, { bottom: bottomGap }]}
        onLayout={(event) => setBottomHeight(event.nativeEvent.layout.height)}
        pointerEvents="box-none"
      >
        <View
          style={[styles.buttons, zoomBeside && styles.buttonsBeside]}
          pointerEvents="box-none"
          onLayout={(event) => setButtonsHeight(event.nativeEvent.layout.height)}
        >
          {zoomBeside ? zoomButtons : null}
          <View
            style={styles.column}
            pointerEvents="box-none"
            onLayout={(event) => setColumn({ height: event.nativeEvent.layout.height, withZoom: !zoomBeside })}
          >
            {/* Emjay's order (draft, 2026-10-26): zoom in, zoom out, the tracked multicab, Locate, then
                Tunie; Routes moved under the top bar and Relay to the bottom bar */}
            {zoomBeside ? null : zoomButtons}
            {trackedId ? <RoundButton icon={Crosshair} label={strings.live.tracking.jumpTo} onPress={jumpToTracked} active /> : null}
            <TourTarget id="locate">
              <RoundButton
                icon={LocateFixed}
                label={location.following ? strings.location.following : strings.location.locateMe}
                onPress={locate}
                active={commuter?.source === 'simulated' || (location.following && location.locationAllowed)}
              />
            </TourTarget>
            <TourTarget id="ask">
              <TunieButton expanded={!infoCardShown} onPress={() => router.push('/assistant')} />
            </TourTarget>
          </View>
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
        {relay ? (
          <RelayBar
            session={relay}
            position={commuter}
            speedKmh={fix?.speedMps !== null && fix?.speedMps !== undefined ? fix.speedMps * KMH_PER_MPS : null}
            lines={relayLines}
            uplink={uplink}
            onStop={stopRelay}
          />
        ) : null}
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
            passedMe={trackedPassedMe}
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
            status={vehicleStatus(vehicle, relays, live.nowMs)}
            distanceKm={vehicleKm}
            onTrack={() => void startTracking(vehicle.id)}
            locationOff={trackLocation.status !== 'on'}
            onTurnOnLocation={trackLocation.turnOn}
            estimated={isGhostAge(ageSeconds(vehicle.lastPacketMs, live.nowMs))}
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
        ) : null}
        </Animated.View>
      </View>

      {selectorOpen ? (
        <RouteSelector
          routes={routeOptions}
          selectedCode={selectedRoute}
          filter={filter}
          onShow={showRoute}
          onShowAll={showAllRoutes}
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
    gap: spacing.sm,
  },
  buttons: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  // Too little height for one column: + and - beside the others, level with the top one
  buttonsBeside: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  column: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  // The Routes button, at the right under the top bar
  routes: {
    alignSelf: 'flex-end',
  },
  // CA1.1: + and - as one group
  zoom: {
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
