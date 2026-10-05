import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Maximize2, Minimize2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, Hint, LineBadge, Logo, RoundButton, TopBar } from '@/components';
import { useRepositories } from '@/data/live/useRepositories';
import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { OfflineMap, type MapFocus, type MapFocusTarget } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useCommuterPosition } from '@/features/map/useCommuterPosition';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { useRoutesVehicles } from '@/features/vehicles/useRoutesVehicles';
import { useRouteLayers } from '@/features/map/useRouteLayers';
import { TripLayers, type TripPin } from '@/features/plan/TripLayers';
import type { PickTarget, PickedPoint } from '@/features/ride/PointPills';
import { FareSummaryCard, SuggestedRouteCard } from '@/features/ride/RideCards';
import { RideFailure } from '@/features/ride/RideResult';
import { TripCard } from '@/features/ride/TripCard';
import { FARE_REGULAR_MULTIPLIER } from '@/shared/config';
import { discountMultiplier } from '@/shared/fare/fare';
import { boundsOfLines, clipBounds, withMinimumSpan } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { describePoint, nearestStop, snapToRoute } from '@/shared/routing/describe';
import { explainFailure, type FailureExplanation } from '@/shared/routing/explainFailure';
import { fareForItinerary, planOptions, planTrip } from '@/shared/routing/plan';
import { rankRouteOptions } from '@/shared/routing/rankOptions';
import type { DirectedLine, RouteDirection, RouteStop } from '@/shared/routing/types';
import { useDestinationsStore } from '@/state/destinationsStore';
import { useFareType } from '@/state/fareType';
import { useHintsStore } from '@/state/hintsStore';
import { useRidesStore } from '@/state/ridesStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const LOGO_SIZE = spacing.xl * 2;
// Share of the window the map preview takes, and when made bigger
const MAP_SHARE = 0.42;
const MAP_SHARE_EXPANDED = 0.72;
const RECENT_SHOWN = 3;
const MS_PER_MIN = 60000;
const ICON_SIZE = spacing.md + spacing.xs;
const FIELD_NAME: Record<PickTarget, string> = { origin: strings.ride.from, destination: strings.ride.to };

type RouteCard = { code: string; name: string };

// Each public route's display name, from its first stored line
function routeCards(lines: DirectedLine[]): RouteCard[] {
  const codes = [...new Set(lines.map((line) => line.routeCode))];
  return codes.map((code) => {
    const first =
      lines.find((line) => line.routeCode === code && line.direction === 'outbound') ?? lines.find((line) => line.routeCode === code);
    return { code, name: first?.name.split(',')[0] ?? code };
  });
}

