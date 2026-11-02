import { Bus, ChevronDown, Clock, LocateFixed, LocateOff, MapPinOff, WifiOff, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Hint, LineBadge, Logo, RoundButton, RouteChip, SkeletonCard, TopBar } from '@/components';
import { TILESET } from '@/data/map/tileset';
import { MAP_POIS } from '@/data/seed/places';
import { useRouteData } from '@/data/RouteDataProvider';
import { promptSignIn } from '@/features/auth/promptSignIn';
import { CompactBar, FarewellCard, RoutePing, StationCard } from '@/features/checkin/CheckInParts';
import { LocationExplainer } from '@/features/map/LocationExplainer';
import { OfflineMap, type MapFocus } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { YouLayers } from '@/features/map/YouLayers';
import { placeOf, useCommuterPosition } from '@/features/map/useCommuterPosition';
import { useSkeleton } from '@/features/loading/useSkeleton';
import { useLiveLocation } from '@/features/map/useLiveLocation';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { affordableRoutes, checkInCost } from '@/shared/backend/rules';
import { checkInNearRoute, findCheckInSpot, type CheckInSpot, type Place } from '@/shared/checkin/geofence';
import { formatCountdown, isActive, remainingMs } from '@/shared/checkin/localCheckin';
import { mergeWaiting } from '@/shared/checkin/waiting';
import {
  CHECKIN_COUNTS_REFRESH_S,
  CHECKIN_FAREWELL_S,
  CHECKIN_LEAVE_M,
  CHECKIN_LINE_M,
  CHECKIN_STOP_MAX_M,
  ENERGY_CHECKIN_ROUTE_COST,
  GPS_ACCURACY_GATE_CHECKIN_M,
  MAP_FOLLOW_ZOOM,
  WALK_SPEED_M_PER_MIN,
  SKELETON_MIN_MS,
} from '@/shared/config';
import { boundsOfLines, clipBounds } from '@/shared/geo/bounds';
import { haversineMeters } from '@/shared/geo/haversine';
import { namePoint } from '@/shared/routing/describe';
import type { RouteDirection, RouteStop } from '@/shared/routing/types';
import { pingedRoutesAtStop, routeCodesOf, routesAtStop, stopsForRoute, toggleRoute } from '@/shared/ui/routeVisibility';
import { isNetworkFailure } from '@/shared/util/networkError';
import { useCheckInStore } from '@/state/checkinStore';
import { setOnline, useConnectionStore } from '@/state/connectionStore';
import { reportMockLocation } from '@/services/risk';
import { checkIn as cloudCheckIn, endCheckIn, useCrowd } from '@/state/crowdStore';
import { showDialog } from '@/state/dialogStore';
import { refreshEnergy, useEnergyStore } from '@/state/energyStore';
import { useHintsStore } from '@/state/hintsStore';
import { useLocationStore } from '@/state/locationStore';
import { useTabBarSpace } from '@/navigation/useTabBarSpace';
import { strings } from '@/strings';
import { MAP_GEOMETRY, MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';
import { blockedBySuspension } from '@/state/moderationStore';
import { useSettingsStore } from '@/state/settingsStore';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const LOGO_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md;
const CHEVRON_SIZE = spacing.md + spacing.xs;
const TICK_MS = 1000;
const MS_PER_S = 1000;

// Check-in (C1, B3): a map with one floating card. Every route's stations show at once; the route
// chips (or All) filter them. The card shows where the commuter stands, like Google Maps' place
// sheet, with the routes there and a Check in button; with several routes, "Ping routes" picks
// which drivers get the SMS. While a check-in runs, the card shows the station, the time left and
// both endings; "I boarded" says goodbye first. The card can be made smaller, and a button centres
// the map on the commuter.
// Emjay, 2026-11-02: no "at a stop" or "near the route" choice. Within CHECKIN_AT_STOP_M of a stop
// the check-in counts there; elsewhere within CHECKIN_LINE_M of a route it counts near the nearest
// stop (findCheckInSpot), and the card names the spot like My Rides ("Near Flying V"). A tapped
// station shows its distance and waiting count, and checks in only when the commuter is at it.
// Either ends by itself when the commuter leaves (shared/checkin/leave).
export default function CheckInScreen() {
  const styles = useStyles();
  const { colors, typography, routeColor, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const { lines, stops } = useRouteData();
  const { state: tiles } = useOfflineTiles();
  const checkIn = useCheckInStore((state) => state.checkIn);
  const crowd = useCrowd();
  const commuter = useCommuterPosition();
  const fix = useLocationStore((state) => state.fix);
  const hintSeen = useHintsStore((state) => state.seen.checkin);
  const dismissHint = useHintsStore((state) => state.dismiss);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const centerOn = (center: { lat: number; lon: number }) =>
    setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center, zoom: MAP_FOLLOW_ZOOM }));
  // Keeps the GPS fix fresh while this tab is open, and runs "Locate me" (explainer first)
  const location = useLiveLocation(centerOn);

  const routeCodes = useMemo(() => routeCodesOf(lines), [lines]);
  // B3: null shows every route's stations; a route code shows only that route's
  const [filter, setFilter] = useState<string | null>(null);
  const [stationCode, setStationCode] = useState<string | null>(null);
  // Routes to ping where several routes pass, for the spot they were picked at
  const [ping, setPing] = useState<{ station: string; routes: string[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [cardHeight, setCardHeight] = useState(0);
  // The card sits above the floating bottom bar; the map runs under it
  const tabBar = useTabBarSpace();
  // B8: the card shows a skeleton on the first visit
  const loadingCard = useSkeleton(SKELETON_MIN_MS);
  // B8: the top bar's height, so framed stations keep clear of it
  const [topHeight, setTopHeight] = useState(0);
  const [minimized, setMinimized] = useState(false);
  // B3: the routes just boarded, while the "Safe travel" card shows
  const [farewell, setFarewell] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // PRD 14: live check-ins need the server; the demo keeps them on the phone
  const demoData = useSettingsStore((state) => state.demoData);
  const offline = useConnectionStore((state) => state.online === false) && !demoData;
  const sendingRef = useRef(false);

  const active = isActive(checkIn, now);
  // What the map shows: the running check-in's routes, else the filter's route, else every route
  const activeRoutes = active ? checkIn.routeCodes : null;
  const shownRoutes = useMemo(() => activeRoutes ?? (filter ? [filter] : routeCodes), [activeRoutes, filter, routeCodes]);
  const shownLines = useMemo(() => lines.filter((line) => shownRoutes.includes(line.routeCode)), [lines, shownRoutes]);
  // Lines drawn faint, so the station dots stand out
  const lineOpacity = useMemo(
    () => Object.fromEntries(shownLines.map((line) => [line.id, MAP_GEOMETRY.checkinLineOpacity])),
    [shownLines],
  );
  const shownStops = useMemo(() => {
    const seen = new Set<string>();
    const out: RouteStop[] = [];
    for (const code of shownRoutes) {
      for (const stop of stopsForRoute(lines, stops, code)) {
        if (!seen.has(stop.code)) {
          seen.add(stop.code);
          out.push(stop);
        }
      }
    }
    return out;
  }, [lines, stops, shownRoutes]);

  // Where the card measures from: a GPS fix, or the simulated stop; a pin is no position. The fix's
  // mock flag and age are judged at the tap, below.
  const place: Place | null = placeOf(commuter, fix, fix?.timestampMs ?? 0);
  const positioned = place && place.source !== 'pin' ? place : null;

  // C1: the waiting counts of the shown routes' stations, merged per station (B3), reloaded every
  // CHECKIN_COUNTS_REFRESH_S and after the user's own check-in or its end
  const [counts, setCounts] = useState<{ key: string; byStation: ReadonlyMap<string, number> | null } | null>(null);
  const [countsKey, setCountsKey] = useState(0);
  const countsFor = shownRoutes.join(',');
  useEffect(() => {
    let current = true;
    const load = () => {
      void Promise.all(
        shownRoutes.map((code) =>
          crowd.checkins
            .waitingCounts(
              code,
              stopsForRoute(lines, stops, code).map((stop) => stop.code),
            )
            .catch(() => null),
        ),
      ).then((byRoute) => {
        if (current) setCounts({ key: countsFor, byStation: mergeWaiting(byRoute) });
      });
    };
    load();
    const timer = setInterval(load, CHECKIN_COUNTS_REFRESH_S * MS_PER_S);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [crowd, shownRoutes, countsFor, lines, stops, countsKey]);
  const byStation = counts && counts.key === countsFor ? counts.byStation : null;
  const waitingAt = (code: string) => byStation?.get(code) ?? 0;

  // Where the commuter stands (Emjay, 2026-11-02): at a stop, near a route, or neither. Judged
  // again at the tap with the fix's age.
  const { lat, lon, source, accuracyM, mocked } = positioned ?? {};
  const spot: CheckInSpot = useMemo(
    () => findCheckInSpot(lat !== undefined && lon !== undefined && source ? { lat, lon, source, accuracyM: accuracyM ?? null, mocked } : null, lines, stops),
    [lat, lon, source, accuracyM, mocked, lines, stops],
  );
  // "Baan Viaduct" at a stop; "Near Flying V" from the stops and the map's places elsewhere
  const spotName = useMemo(() => {
    if (spot.ok && spot.kind === 'stop') return spot.stop.name;
    if (lat === undefined || lon === undefined) return strings.checkin.unknownPlace;
    const named = namePoint({ lat, lon }, stops, MAP_POIS);
    return named.kind === 'at' ? named.name : named.kind === 'near' ? strings.ride.near(named.name) : strings.checkin.onRoute;
  }, [spot, lat, lon, stops]);
  const spotRoutes = spot.ok ? spot.routes : [];
  const spotKey = spot.ok ? (spot.kind === 'stop' ? spot.stop.code : `near:${spot.routes.join(',')}`) : null;

  // A station tapped on the map: its distance and waiting count; it checks in only when it is the
  // commuter's own stop
  const tapped = useMemo(() => {
    const stop = stationCode ? shownStops.find((candidate) => candidate.code === stationCode) : undefined;
    if (!stop) return null;
    const distanceM = lat !== undefined && lon !== undefined ? Math.round(haversineMeters({ lat, lon }, stop)) : null;
    return { stop, distanceM, routes: routesAtStop(lines, stop) };
  }, [stationCode, shownStops, lat, lon, lines]);
  const tappedIsHere = tapped !== null && spot.ok && spot.kind === 'stop' && spot.stop.code === tapped.stop.code;

  // The routes the check-in pings. With a route filter on, that route is pinged by default; with
  // All, every route here is (the commuter can narrow it where several pass).
  // CA1.1: a check-in costs Energy for each route pinged, so no more routes than the balance pays
  // for are picked (unknown balance: the server decides)
  const energy = useEnergyStore((state) => state.snapshot);
  const maxRoutes = energy ? affordableRoutes(energy.balance, energy.enabled) : Number.POSITIVE_INFINITY;
  const defaultPing = (filter && spotRoutes.includes(filter) ? [filter] : spotRoutes).slice(0, Math.max(1, maxRoutes));
  const pinged = spotKey && ping && ping.station === spotKey && ping.routes.length <= Math.max(1, maxRoutes) ? ping.routes : defaultPing;
  const affordable = pinged.length <= maxRoutes;

  // The routes' box, clipped to the tile set so the opening view always has map data (RR1)
  const initialBounds = useMemo(() => clipBounds(boundsOfLines(lines.map((line) => line.coordinates)), TILESET.bounds), [lines]);
  const badgeColor = (code: string) => routeColor(code, lines.find((line) => line.routeCode === code)?.color ?? colors.primary);
  const badges = (codes: readonly string[]) => codes.map((code) => ({ code, color: badgeColor(code) }));

  const pickRoute = (code: string | null) => {
    const next = code === null ? null : toggleRoute(filter, code);
    setFilter(next);
    setStationCode(null);
    setPing(null);
    const ofRoute = next ? lines.filter((line) => line.routeCode === next) : lines;
    const bounds = clipBounds(boundsOfLines(ofRoute.map((line) => line.coordinates)), TILESET.bounds);
    setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds }));
  };

  // Tick once a second while a check-in is running; the time left is always worked out from the
  // stored expiry, so a restart or a long time away gives the right answer
  useEffect(() => {
    if (!checkIn) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [checkIn]);

  // The "Safe travel" card goes by itself after CHECKIN_FAREWELL_S
  useEffect(() => {
    if (!farewell) return undefined;
    const timer = setTimeout(() => setFarewell(null), CHECKIN_FAREWELL_S * MS_PER_S);
    return () => clearTimeout(timer);
  }, [farewell]);

  // Tapping a stop shows it; the check-in stays where the commuter stands
  const pickStation = (code: string) => {
    setStationCode(code);
    setMinimized(false);
    const stop = stops.find((candidateStop) => candidateStop.code === code);
    if (stop) setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: stop }));
  };

  // The simulated stop (Demo settings) is centred directly; otherwise "Locate me" (G0)
  const locate = () => {
    if (commuter?.source === 'simulated') centerOn(commuter);
    else location.locateMe();
  };

  // Why the commuter cannot check in here, for the card's notice and the dialog
  const refusal = (found: Exclude<CheckInSpot, { ok: true }>) =>
    found.reason === 'too_far_from_line'
      ? strings.checkin.tooFarFromLine(found.lineM, CHECKIN_LINE_M)
      : found.reason === 'no_stop'
        ? strings.checkin.failedBody
        : found.reason === 'inaccurate'
          ? strings.checkin.inaccurate(GPS_ACCURACY_GATE_CHECKIN_M)
          : found.reason === 'mocked'
            ? strings.checkin.mocked
            : found.reason === 'stale'
              ? strings.checkin.stale
              : strings.checkin.noPosition;

  const refuse = (found: Exclude<CheckInSpot, { ok: true }>) => {
    // RK1: the server hears of a mock location once per app session
    if (found.reason === 'mocked') reportMockLocation();
    showDialog({
      tone: 'warning',
      icon: found.reason === 'too_far_from_line' ? MapPinOff : LocateOff,
      title: strings.checkin.notNearTitle,
      body: refusal(found),
    });
  };

  const doCheckIn = async () => {
    if (active || sendingRef.current || pinged.length === 0 || !affordable || offline) return;
    // MOD1b: a suspended rider is told why (live data only)
    if (!useSettingsStore.getState().demoData && blockedBySuspension()) return;
    // The fix's age is taken at the tap (G0: a stale fix is refused)
    const standingAt = placeOf(commuter, fix, Date.now());
    const found = findCheckInSpot(standingAt, lines, stops);
    if (!found.ok) {
      refuse(found);
      return;
    }
    // The filtered route comes first, so it stays the check-in's main route; routes no longer
    // passing here (the commuter moved) are dropped
    const ordered = (filter && pinged.includes(filter) ? [filter, ...pinged.filter((value) => value !== filter)] : [...pinged]).filter((route) => found.routes.includes(route));
    const chosen = ordered.length > 0 ? ordered : found.routes.slice(0, Math.max(1, maxRoutes));
    let code: string;
    let routes: string[];
    const near = found.kind === 'near';
    if (found.kind === 'stop') {
      code = found.stop.code;
      routes = chosen;
    } else {
      // Counted near the nearest stop of the pinged routes; only the pinged routes that stop there
      // reach a driver (CA3)
      const fence = checkInNearRoute(
        standingAt,
        lines.filter((line) => chosen.includes(line.routeCode)).map((line) => line.coordinates),
        chosen.flatMap((route) => stopsForRoute(lines, stops, route)),
      );
      if (!fence.ok) {
        refuse(fence);
        return;
      }
      code = fence.stop.code;
      routes = pingedRoutesAtStop(lines, fence.stop, chosen);
    }
    sendingRef.current = true;
    setSending(true);
    try {
      const result = await cloudCheckIn(routes, code, standingAt && standingAt.source !== 'pin' ? standingAt : undefined, near);
      if (!result.ok) {
        if (result.reason === 'sign_in') promptSignIn();
        else if (result.reason === 'not_enough_energy') {
          // The card's balance may be stale; the server's is read again so the card matches the refusal
          void refreshEnergy();
          showDialog({ tone: 'warning', title: strings.checkin.noEnergyTitle, body: strings.checkin.noEnergyBody(ENERGY_CHECKIN_ROUTE_COST) });
        } else if (isNetworkFailure(result.message)) {
          // The probe has not noticed yet; the top bar and the card say offline from now on
          setOnline(false);
          showDialog({ tone: 'warning', icon: WifiOff, title: strings.checkin.offlineTitle, body: strings.checkin.offline });
        } else {
          // The server's own text stays off the screen; a development build logs it to Metro
          if (__DEV__) console.warn('[checkin] failed', result.reason, 'message' in result ? result.message : '');
          showDialog({ tone: 'danger', title: strings.checkin.failedTitle, body: strings.checkin.failedBody });
        }
        return;
      }
      setNow(Date.now());
      setCountsKey((key) => key + 1);
      dismissHint('checkin');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const finish = (boarded: boolean) => {
    if (boarded && checkIn) setFarewell(checkIn.routeCodes.join(', '));
    endCheckIn(boarded);
    setMinimized(false);
    setCountsKey((key) => key + 1);
  };

  const left = active ? remainingMs(checkIn, now) : 0;
  const countdown = active ? formatCountdown(left) : '';
  const activeStop = active ? stops.find((stop) => stop.code === checkIn.stationCode) : undefined;
  // A near check-in is named after the spot it was made at ("Near Flying V"), not the stop it counts at
  const activePoint = active && checkIn.near ? checkIn.point : undefined;
  const activeName = useMemo(() => {
    if (!activePoint) return null;
    const named = namePoint(activePoint, stops, MAP_POIS);
    return named.kind === 'at' ? named.name : named.kind === 'near' ? strings.ride.near(named.name) : strings.checkin.onRoute;
  }, [activePoint, stops]);

  const metaOf = (code: string, distanceM: number | null) =>
    strings.checkin.meta([
      code,
      ...(distanceM !== null ? [strings.checkin.distance(distanceM), strings.checkin.walkMin(Math.round(distanceM / WALK_SPEED_M_PER_MIN))] : []),
      ...(byStation ? [strings.checkin.waiting(waitingAt(code))] : []),
    ]);

  const minimizeButton = (
    <Pressable style={styles.iconButton} onPress={() => setMinimized(true)} accessibilityRole="button" accessibilityLabel={strings.checkin.minimize}>
      <ChevronDown color={colors.textSecondary} size={CHEVRON_SIZE} />
    </Pressable>
  );

  const activeCard = active ? (
    <Animated.View key="active" entering={FadeIn.duration(motion.cardMs)} style={styles.section}>
      <View style={styles.row}>
        <View style={styles.grow} accessible accessibilityLabel={strings.checkin.countdownLabel(checkIn.stationCode, countdown)}>
          <Text style={typography.headlineSm} numberOfLines={2}>
            {activeName ?? activeStop?.name ?? checkIn.stationCode}
          </Text>
          <Text style={typography.bodySm}>
            {strings.checkin.meta([
              checkIn.near ? strings.checkin.nearCode(checkIn.stationCode) : checkIn.stationCode,
              strings.checkin.waiting(Math.max(waitingAt(checkIn.stationCode), 1)),
            ])}
          </Text>
          {/* EQ-10: the pinged routes in one wrapping row under the station, not a column beside it */}
          <View style={styles.badges}>
            {checkIn.routeCodes.map((code) => (
              <LineBadge key={code} code={code} color={badgeColor(code)} />
            ))}
          </View>
        </View>
        <View style={styles.activePill}>
          <Clock color={colors.success} size={ICON_SIZE} />
          <Text style={[typography.labelMd, styles.activeText]}>{countdown}</Text>
        </View>
        {minimizeButton}
      </View>
      {/* CA3: how far the commuter may go before the check-in ends by itself */}
      <Text style={typography.bodySm}>{checkIn.near ? strings.checkin.stayNear(CHECKIN_LEAVE_M) : strings.checkin.stayAtStop(CHECKIN_STOP_MAX_M)}</Text>
      <View style={styles.buttons}>
        <View style={styles.grow}>
          <Button label={strings.checkin.boarded} leadingIcon={Bus} onPress={() => finish(true)} />
        </View>
        <View style={styles.grow}>
          <Button label={strings.checkin.cancel} leadingIcon={X} variant="secondary" onPress={() => finish(false)} accessibilityLabel={strings.checkin.cancelCheckIn} />
        </View>
      </View>
    </Animated.View>
  ) : null;

  const checkInDisabled = sending || pinged.length === 0 || !affordable || offline;
  const backToMe = () => {
    setStationCode(null);
    if (lat !== undefined && lon !== undefined) centerOn({ lat, lon });
  };
  // Under the commuter's spot: the offline notice, the route ping and the Energy cost
  const spotExtras = (
    <>
      {offline ? (
        <View style={styles.offline} accessibilityRole="alert">
          <WifiOff color={colors.warning} size={ICON_SIZE} />
          <Text style={[typography.bodySm, styles.grow]}>{strings.checkin.offline}</Text>
        </View>
      ) : null}
      {spotRoutes.length > 1 && spotKey ? (
        <RoutePing routes={spotRoutes} picked={pinged} max={Math.max(1, maxRoutes)} onChange={(routes) => setPing({ station: spotKey, routes })} />
      ) : null}
      {energy?.enabled ? (
        <Text style={[typography.bodySm, !affordable && styles.short]}>
          {affordable ? strings.checkin.cost(checkInCost(pinged.length), ENERGY_CHECKIN_ROUTE_COST, energy.balance) : strings.checkin.noEnergyBody(ENERGY_CHECKIN_ROUTE_COST)}
        </Text>
      ) : null}
    </>
  );

  const pickCard = active ? null : (
    <Animated.View key="pick" entering={FadeIn.duration(motion.cardMs)} style={styles.section}>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Text style={typography.headlineSm} accessibilityRole="header">
            {strings.checkin.title}
          </Text>
          <Text style={typography.bodySm}>
            {filter ? strings.checkin.meta([strings.checkin.tapHint, strings.checkin.stopsCount(shownStops.length)]) : strings.checkin.allHint}
          </Text>
        </View>
        {minimizeButton}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label={strings.checkin.allRoutes}
          selected={filter === null}
          onPress={() => pickRoute(null)}
          accessibilityLabel={strings.checkin.allLabel(filter === null)}
        />
        {routeCodes.map((code) => (
          <RouteChip
            key={code}
            code={code}
            color={badgeColor(code)}
            selected={code === filter}
            onPress={() => pickRoute(code)}
            accessibilityLabel={strings.checkin.filterLabel(code, code === filter)}
          />
        ))}
      </ScrollView>
      {filter && shownStops.length === 0 ? <Text style={typography.bodyMd}>{strings.checkin.noStations}</Text> : null}
      {tapped ? (
        <Animated.View key={tapped.stop.code} entering={FadeInDown.duration(motion.cardMs)}>
          <StationCard
            overline={strings.checkin.picked}
            name={tapped.stop.name}
            here={false}
            meta={metaOf(tapped.stop.code, tapped.distanceM)}
            routesLabel={strings.checkin.routesHere}
            routes={badges(tapped.routes)}
            checkIn={tappedIsHere ? { label: strings.checkin.checkInAt(tapped.stop.code), disabled: checkInDisabled, onPress: () => void doCheckIn() } : null}
            onBack={backToMe}
            onClose={backToMe}
          >
            {tappedIsHere ? spotExtras : null}
          </StationCard>
        </Animated.View>
      ) : (
        <Animated.View key={spotKey ?? 'none'} entering={FadeInDown.duration(motion.cardMs)}>
          <StationCard
            overline={strings.checkin.yourLocation}
            name={spotName}
            here
            routesLabel={spot.ok && spot.kind === 'stop' ? strings.checkin.routesHere : strings.checkin.routesNear}
            routes={badges(spotRoutes)}
            checkIn={{
              label: spot.ok && spot.kind === 'stop' ? strings.checkin.checkInAt(spot.stop.code) : strings.checkin.checkInHere,
              disabled: checkInDisabled || !spot.ok,
              onPress: () => void doCheckIn(),
            }}
          >
            {spot.ok ? spotExtras : <Text style={typography.bodySm}>{refusal(spot)}</Text>}
          </StationCard>
        </Animated.View>
      )}
      {!hintSeen ? <Hint text={strings.hints.checkin} onDismiss={() => dismissHint('checkin')} /> : null}
    </Animated.View>
  );

  const compact = active ? (
    <CompactBar
      title={activeName ? strings.checkin.compactSpot(activeName) : strings.checkin.compactActive(checkIn.stationCode)}
      countdown={countdown}
      badges={badges(checkIn.routeCodes)}
      onExpand={() => setMinimized(false)}
    />
  ) : (
    <CompactBar title={strings.checkin.title} badges={badges(filter ? [filter] : [])} onExpand={() => setMinimized(false)} />
  );

  return (
    <View style={styles.root}>
      {tiles.status === 'ready' ? (
        <OfflineMap
          tilesUrl={tiles.tiles.url}
          glyphsUrl={tiles.tiles.glyphsUrl}
          labelsDimmed={active || filter !== null}
          initialBounds={initialBounds}
          focus={focus}
          bottomInset={cardHeight + tabBar.above}
          topInset={insets.top + spacing.sm + topHeight}
          onUserMove={location.stopFollowing}
        >
          <RouteLines lines={shownLines} visible={ALL_DIRECTIONS} opacity={lineOpacity} />
          <StopDots
            stops={shownStops}
            selectedCode={active ? checkIn.stationCode : (tapped?.stop.code ?? (spot.ok && spot.kind === 'stop' ? spot.stop.code : null))}
            onPressStop={active ? undefined : pickStation}
            color={active ? badgeColor(checkIn.routeCode) : filter ? badgeColor(filter) : undefined}
          />
          <YouLayers commuter={commuter} labels={tiles.tiles.glyphsUrl !== null} />
        </OfflineMap>
      ) : (
        <View style={styles.centered}>
          <Logo size={LOGO_SIZE} />
        </View>
      )}
      <View style={[styles.topBar, { top: insets.top + spacing.sm }]} onLayout={(event) => setTopHeight(event.nativeEvent.layout.height)}>
        <TopBar />
      </View>

      <View style={[styles.bottom, { bottom: tabBar.above }]} pointerEvents="box-none">
        <View style={styles.fab} pointerEvents="box-none">
          <RoundButton
            icon={LocateFixed}
            label={location.following ? strings.location.following : strings.location.locateMe}
            onPress={locate}
            active={commuter?.source === 'simulated' || (location.following && location.locationAllowed)}
          />
        </View>
        {location.showExplainer ? <LocationExplainer onContinue={location.continueExplainer} onNotNow={location.dismissExplainer} /> : null}
        {/* Sized by its content. No layout transition here: on a bottom-anchored view it keeps the
            old top and grows the height downward, under the tab bar. */}
        <View style={[styles.card, elevation.level3]} onLayout={(event) => setCardHeight(Math.round(event.nativeEvent.layout.height) + spacing.md)}>
          {loadingCard ? (
            <SkeletonCard bare />
          ) : farewell ? (
            <FarewellCard routes={farewell} onDone={() => setFarewell(null)} />
          ) : minimized ? (
            compact
          ) : (
            <>
              {activeCard}
              {pickCard}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  // CA1.1: the check-in cost line when the balance is short
  short: {
    color: colors.danger,
  },
  // PRD 14: the offline notice on the station card
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surfaceLow,
  },
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  // As wide as the floating bottom bar under it
  bottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  fab: {
    alignSelf: 'flex-end',
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  section: {
    gap: spacing.sm + spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  grow: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs + spacing.xs / 2,
    borderRadius: radii.pill,
    backgroundColor: colors.successContainer,
  },
  activeText: {
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
}));
