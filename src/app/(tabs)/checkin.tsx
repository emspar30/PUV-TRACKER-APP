import { router } from 'expo-router';
import { Bus, Clock, LocateOff, MapPin, MapPinOff, Navigation, Radio, ShieldQuestionMark, Users, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Button, Hint, IconTile, LineBadge, Logo, RouteChip, type SheetRequest, StatusPill, TopBar } from '@/components';
import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { ExpiryBar, StationRow, StatTile } from '@/features/checkin/CheckInParts';
import { OfflineMap, type MapFocus } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useCommuterPosition } from '@/features/map/useCommuterPosition';
import { useLocationTracking } from '@/features/map/useLocationTracking';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { useRouteLayers } from '@/features/map/useRouteLayers';
import { checkInGeofence, type Place } from '@/shared/checkin/geofence';
import { formatCountdown, isActive, remainingMs } from '@/shared/checkin/localCheckin';
import { CHECKIN_COUNTS_REFRESH_S, CHECKIN_LIFETIME_S, CHECKIN_RADIUS_M, GPS_ACCURACY_GATE_CHECKIN_M } from '@/shared/config';
import { boundsOfLines, clipBounds } from '@/shared/geo/bounds';
import { haversineMeters } from '@/shared/geo/haversine';
import type { RouteDirection } from '@/shared/routing/types';
import { routeCodesOf, toggleRoute } from '@/shared/ui/routeVisibility';
import { verifyCheckIn } from '@/shared/verification/verifyCheckIn';
import { useCheckInStore } from '@/state/checkinStore';
import { checkIn as cloudCheckIn, endCheckIn, useCrowd } from '@/state/crowdStore';
import { showDialog } from '@/state/dialogStore';
import { useHintsStore } from '@/state/hintsStore';
import { useLocationStore } from '@/state/locationStore';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const LOGO_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md;
const TICK_MS = 1000;
const MS_PER_S = 1000;
const S_PER_MIN = 60;

