import { Bus, ChevronDown, Clock, LocateFixed, LocateOff, MapPinOff, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Hint, LineBadge, Logo, RoundButton, RouteChip, SkeletonCard, TopBar } from '@/components';
import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { promptSignIn } from '@/features/auth/promptSignIn';
import { CompactBar, FarewellCard, RoutePing, StationCard } from '@/features/checkin/CheckInParts';
import { LocationExplainer } from '@/features/map/LocationExplainer';
import { OfflineMap, type MapFocus } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { placeOf, useCommuterPosition } from '@/features/map/useCommuterPosition';
import { useSkeleton } from '@/features/loading/useSkeleton';
import { useLiveLocation } from '@/features/map/useLiveLocation';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { affordableRoutes, checkInCost } from '@/shared/backend/rules';
import { checkInGeofence, type Place } from '@/shared/checkin/geofence';
import { formatCountdown, isActive, remainingMs } from '@/shared/checkin/localCheckin';
import { mergeWaiting } from '@/shared/checkin/waiting';
import {
  CHECKIN_COUNTS_REFRESH_S,
  CHECKIN_FAREWELL_S,
  CHECKIN_RADIUS_M,
  ENERGY_CHECKIN_ROUTE_COST,
  GPS_ACCURACY_GATE_CHECKIN_M,
  MAP_FOLLOW_ZOOM,
  WALK_SPEED_M_PER_MIN,
  SKELETON_MIN_MS,
} from '@/shared/config';
import { boundsOfLines, clipBounds } from '@/shared/geo/bounds';
import { haversineMeters } from '@/shared/geo/haversine';
import type { RouteDirection, RouteStop } from '@/shared/routing/types';
import { routeCodesOf, routesAtStop, stopsForRoute, toggleRoute } from '@/shared/ui/routeVisibility';
import { useCheckInStore } from '@/state/checkinStore';
import { checkIn as cloudCheckIn, endCheckIn, useCrowd } from '@/state/crowdStore';
import { showDialog } from '@/state/dialogStore';
import { useEnergyStore } from '@/state/energyStore';
import { useHintsStore } from '@/state/hintsStore';
import { useLocationStore } from '@/state/locationStore';
import { strings } from '@/strings';
import { MAP_GEOMETRY, MIN_TOUCH_TARGET, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const LOGO_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md;
const CHEVRON_SIZE = spacing.md + spacing.xs;
const TICK_MS = 1000;
const MS_PER_S = 1000;

// Check-in (C1, B3): a map with one floating card. Every route's stations show at once; the route
// chips (or All) filter them. The card shows the station (the nearest, or the dot tapped) like
// Google Maps' place sheet, with the routes that stop there and a Check in button; a stop served by
// several routes adds "Ping routes", so only the drivers of the routes picked get the SMS. While a
// check-in runs, the card shows the station, the time left and both endings; "I boarded" says
// goodbye first. The card can be made smaller, and a button centres the map on the commuter. The
// phone must be within the station's radius (or at the simulated stop).
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
  // Routes to ping at a shared stop, for the station they were picked at
  const [ping, setPing] = useState<{ station: string; routes: string[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [cardHeight, setCardHeight] = useState(0);
  // B8: the card shows a skeleton on the first visit
  const loadingCard = useSkeleton(SKELETON_MIN_MS);
  // B8: the top bar's height, so framed stations keep clear of it
  const [topHeight, setTopHeight] = useState(0);
  const [minimized, setMinimized] = useState(false);
  // B3: the routes just boarded, while the "Safe travel" card shows
  const [farewell, setFarewell] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
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

  // The station of the card: the dot tapped, else the nearest shown station when the position is known
  const positionKey = positioned ? `${positioned.lat},${positioned.lon}` : null;
  const candidate = useMemo(() => {
    const at = positionKey ? { lat: Number(positionKey.split(',')[0]), lon: Number(positionKey.split(',')[1]) } : null;
    const distanceOf = (stop: { lat: number; lon: number }) => (at ? Math.round(haversineMeters(at, stop)) : null);
    const picked = shownStops.find((stop) => stop.code === stationCode);
    if (picked) return { stop: picked, distanceM: distanceOf(picked), nearest: false };
    if (!at || shownStops.length === 0) return null;
    let best = shownStops[0];
    for (const stop of shownStops) if (haversineMeters(at, stop) < haversineMeters(at, best)) best = stop;
    return { stop: best, distanceM: distanceOf(best), nearest: true };
  }, [shownStops, stationCode, positionKey]);

  // Every route that stops at the station. With a route filter on, that route is pinged by
  // default; with All, every route here is (the commuter can narrow it at a shared stop).
  const stopRoutes = useMemo(() => (candidate ? routesAtStop(lines, candidate.stop) : []), [lines, candidate]);
  // CA1.1: a check-in costs Energy for each route pinged, so no more routes than the balance pays
  // for are picked (unknown balance: the server decides)
  const energy = useEnergyStore((state) => state.snapshot);
  const maxRoutes = energy ? affordableRoutes(energy.balance, energy.enabled) : Number.POSITIVE_INFINITY;
  const defaultPing = (filter && stopRoutes.includes(filter) ? [filter] : stopRoutes).slice(0, Math.max(1, maxRoutes));
  const pinged = candidate && ping && ping.station === candidate.stop.code && ping.routes.length <= Math.max(1, maxRoutes) ? ping.routes : defaultPing;
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

  const doCheckIn = async () => {
    if (!candidate || active || sendingRef.current || pinged.length === 0 || !affordable) return;
    const code = candidate.stop.code;
    // The fix's age is taken at the tap (G0: a stale fix is refused)
    const fence = checkInGeofence(placeOf(commuter, fix, Date.now()), candidate.stop);
    if (!fence.ok) {
      showDialog({
        tone: 'warning',
        icon: fence.reason === 'too_far' ? MapPinOff : LocateOff,
        title: strings.checkin.notHereTitle,
        body:
          fence.reason === 'too_far'
            ? strings.checkin.tooFar(fence.distanceM, CHECKIN_RADIUS_M, code)
            : fence.reason === 'inaccurate'
              ? strings.checkin.inaccurate(GPS_ACCURACY_GATE_CHECKIN_M)
              : fence.reason === 'mocked'
                ? strings.checkin.mocked
                : fence.reason === 'stale'
                  ? strings.checkin.stale
                  : strings.checkin.noPosition,
      });
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      // The filtered route comes first, so it stays the check-in's main route
      const routes = filter && pinged.includes(filter) ? [filter, ...pinged.filter((value) => value !== filter)] : [...pinged];
      const result = await cloudCheckIn(routes, code);
      if (!result.ok) {
        if (result.reason === 'sign_in') promptSignIn();
        else if (result.reason === 'not_enough_energy')
          showDialog({ tone: 'warning', title: strings.checkin.noEnergyTitle, body: strings.checkin.noEnergyBody(ENERGY_CHECKIN_ROUTE_COST) });
        else showDialog({ tone: 'danger', title: strings.checkin.failedTitle, body: result.message ?? strings.checkin.failedBody });
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
          <Text style={typography.headlineSm} numberOfLines={1}>
            {activeStop?.name ?? checkIn.stationCode}
          </Text>
          <Text style={typography.bodySm} numberOfLines={1}>
            {strings.checkin.meta([checkIn.stationCode, strings.checkin.waiting(Math.max(waitingAt(checkIn.stationCode), 1))])}
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
      {candidate ? (
        <Animated.View key={candidate.stop.code} entering={FadeInDown.duration(motion.cardMs)}>
          <StationCard
            name={candidate.stop.name}
            nearest={candidate.nearest}
            meta={metaOf(candidate.stop.code, candidate.distanceM)}
            routes={badges(stopRoutes)}
            checkInLabel={strings.checkin.checkInAt(candidate.stop.code)}
            disabled={sending || pinged.length === 0 || !affordable}
            onCheckIn={() => void doCheckIn()}
          >
            {stopRoutes.length > 1 ? (
              <RoutePing
                routes={stopRoutes}
                picked={pinged}
                max={Math.max(1, maxRoutes)}
                onChange={(routes) => setPing({ station: candidate.stop.code, routes })}
              />
            ) : null}
            {energy?.enabled ? (
              <Text style={[typography.bodySm, !affordable && styles.short]}>
                {affordable
                  ? strings.checkin.cost(checkInCost(pinged.length), ENERGY_CHECKIN_ROUTE_COST, energy.balance)
                  : strings.checkin.noEnergyBody(ENERGY_CHECKIN_ROUTE_COST)}
              </Text>
            ) : null}
          </StationCard>
        </Animated.View>
      ) : null}
      {!hintSeen ? <Hint text={strings.hints.checkin} onDismiss={() => dismissHint('checkin')} /> : null}
    </Animated.View>
  );

  const compact = active ? (
    <CompactBar
      title={strings.checkin.compactActive(checkIn.stationCode)}
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
          bottomInset={cardHeight}
          topInset={insets.top + spacing.sm + topHeight}
          onUserMove={location.stopFollowing}
        >
          <RouteLines lines={shownLines} visible={ALL_DIRECTIONS} opacity={lineOpacity} />
          <StopDots
            stops={shownStops}
            selectedCode={active ? checkIn.stationCode : (candidate?.stop.code ?? null)}
            onPressStop={active ? undefined : pickStation}
            color={active ? badgeColor(checkIn.routeCode) : filter ? badgeColor(filter) : undefined}
          />
        </OfflineMap>
      ) : (
        <View style={styles.centered}>
          <Logo size={LOGO_SIZE} />
        </View>
      )}
      <View style={[styles.topBar, { top: insets.top + spacing.sm }]} onLayout={(event) => setTopHeight(event.nativeEvent.layout.height)}>
        <TopBar />
      </View>

      <View style={styles.bottom} pointerEvents="box-none">
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
  bottom: {
    position: 'absolute',
    left: spacing.sm + spacing.xs,
    right: spacing.sm + spacing.xs,
    bottom: spacing.sm + spacing.xs,
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
    gap: spacing.sm,
  },
}));