// My Rides (restyle): a map preview, From and To, the distance and fare, the best-matching route with
// ways on to the Map and Check-in tabs, the other routes that serve the trip, and recent rides.
// Planning runs on the phone; the ranking uses the live (or demo) multicabs coming to the stop.
export default function MyRidesScreen() {
  const styles = useStyles();
  const { colors, typography, mapRoute, routeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { lines, stops, isPlaceholder } = useRouteData();
  const { state: tiles } = useOfflineTiles();
  const [fareType] = useFareType();
  const hintSeen = useHintsStore((state) => state.seen.ride);
  const dismissHint = useHintsStore((state) => state.dismiss);
  const destinations = useDestinationsStore((state) => state.destinations);
  const recentRides = useRidesStore((state) => state.rides);
  const { height: windowHeight } = useWindowDimensions();
  const [mapExpanded, setMapExpanded] = useState(false);
  // "5 min ago" on recent rides counts from when this screen opened
  const [openedAt] = useState(() => Date.now());
  const repos = useRepositories();
  const focused = useIsFocused();

  // G0: the commuter's GPS fix, a simulated stop (Demo settings) or a long-press pin on the Map
  const commuter = useCommuterPosition();
  const myPosition = useMemo<PickedPoint | null>(() => {
    if (!commuter) return null;
    const label =
      commuter.source === 'simulated' && commuter.stopCode
        ? strings.ride.you(commuter.stopCode)
        : commuter.source === 'gps'
          ? strings.ride.currentLocation
          : strings.ride.pinned;
    return { lat: commuter.lat, lon: commuter.lon, label };
  }, [commuter]);

  const [origin, setOrigin] = useState<PickedPoint | null>(myPosition);
  const [destination, setDestination] = useState<PickedPoint | null>(null);
  const [active, setActive] = useState<PickTarget>(myPosition ? 'destination' : 'origin');
  const [focus, setFocus] = useState<MapFocus | null>(null);
  // The route the rider picked among the alternatives; null follows the best match
  const [chosenRoute, setChosenRoute] = useState<string | null>(null);

  const moveCamera = useCallback((next: MapFocusTarget) => {
    setFocus((current) => ({ ...next, key: (current?.key ?? 0) + 1 }));
  }, []);

  // A frequent-destination chip elsewhere opens this tab with that destination as To. Each tap
  // carries a new time stamp; it is applied once, while rendering, with no effect.
  const params = useLocalSearchParams<{ to?: string; at?: string }>();
  const [appliedRequest, setAppliedRequest] = useState<string | undefined>(undefined);
  if (params.at !== undefined && params.at !== appliedRequest) {
    setAppliedRequest(params.at);
    const target = destinations.find((item) => item.id === params.to);
    if (target) {
      setDestination({ lat: target.lat, lon: target.lon, label: target.label });
      if (!origin) setActive('origin');
      setFocus((current) => ({ key: (current?.key ?? 0) + 1, kind: 'center', center: target }));
    }
  }

  const initialBounds = useMemo(() => clipBounds(boundsOfLines(lines.map((line) => line.coordinates)), TILESET.bounds), [lines]);
  const cards = useMemo(() => routeCards(lines), [lines]);

  const pinnedPoint = useCallback(
    (position: LatLon): PickedPoint => {
      const { nearestStopCode } = describePoint(lines, stops, position);
      return { ...position, label: nearestStopCode ? strings.ride.near(nearestStopCode) : strings.ride.pinned };
    },
    [lines, stops],
  );
  const stopPoint = useCallback((stop: RouteStop): PickedPoint => ({ lat: stop.lat, lon: stop.lon, label: stop.code }), []);

  const plan = useMemo(() => (origin && destination ? planTrip(lines, origin, destination) : null), [lines, origin, destination]);
  const options = useMemo(() => (origin && destination ? planOptions(lines, origin, destination) : []), [lines, origin, destination]);
  const optionRoutes = useMemo(() => options.map((option) => option.legs[1].routeCode), [options]);
  const supply = useRoutesVehicles(repos.vehicles, optionRoutes, !focused);
  const ranked = useMemo(() => rankRouteOptions(options, supply.vehicles, lines, supply.nowMs), [options, supply, lines]);
  const chosen = ranked.find((option) => option.itinerary.legs[1].routeCode === chosenRoute) ?? ranked[0] ?? null;
  const itinerary = chosen?.itinerary ?? null;
  const fare = useMemo(
    () => (itinerary ? fareForItinerary(lines, itinerary, discountMultiplier(fareType)) : null),
    [lines, itinerary, fareType],
  );
  const regularFare = useMemo(
    () => (itinerary ? fareForItinerary(lines, itinerary, FARE_REGULAR_MULTIPLIER).rounded : 0),
    [lines, itinerary],
  );

  const frameBoth = useCallback(
    (a: LatLon, b: LatLon) => {
      const bounds = boundsOfLines([
        [
          [a.lon, a.lat],
          [b.lon, b.lat],
        ],
      ]);
      moveCamera({ kind: 'bounds', bounds: withMinimumSpan(bounds, mapRoute.minFocusSpanDeg) });
    },
    [moveCamera, mapRoute.minFocusSpanDeg],
  );

  // Fill the highlighted field, then move on to the other one if it is empty
  const pick = useCallback(
    (point: PickedPoint) => {
      const nextOrigin = active === 'origin' ? point : origin;
      const nextDestination = active === 'destination' ? point : destination;
      setOrigin(nextOrigin);
      setDestination(nextDestination);
      if (active === 'origin' && !nextDestination) setActive('destination');
      if (active === 'destination' && !nextOrigin) setActive('origin');
      if (nextOrigin && nextDestination) {
        frameBoth(nextOrigin, nextDestination);
        dismissHint('ride');
      } else {
        moveCamera({ kind: 'center', center: point });
      }
    },
    [active, origin, destination, frameBoth, moveCamera, dismissHint],
  );

  const swap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  const clearField = (target: PickTarget) => {
    if (target === 'origin') setOrigin(null);
    else setDestination(null);
    setActive(target);
  };

  const layers = useRouteLayers(lines, stops, 'ride', null, itinerary !== null);

  const pinOf = useCallback(
    (point: PickedPoint | null): TripPin | null => (point ? { point, snapped: describePoint(lines, stops, point).snapped } : null),
    [lines, stops],
  );
  const originPin = useMemo(() => pinOf(origin), [pinOf, origin]);
  const destinationPin = useMemo(() => pinOf(destination), [pinOf, destination]);

  const explanation = useMemo<FailureExplanation>(
    () => (plan && !plan.ok && origin && destination ? explainFailure(lines, plan, origin, destination) : { kind: 'as_planned' }),
    [plan, origin, destination, lines],
  );

  const failureAction = useMemo(() => {
    if (!plan || plan.ok || !origin || !destination) return null;
    if (explanation.kind === 'not_mapped' || explanation.kind === 'different_routes') return null;
    if (plan.reason === 'destination_not_ahead') return { label: strings.ride.swap, onPress: swap };
    if (plan.reason === 'origin_too_far') {
      return { label: strings.ride.moveToRoute, onPress: () => setOrigin(pinnedPoint(snapToRoute(lines, origin))) };
    }
    if (plan.reason === 'destination_too_far') {
      return { label: strings.ride.moveToRoute, onPress: () => setDestination(pinnedPoint(snapToRoute(lines, destination))) };
    }
    return null;
  }, [plan, origin, destination, lines, swap, pinnedPoint, explanation.kind]);

  const nearestCode = (point: LatLon) => nearestStop(stops, point)?.stop.code ?? '';
  const colorOf = (code: string) => routeColor(code, lines.find((line) => line.routeCode === code)?.color ?? colors.primary);

  const needsPick = !origin || !destination;
  const ride = itinerary?.legs[1] ?? null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <TopBar />
      </View>
      {/* The map sits outside the scrolling page, so a drag on it always pans the map */}
      <View style={styles.mapWrap}>
        <View style={[styles.map, { height: windowHeight * (mapExpanded ? MAP_SHARE_EXPANDED : MAP_SHARE) }]}>
          {tiles.status === 'ready' ? (
            <OfflineMap
              tilesUrl={tiles.tiles.url}
              glyphsUrl={tiles.tiles.glyphsUrl}
              labelsDimmed={itinerary !== null}
              initialBounds={initialBounds}
              focus={focus}
              onPress={(position) => pick(pinnedPoint(position))}
            >
              <RouteLines lines={layers.lines} visible={ALL_DIRECTIONS} opacity={layers.opacity} />
              <StopDots
                stops={layers.stops}
                selectedCode={null}
                onPressStop={(code) => {
                  const stop = stops.find((candidate) => candidate.code === code);
                  if (stop) pick(stopPoint(stop));
                }}
              />
              <TripLayers lines={lines} origin={originPin} destination={destinationPin} itinerary={itinerary} />
            </OfflineMap>
          ) : (
            <View style={styles.centered}>
              <Logo size={LOGO_SIZE} />
            </View>
          )}
          <View style={styles.mapChip} pointerEvents="box-none">
            {isPlaceholder ? <Chip label={strings.common.sampleData} /> : null}
            <RoundButton
              icon={mapExpanded ? Minimize2 : Maximize2}
              label={mapExpanded ? strings.ride.shrinkMap : strings.ride.expandMap}
              onPress={() => setMapExpanded((value) => !value)}
            />
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TripCard
          origin={origin}
          destination={destination}
          active={active}
          onActivate={setActive}
          onClear={clearField}
          onSwap={swap}
          onUseMyPosition={myPosition ? () => pick(myPosition) : undefined}
        />

        {!hintSeen && needsPick ? <Hint text={strings.hints.ride} onDismiss={() => dismissHint('ride')} /> : null}

        {needsPick ? (
          <View style={styles.section}>
            <Text style={typography.overline}>{strings.ride.pickStop}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {stops.map((stop) => (
                <Chip
                  key={stop.code}
                  label={stop.code}
                  accessibilityLabel={strings.ride.pickFor(FIELD_NAME[active], `${stop.code}, ${stop.name}`)}
                  onPress={() => pick(stopPoint(stop))}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {plan && !plan.ok && ranked.length === 0 ? (
          <RideFailure failure={plan} explanation={explanation} action={failureAction} badgeColor={colorOf} />
        ) : null}

        {itinerary && fare && ride ? (
          <>
            <FareSummaryCard itinerary={itinerary} fare={fare} regularFare={regularFare} classification={fareType} />
            <Text style={typography.headlineSm}>{strings.ride.suggested}</Text>
            <SuggestedRouteCard
              best={chosen === ranked[0]}
              supply={supply.vehicles.length > 0 && chosen ? { approaching: chosen.approaching, freeSeats: chosen.freeSeats } : null}
              itinerary={itinerary}
              routeName={cards.find((card) => card.code === ride.routeCode)?.name ?? ride.routeCode}
              color={colorOf(ride.routeCode)}
              boardAt={nearestCode(ride.from)}
              getOffAt={nearestCode(ride.to)}
              onViewOnMap={() => router.navigate({ pathname: '/', params: { route: ride.routeCode, at: String(Date.now()) } })}
              onCheckin={() => router.navigate('/checkin')}
            />
          </>
        ) : null}

        {ranked.length > 1 ? (
          <>
            <Text style={typography.overline}>{strings.ride.otherRoutes}</Text>
            {ranked
              .filter((option) => option !== chosen)
              .map((option) => {
                const code = option.itinerary.legs[1].routeCode;
                const summary = strings.ride.summary(option.itinerary.rideKm, option.itinerary.walkM);
                return (
                  <Pressable key={code} style={styles.routeRow} onPress={() => setChosenRoute(code)} accessibilityRole="button">
                    <LineBadge code={code} color={colorOf(code)} />
                    <View style={styles.grow}>
                      <Text style={typography.labelLg}>{cards.find((card) => card.code === code)?.name ?? code}</Text>
                      <Text style={typography.bodySm}>
                        {option.approaching > 0 ? [summary, strings.ride.coming(option.approaching, option.freeSeats)].join(' · ') : summary}
                      </Text>
                    </View>
                    {option === ranked[0] ? <Chip label={strings.ride.bestMatch} /> : null}
                    <ChevronRight color={colors.textSecondary} size={ICON_SIZE} />
                  </Pressable>
                );
              })}
          </>
        ) : null}

        {recentRides.length > 0 ? (
          <>
            <Text style={typography.overline}>{strings.ride.recentRides}</Text>
            <View style={styles.places}>
              {recentRides.slice(0, RECENT_SHOWN).map((recent, index) => {
                const station = stops.find((stop) => stop.code === recent.stationCode);
                const when = strings.ride.ago(Math.floor((Math.max(openedAt, supply.nowMs) - recent.atMs) / MS_PER_MIN));
                return (
                  <Pressable
                    key={[recent.atMs, index].join('-')}
                    style={[styles.place, index > 0 && styles.placeDivider]}
                    onPress={() => (station ? pick(stopPoint(station)) : undefined)}
                    disabled={!station}
                    accessibilityRole="button"
                  >
                    <LineBadge code={recent.routeCode} color={colorOf(recent.routeCode)} />
                    <View style={styles.grow}>
                      <Text style={typography.labelLg}>{strings.ride.recentRide(recent.stationCode)}</Text>
                      <Text style={typography.bodySm}>{[strings.ride.recentFrom(recent.source), when].join(' · ')}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  top: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
  },
  mapWrap: {
    paddingHorizontal: spacing.md,
  },
  map: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  mapChip: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  chips: {
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  routeRow: {
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  places: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  place: {
    minHeight: MIN_TOUCH_TARGET + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
  },
  placeDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
}));