// Check-in (C1, laid out after Google Maps' place sheet): the peek row always names one station,
// the nearest on the picked route or the one tapped, with its distance, the people waiting and a
// Check in button. Higher up: the routes and a list of stations. The phone must be within the
// station's radius (or at the simulated stop); the check-in goes to the cloud (or the demo), earns
// Energy and lasts 15 minutes. While it runs, the sheet shows the station, the time left as a pill
// and a bar, three facts and the two endings. Refusals and failures open the app's dialog.
export default function CheckInScreen() {
  const styles = useStyles();
  const { colors, typography, routeColor } = useTheme();
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
  const [now, setNow] = useState(() => Date.now());
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [sheetRequest, setSheetRequest] = useState<SheetRequest | null>(null);

  const active = isActive(checkIn, now);
  // A running check-in shows its own route
  const shownRoute = active ? checkIn.routeCode : selectedRoute;
  const layers = useRouteLayers(lines, stops, 'checkin', shownRoute);
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

  // The stations of the shown route with their distance, nearest first when the position is known
  const rows = useMemo(() => {
    const withDistance = layers.stops.map((stop) => ({
      stop,
      distanceM: positioned ? Math.round(haversineMeters(positioned, stop)) : null,
    }));
    return positioned ? [...withDistance].sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0)) : withDistance;
  }, [layers.stops, positioned]);
  // The station of the peek row: the one tapped, else the nearest
  const candidate = rows.find((row) => row.stop.code === stationCode) ?? (positioned ? rows[0] : undefined) ?? null;
  const isNearest = candidate !== null && stationCode === null;
  const metaOf = (code: string, distanceM: number | null) =>
    strings.checkin.meta([
      code,
      ...(distanceM !== null ? [strings.checkin.distance(distanceM)] : []),
      ...(byStation ? [strings.checkin.waiting(waitingAt(code))] : []),
    ]);

  // The routes' box, clipped to the tile set so the opening view always has map data (RR1)
  const initialBounds = useMemo(() => clipBounds(boundsOfLines(lines.map((line) => line.coordinates)), TILESET.bounds), [lines]);
  const badgeColor = (code: string) => routeColor(code, lines.find((line) => line.routeCode === code)?.color ?? colors.primary);

  const pickRoute = (code: string) => {
    const next = toggleRoute(selectedRoute, code);
    setSelectedRoute(next);
    setStationCode(null);
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
    if (!candidate || !selectedRoute || active || sendingRef.current) return;
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
      const result = await cloudCheckIn(selectedRoute, code);
      if (!result.ok) {
        if (result.reason === 'sign_in') router.push('/sign-in');
        else showDialog({ tone: 'danger', title: strings.checkin.failedTitle, body: result.message ?? strings.checkin.failedBody });
        return;
      }
      setNow(Date.now());
      setCountsKey((key) => key + 1);
      dismissHint('checkin');
      setSheetRequest((current) => ({ key: (current?.key ?? 0) + 1, snap: 'half' }));
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

  const header = active ? (
    <View style={styles.peek} accessible accessibilityLabel={strings.checkin.countdownLabel(checkIn.stationCode, countdown)}>
      <LineBadge code={checkIn.routeCode} color={badgeColor(checkIn.routeCode)} />
      <View style={styles.grow}>
        <Text style={typography.headlineSm} numberOfLines={1}>
          {activeStop?.name ?? checkIn.stationCode}
        </Text>
        <Text style={typography.bodySm} numberOfLines={1}>
          {strings.checkin.meta([checkIn.stationCode, strings.checkin.routeOf(checkIn.routeCode)])}
        </Text>
      </View>
      <View style={styles.activePill}>
        <Clock color={colors.success} size={ICON_SIZE} />
        <Text style={[typography.labelMd, styles.activeText]}>{strings.checkin.active(strings.checkin.countdown(countdown))}</Text>
      </View>
    </View>
  ) : (
    <View style={styles.peek}>
      <IconTile icon={isNearest ? Navigation : MapPin} />
      <View style={styles.grow}>
        {candidate ? (
          <>
            <Text style={typography.headlineSm} numberOfLines={1}>
              {candidate.stop.name}
            </Text>
            {/* Two lines only, so the row fits the peek height */}
            <Text style={typography.bodySm} numberOfLines={1}>
              <Text style={styles.overline}>{isNearest ? strings.checkin.nearest : strings.checkin.picked}</Text>
              {` · ${metaOf(candidate.stop.code, candidate.distanceM)}`}
            </Text>
          </>
        ) : (
          <>
            <Text style={typography.headlineSm} numberOfLines={1}>
              {strings.checkin.title}
            </Text>
            <Text style={typography.bodySm} numberOfLines={1}>
              {selectedRoute ? strings.checkin.pickStation : strings.live.pickRoute}
            </Text>
          </>
        )}
      </View>
      <Button
        label={strings.checkin.checkIn}
        onPress={() => void doCheckIn()}
        disabled={!candidate || sending}
        accessibilityLabel={candidate ? strings.checkin.checkInAt(candidate.stop.code) : strings.checkin.pickStationFirst}
      />
    </View>
  );

  // Above the sheet: what the geofence will use, so a refusal is never a surprise
  const locationPill = positioned
    ? positioned.source === 'simulated'
      ? strings.checkin.simulatedPill(commuter?.stopCode ?? '')
      : strings.checkin.gpsPill(Math.round(positioned.accuracyM ?? 0))
    : strings.checkin.noLocationPill;
  const floating = active ? null : (
    <View style={styles.floating} pointerEvents="none">
      <StatusPill label={locationPill} tone={positioned ? 'success' : 'warning'} />
      <StatusPill label={strings.checkin.radiusPill(CHECKIN_RADIUS_M)} tone="neutral" />
    </View>
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
          bottomInset={sheetHeight}
        >
          <RouteLines lines={layers.lines} visible={ALL_DIRECTIONS} opacity={layers.opacity} />
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

      <BottomSheet
        id="checkin"
        defaultSnap="half"
        request={sheetRequest}
        onSnapChange={(_snap, visibleHeight) => setSheetHeight(visibleHeight)}
        header={header}
        floating={floating}
      >
        {active ? (
          <View style={styles.section}>
            <View style={styles.tiles}>
              <StatTile icon={Users} value={strings.checkin.waiting(waitingAt(checkIn.stationCode) || 1)} caption={strings.checkin.inclYou} />
              <StatTile
                icon={Radio}
                value={crowd.checkins.source === 'demo' ? strings.common.demo : strings.checkin.sharedShort}
                caption={crowd.checkins.source === 'demo' ? strings.checkin.demoOnly : strings.checkin.visibility}
              />
              <StatTile
                icon={ShieldQuestionMark}
                value={verification?.status === 'verified' ? strings.checkin.checkIn : strings.checkin.unverified}
                caption={strings.checkin.locationCheck}
              />
            </View>
            <ExpiryBar fraction={left / (CHECKIN_LIFETIME_S * MS_PER_S)} minutes={CHECKIN_LIFETIME_S / S_PER_MIN} />
            <View style={styles.note}>
              <ShieldQuestionMark color={colors.textSecondary} size={ICON_SIZE} />
              <Text style={[typography.bodySm, styles.grow]}>{strings.checkin.boardingNote}</Text>
            </View>
            <Button label={strings.checkin.boarded} leadingIcon={Bus} onPress={() => finish(true)} />
            <Button label={strings.checkin.cancelCheckIn} leadingIcon={X} variant="secondary" onPress={() => finish(false)} />
          </View>
        ) : (
          <View style={styles.section}>
            {!hintSeen ? <Hint text={strings.hints.checkin} onDismiss={() => dismissHint('checkin')} /> : null}
            <Text style={[typography.labelSm, styles.overline]}>{strings.checkin.route}</Text>
            <View style={styles.chips}>
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
            </View>

            {shownRoute ? (
              <>
                <Text style={[typography.labelSm, styles.overline]}>{strings.checkin.stations}</Text>
                {layers.stops.length === 0 ? <Text style={typography.bodyMd}>{strings.checkin.noStations}</Text> : null}
                <View style={styles.list}>
                  {rows.map(({ stop, distanceM }) => (
                    <StationRow
                      key={stop.code}
                      name={stop.name}
                      meta={metaOf(stop.code, distanceM)}
                      waiting={waitingAt(stop.code)}
                      color={badgeColor(shownRoute)}
                      selected={stop.code === candidate?.stop.code}
                      onPress={() => pickStation(stop.code)}
                      accessibilityLabel={`${stop.name}, ${metaOf(stop.code, distanceM)}`}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        )}
      </BottomSheet>
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
  peek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  grow: {
    flex: 1,
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
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.successContainer,
  },
  activeText: {
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  floating: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm + spacing.xs,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceLow,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.xs,
  },
}));
