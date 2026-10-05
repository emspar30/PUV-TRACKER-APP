import { router } from 'expo-router';
import { Bus, Clock, Footprints, LocateOff, MapPin, MapPinOff, Navigation, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Hint, IconTile, LineBadge, Logo, RouteChip, StatusPill, TopBar } from '@/components';
import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { ExpiryBar, RoutePing } from '@/features/checkin/CheckInParts';
import { OfflineMap, type MapFocus } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useCommuterPosition } from '@/features/map/useCommuterPosition';
import { useLocationTracking } from '@/features/map/useLocationTracking';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { useRouteLayers } from '@/features/map/useRouteLayers';
import { checkInGeofence, type Place } from '@/shared/checkin/geofence';
import { formatCountdown, isActive, remainingMs } from '@/shared/checkin/localCheckin';
import { CHECKIN_COUNTS_REFRESH_S, CHECKIN_LIFETIME_S, CHECKIN_RADIUS_M, GPS_ACCURACY_GATE_CHECKIN_M, WALK_SPEED_M_PER_MIN } from '@/shared/config';
import { boundsOfLines, clipBounds } from '@/shared/geo/bounds';
import { haversineMeters } from '@/shared/geo/haversine';
import type { RouteDirection } from '@/shared/routing/types';
import { routeCodesOf, routesAtStop, toggleRoute } from '@/shared/ui/routeVisibility';
import { verifyCheckIn } from '@/shared/verification/verifyCheckIn';
import { useCheckInStore } from '@/state/checkinStore';
import { checkIn as cloudCheckIn, endCheckIn, useCrowd } from '@/state/crowdStore';
import { showDialog } from '@/state/dialogStore';
import { useHintsStore } from '@/state/hintsStore';
import { useLocationStore } from '@/state/locationStore';
import { strings } from '@/strings';
import { MAP_GEOMETRY, makeStyles, motion, radii, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const LOGO_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md;
const TICK_MS = 1000;
const MS_PER_S = 1000;
const S_PER_MIN = 60;

// Check-in (C1): a map with one floating card, no dragging. The card shows the routes, then the
// station (the nearest on the picked route, or the dot tapped on the map) with its distance, walk
// time, people waiting and a Check in button. A stop served by several routes adds "Ping routes",
// so only the drivers of the routes picked get the SMS. While a check-in runs, the same card shows
// the station, the time left and both endings, always in view. The route is drawn faint so the
// station dots stand out. The phone must be within the station's radius (or at the simulated stop).
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
  // Keeps the GPS fix fresh while this tab is open
  useLocationTracking();
  const hintSeen = useHintsStore((state) => state.seen.checkin);
  const dismissHint = useHintsStore((state) => state.dismiss);

  const routeCodes = useMemo(() => routeCodesOf(lines), [lines]);
  // UX3: route first. Nothing is drawn until a route is picked; kept while the app is open only.
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [stationCode, setStationCode] = useState<string | null>(null);
  // Routes to ping at a shared stop, for the station they were picked at
  const [ping, setPing] = useState<{ station: string; routes: string[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [cardHeight, setCardHeight] = useState(0);

  const active = isActive(checkIn, now);
  // A running check-in shows its own route
  const shownRoute = active ? checkIn.routeCode : selectedRoute;
  const layers = useRouteLayers(lines, stops, 'checkin', shownRoute);
  const faint = useMemo(
    () => Object.fromEntries(Object.entries(layers.opacity).map(([id, value]) => [id, value * MAP_GEOMETRY.checkinLineOpacity])),
    [layers.opacity],
  );
  const [counts, setCounts] = useState<{ route: string; byStation: ReadonlyMap<string, number> | null } | null>(null);
  const [countsKey, setCountsKey] = useState(0);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  // What the geofence uses: a GPS fix with its accuracy, or the simulated stop; a pin is no position
  const place: Place | null = commuter ? { ...commuter, accuracyM: commuter.source === 'gps' ? (fix?.accuracyM ?? null) : null } : null;
  const positioned = place && place.source !== 'pin' ? place : null;

  // C1: the waiting counts of the shown route, reloaded every CHECKIN_COUNTS_REFRESH_S and after
  // the user's own check-in or its end
  const stationCodes = useMemo(() => layers.stops.map((stop) => stop.code), [layers.stops]);
  useEffect(() => {
    if (!shownRoute) return undefined;
    let current = true;
    const load = () => {
      crowd.checkins
        .waitingCounts(shownRoute, stationCodes)
        .then((byStation) => {
          if (current) setCounts({ route: shownRoute, byStation });
        })
        .catch(() => {
          if (current) setCounts({ route: shownRoute, byStation: null });
        });
    };
    load();
    const timer = setInterval(load, CHECKIN_COUNTS_REFRESH_S * MS_PER_S);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [crowd, shownRoute, stationCodes, countsKey]);
  const byStation = counts && counts.route === shownRoute ? counts.byStation : null;
  const waitingAt = (code: string) => byStation?.get(code) ?? 0;

  // The station of the card: the dot tapped, else the nearest on the route when the position is known
  const positionKey = positioned ? `${positioned.lat},${positioned.lon}` : null;
  const candidate = useMemo(() => {
    const at = positionKey ? { lat: Number(positionKey.split(',')[0]), lon: Number(positionKey.split(',')[1]) } : null;
    const distanceOf = (stop: { lat: number; lon: number }) => (at ? Math.round(haversineMeters(at, stop)) : null);
    const picked = layers.stops.find((stop) => stop.code === stationCode);
    if (picked) return { stop: picked, distanceM: distanceOf(picked), nearest: false };
    if (!at || layers.stops.length === 0) return null;
    let best = layers.stops[0];
    for (const stop of layers.stops) if (haversineMeters(at, stop) < haversineMeters(at, best)) best = stop;
    return { stop: best, distanceM: distanceOf(best), nearest: true };
  }, [layers.stops, stationCode, positionKey]);

  // A shared stop lists every route that stops there; the picked route is pinged by default
  const stopRoutes = useMemo(() => (candidate ? routesAtStop(lines, candidate.stop) : []), [lines, candidate]);
  const pinged = candidate && ping && ping.station === candidate.stop.code ? ping.routes : shownRoute ? [shownRoute] : [];

  // The routes' box, clipped to the tile set so the opening view always has map data (RR1)
  const initialBounds = useMemo(() => clipBounds(boundsOfLines(lines.map((line) => line.coordinates)), TILESET.bounds), [lines]);
  const badgeColor = (code: string) => routeColor(code, lines.find((line) => line.routeCode === code)?.color ?? colors.primary);

  const pickRoute = (code: string) => {
    const next = toggleRoute(selectedRoute, code);
    setSelectedRoute(next);
    setStationCode(null);
    setPing(null);
    if (next) {
      const ofRoute = lines.filter((line) => line.routeCode === next);
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'bounds', bounds: boundsOfLines(ofRoute.map((line) => line.coordinates)) }));
    }
  };

  // Tick once a second while a check-in is running; the time left is always worked out from the
  // stored expiry, so a restart or a long time away gives the right answer
  useEffect(() => {
    if (!checkIn) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [checkIn]);

  const pickStation = (code: string) => {
    setStationCode(code);
    const stop = stops.find((candidateStop) => candidateStop.code === code);
    if (stop) setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: stop }));
  };

  const doCheckIn = async () => {
    if (!candidate || !selectedRoute || active || sendingRef.current || pinged.length === 0) return;
    const code = candidate.stop.code;
    const fence = checkInGeofence(place, candidate.stop);
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
              : strings.checkin.noPosition,
      });
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      // The route the card shows comes first, so it stays the check-in's main route
      const routes = pinged.includes(selectedRoute) ? [selectedRoute, ...pinged.filter((value) => value !== selectedRoute)] : pinged;
      const result = await cloudCheckIn(routes, code);
      if (!result.ok) {
        if (result.reason === 'sign_in') router.push('/sign-in');
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
    endCheckIn(boarded);
    setCountsKey((key) => key + 1);
  };

  // While verification is off this always answers "unverified"
  const verification = active ? verifyCheckIn({ routeCode: checkIn.routeCode, stationCode: checkIn.stationCode }) : null;
  const left = active ? remainingMs(checkIn, now) : 0;
  const countdown = active ? formatCountdown(left) : '';
  const activeStop = active ? stops.find((stop) => stop.code === checkIn.stationCode) : undefined;

  const metaOf = (code: string, distanceM: number | null) =>
    strings.checkin.meta([
      code,
      ...(distanceM !== null ? [strings.checkin.distance(distanceM), strings.checkin.walkMin(Math.round(distanceM / WALK_SPEED_M_PER_MIN))] : []),
      ...(byStation ? [strings.checkin.waiting(waitingAt(code))] : []),
    ]);

  const activeCard = active ? (
    <Animated.View key="active" entering={FadeIn.duration(motion.cardMs)} style={styles.section}>
      <View style={styles.row} accessible accessibilityLabel={strings.checkin.countdownLabel(checkIn.stationCode, countdown)}>
        <View style={styles.badges}>
          {checkIn.routeCodes.map((code) => (
            <LineBadge key={code} code={code} color={badgeColor(code)} />
          ))}
        </View>
        <View style={styles.grow}>
          <Text style={typography.headlineSm} numberOfLines={1}>
            {activeStop?.name ?? checkIn.stationCode}
          </Text>
          <Text style={typography.bodySm} numberOfLines={1}>
            {strings.checkin.meta([checkIn.stationCode, strings.checkin.waiting(Math.max(waitingAt(checkIn.stationCode), 1))])}
          </Text>
        </View>
        <View style={styles.activePill}>
          <Clock color={colors.success} size={ICON_SIZE} />
          <Text style={[typography.labelMd, styles.activeText]}>{countdown}</Text>
        </View>
      </View>
      <ExpiryBar fraction={left / (CHECKIN_LIFETIME_S * MS_PER_S)} minutes={CHECKIN_LIFETIME_S / S_PER_MIN} />
      <View style={styles.pills}>
        <StatusPill label={crowd.checkins.source === 'demo' ? strings.common.demo : strings.checkin.shared} tone="neutral" />
        <StatusPill label={verification?.status === 'verified' ? strings.checkin.checkIn : strings.checkin.notVerified} tone="warning" />
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
      <View>
        <Text style={typography.headlineSm} accessibilityRole="header">
          {strings.checkin.title}
        </Text>
        <Text style={typography.bodySm}>
          {shownRoute ? strings.checkin.meta([strings.checkin.tapHint, strings.checkin.stopsCount(layers.stops.length)]) : strings.checkin.pickHint}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {routeCodes.map((code) => (
          <RouteChip
            key={code}
            code={code}
            color={badgeColor(code)}
            selected={code === shownRoute}
            onPress={() => pickRoute(code)}
            accessibilityLabel={strings.live.routeChip(code, code === shownRoute)}
          />
        ))}
      </ScrollView>
      {shownRoute && layers.stops.length === 0 ? <Text style={typography.bodyMd}>{strings.checkin.noStations}</Text> : null}
      {candidate ? (
        <Animated.View key={candidate.stop.code} entering={FadeInDown.duration(motion.cardMs)} style={styles.inner}>
          <View style={styles.row}>
            <IconTile icon={candidate.nearest ? Navigation : MapPin} />
            <View style={styles.grow}>
              <Text style={[typography.labelSm, styles.overline]}>{candidate.nearest ? strings.checkin.nearest : strings.checkin.picked}</Text>
              <Text style={typography.labelLg} numberOfLines={1}>
                {candidate.stop.name}
              </Text>
              <View style={styles.metaRow}>
                <Footprints color={colors.textSecondary} size={ICON_SIZE} />
                <Text style={[typography.bodySm, styles.grow]} numberOfLines={1}>
                  {metaOf(candidate.stop.code, candidate.distanceM)}
                </Text>
              </View>
            </View>
            <Button
              label={strings.checkin.checkIn}
              onPress={() => void doCheckIn()}
              disabled={sending || pinged.length === 0}
              accessibilityLabel={strings.checkin.checkInAt(candidate.stop.code)}
            />
          </View>
          {stopRoutes.length > 1 ? (
            <RoutePing routes={stopRoutes} picked={pinged} onChange={(routes) => setPing({ station: candidate.stop.code, routes })} />
          ) : null}
        </Animated.View>
      ) : null}
      {!hintSeen ? <Hint text={strings.hints.checkin} onDismiss={() => dismissHint('checkin')} /> : null}
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      {tiles.status === 'ready' ? (
        <OfflineMap
          tilesUrl={tiles.tiles.url}
          glyphsUrl={tiles.tiles.glyphsUrl}
          labelsDimmed={shownRoute !== null}
          initialBounds={initialBounds}
          focus={focus}
          bottomInset={cardHeight}
        >
          <RouteLines lines={layers.lines} visible={ALL_DIRECTIONS} opacity={faint} />
          <StopDots
            stops={layers.stops}
            selectedCode={active ? checkIn.stationCode : (candidate?.stop.code ?? null)}
            onPressStop={active ? undefined : pickStation}
            color={shownRoute ? badgeColor(shownRoute) : undefined}
          />
        </OfflineMap>
      ) : (
        <View style={styles.centered}>
          <Logo size={LOGO_SIZE} />
        </View>
      )}
      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <TopBar />
      </View>

      <Animated.View
        style={[styles.card, elevation.level3]}
        layout={LinearTransition.duration(motion.cardMs)}
        onLayout={(event) => setCardHeight(Math.round(event.nativeEvent.layout.height) + spacing.md)}
      >
        {activeCard}
        {pickCard}
      </Animated.View>
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
  topBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  card: {
    position: 'absolute',
    left: spacing.sm + spacing.xs,
    right: spacing.sm + spacing.xs,
    bottom: spacing.sm + spacing.xs,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  section: {
    gap: spacing.sm + spacing.xs,
  },
  inner: {
    gap: spacing.sm + spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  grow: {
    flex: 1,
  },
  badges: {
    gap: spacing.xs,
  },
  overline: {
    color: colors.primary,
    textTransform: 'uppercase',
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
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chips: {
    gap: spacing.sm,
  },
}));
