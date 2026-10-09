import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { ChevronRight, MapPin, Star } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Chip, Hint, LineBadge, Logo, SkeletonCard, TopBar, type SheetRequest } from '@/components';
import { useRepositories } from '@/data/live/useRepositories';
import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { LANDMARKS } from '@/data/seed/landmarks.placeholder';
import { useSkeleton } from '@/features/loading/useSkeleton';
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
import { FARE_REGULAR_MULTIPLIER, FREQUENT_DESTINATIONS_MAX, PLACE_SEARCH_MAX_RESULTS, SKELETON_MIN_MS } from '@/shared/config';
import { discountMultiplier } from '@/shared/fare/fare';
import { boundsOfLines, clipBounds, withMinimumSpan } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { describePoint, nearestStop, snapToRoute } from '@/shared/routing/describe';
import { placeIdOf } from '@/shared/routing/suggest';
import { searchPlaces, type SearchablePlace } from '@/shared/routing/placeSearch';
import { explainFailure, type FailureExplanation } from '@/shared/routing/explainFailure';
import { fareForItinerary, planOptions, planTrip } from '@/shared/routing/plan';
import { rankRouteOptions } from '@/shared/routing/rankOptions';
import type { DirectedLine, RouteDirection, RouteStop } from '@/shared/routing/types';
import type { SnapName } from '@/shared/ui/sheetSnap';
import { useDestinationsStore } from '@/state/destinationsStore';
import { useFareType } from '@/state/fareType';
import { useHintsStore } from '@/state/hintsStore';
import { useCountsStore } from '@/state/countsStore';
import { useRidesStore } from '@/state/ridesStore';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const LOGO_SIZE = spacing.xl * 2;
const RECENT_SHOWN = 3;
const MS_PER_MIN = 60000;
const ICON_SIZE = spacing.md + spacing.xs;

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

// My Rides (restyle): From and To, the distance and fare, the best-matching route with ways on to
// the Map and Check-in tabs, the other routes that serve the trip, and recent rides. ST2-C: From and
// To are pinned under the top bar, the map fills the rest of the screen, and the results sit in a
// sheet over it that opens half way when a trip is planned. Planning runs on the phone; the ranking
// uses the live (or demo) multicabs coming to the stop.
export default function MyRidesScreen() {
  const styles = useStyles();
  const { colors, typography, mapRoute, routeColor, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const { lines, stops } = useRouteData();
  const { state: tiles } = useOfflineTiles();
  const [fareType] = useFareType();
  const hintSeen = useHintsStore((state) => state.seen.ride);
  const dismissHint = useHintsStore((state) => state.dismiss);
  const destinations = useDestinationsStore((state) => state.destinations);
  const addDestination = useDestinationsStore((state) => state.add);
  const removeDestination = useDestinationsStore((state) => state.remove);
  const recentRides = useRidesStore((state) => state.rides);
  // B8: the results show a skeleton on the first visit
  const loadingResults = useSkeleton(SKELETON_MIN_MS);
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
  // ST2-C2: the field being typed in and the text; the card folded to one line; its height over the map
  const [searching, setSearching] = useState<PickTarget | null>(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
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
      setSearching(null);
      setQuery('');
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

  // F5: a planned trip counts for the "First trip planned" badge, once per From and To
  const addTrip = useCountsStore((state) => state.addTrip);
  const tripKey = origin && destination && itinerary ? `${placeIdOf(origin)}>${placeIdOf(destination)}` : null;
  useEffect(() => {
    if (tripKey) addTrip(tripKey);
  }, [tripKey, addTrip]);

  // F3: To saved as a frequent destination: a stop or a tapped point, named as To reads
  const samePoint = (item: LatLon) => destination !== null && item.lat === destination.lat && item.lon === destination.lon;
  const destinationId = destination
    ? (destinations.find(samePoint)?.id ?? LANDMARKS.find(samePoint)?.id ?? placeIdOf(destination))
    : null;
  const destinationSaved = destinationId !== null && destinations.some((item) => item.id === destinationId);
  // ST2-C2: the star saves To, and a second tap removes it from Your Places
  const toggleDestination = () => {
    if (!destination || !destinationId) return;
    if (destinationSaved) {
      removeDestination(destinationId);
      showToast({ icon: Star, title: strings.places.removed(destination.label) });
      return;
    }
    const result = addDestination({ id: destinationId, label: destination.label, lat: destination.lat, lon: destination.lon });
    showToast({
      icon: Star,
      title:
        result === 'added'
          ? strings.places.saved(destination.label)
          : result === 'duplicate'
            ? strings.places.already
            : strings.places.full(FREQUENT_DESTINATIONS_MAX),
    });
  };

  const swap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  const clearField = (target: PickTarget) => {
    if (target === 'origin') setOrigin(null);
    else setDestination(null);
    setActive(target);
  };

  // ST2-C2: tapping a field highlights it and opens typing in it; a second tap on the field typed in
  // closes the typing
  const activate = (target: PickTarget) => {
    setActive(target);
    setCollapsed(false);
    setQuery('');
    setSearching((current) => (current === target ? null : target));
  };

  // ST2-C2: typed search over the stops and the saved places (no network). With nothing typed yet,
  // the saved places are offered.
  const searchable = useMemo<SearchablePlace[]>(
    () => [
      ...destinations.map((place) => ({ id: place.id, title: place.label, lat: place.lat, lon: place.lon, kind: 'saved' as const })),
      ...stops.map((stop) => ({ id: `stop-${stop.code}`, title: stop.name, code: stop.code, lat: stop.lat, lon: stop.lon, kind: 'stop' as const })),
    ],
    [destinations, stops],
  );
  const matches = useMemo(
    () =>
      searching === null
        ? []
        : query.trim().length > 0
          ? searchPlaces(query, searchable, PLACE_SEARCH_MAX_RESULTS)
          : searchable.filter((place) => place.kind === 'saved').slice(0, PLACE_SEARCH_MAX_RESULTS),
    [searching, query, searchable],
  );
  const choose = (place: SearchablePlace) => pick({ lat: place.lat, lon: place.lon, label: place.code ?? place.title });

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

  // ST2-C: a new result (a route, or no route) opens the sheet half way, once per result. Applied
  // while rendering, with no effect.
  const resultId = !origin || !destination || !plan ? null : itinerary ? `ok:${itinerary.legs[1].routeCode}` : `fail:${plan.ok ? '' : plan.reason}`;
  const resultKey = resultId && origin && destination ? `${placeIdOf(origin)}>${placeIdOf(destination)}>${resultId}` : null;
  const [seenResult, setSeenResult] = useState(resultKey);
  const [sheetRequest, setSheetRequest] = useState<SheetRequest | null>(null);
  // ST2-C: framed trips keep clear of the sheet (peek or half; fully open is a reading view, so the
  // map keeps the last clearance). A new height right after a fit frames the trip again.
  const [sheetInset, setSheetInset] = useState(0);
  const onSheetSnap = useCallback((snap: SnapName, visibleHeight: number) => {
    if (snap !== 'expanded') setSheetInset(visibleHeight);
  }, []);
  if (resultKey !== seenResult) {
    setSeenResult(resultKey);
    if (resultKey) setSheetRequest((current) => ({ key: (current?.key ?? 0) + 1, snap: 'half' }));
  }

  const nearestCode = (point: LatLon) => nearestStop(stops, point)?.stop.code ?? '';
  const colorOf = (code: string) => routeColor(code, lines.find((line) => line.routeCode === code)?.color ?? colors.primary);

  const needsPick = !origin || !destination;
  const ride = itinerary?.legs[1] ?? null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <TopBar />
      </View>
      {/* The map fills the rest, so a drag on it always pans the map; From and To float over its top
          (ST2-C2) and the results sheet over its bottom */}
      <View style={styles.grow}>
        <View style={styles.map}>
          {tiles.status === 'ready' ? (
            <OfflineMap
              tilesUrl={tiles.tiles.url}
              glyphsUrl={tiles.tiles.glyphsUrl}
              labelsDimmed={itinerary !== null}
              bottomInset={sheetInset}
              topInset={cardHeight}
              initialBounds={initialBounds}
              focus={focus}
              onPress={(position) => pick(pinnedPoint(position))}
            >
              <RouteLines lines={layers.lines} visible={ALL_DIRECTIONS} opacity={layers.opacity} />
              {/* ST2-C2: every stop, so one can be tapped for From or To */}
              <StopDots
                stops={stops}
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
        </View>
        <View style={styles.overlay} pointerEvents="box-none">
          <View onLayout={(event) => setCardHeight(event.nativeEvent.layout.height + spacing.sm)}>
            <TripCard
              origin={origin}
              destination={destination}
              active={active}
              onActivate={activate}
              onClear={clearField}
              onSwap={swap}
              onUseMyPosition={myPosition ? () => pick(myPosition) : undefined}
              onToggleDestination={toggleDestination}
              destinationSaved={destinationSaved}
              searching={searching}
              query={query}
              onQuery={setQuery}
              onSubmitQuery={() => (matches[0] ? choose(matches[0]) : undefined)}
              collapsed={collapsed}
              onToggleCollapsed={() => {
                setCollapsed((value) => !value);
                setSearching(null);
              }}
            />
          </View>
          {searching !== null && (matches.length > 0 || query.trim().length > 0) ? (
            <View style={[styles.results, elevation.level2]}>
              {matches.length === 0 ? <Text style={[typography.bodyMd, styles.noMatch]}>{strings.ride.noMatches}</Text> : null}
              {matches.map((place, index) => (
                <Pressable
                  key={place.id}
                  style={[styles.result, index > 0 && styles.placeDivider]}
                  onPress={() => choose(place)}
                  accessibilityRole="button"
                  accessibilityLabel={strings.ride.searchResult(place.title)}
                >
                  {place.kind === 'saved' ? <Star color={colors.warning} size={ICON_SIZE} /> : <MapPin color={colors.primary} size={ICON_SIZE} />}
                  <View style={styles.grow}>
                    <Text style={typography.labelLg} numberOfLines={1}>
                      {place.title}
                    </Text>
                    <Text style={typography.bodySm}>{place.kind === 'saved' ? strings.ride.savedPlace : place.code}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <BottomSheet
          id="ride"
          request={sheetRequest}
          onSnapChange={onSheetSnap}
          header={
            !loadingResults && itinerary && fare && ride ? (
              <View style={styles.peek}>
                <LineBadge code={ride.routeCode} color={colorOf(ride.routeCode)} small />
                <Text style={[typography.labelLg, styles.grow]} numberOfLines={1}>
                  {cards.find((card) => card.code === ride.routeCode)?.name ?? ride.routeCode}
                </Text>
                <Text style={typography.labelLg}>{strings.ride.fare(fare.rounded)}</Text>
              </View>
            ) : (
              <Text style={typography.labelLg} numberOfLines={1}>
                {loadingResults ? strings.ride.finding : needsPick ? strings.ride.choose : strings.ride.noRoute}
              </Text>
            )
          }
        >
          {loadingResults ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : null}
          {!loadingResults && !hintSeen && needsPick ? <Hint text={strings.hints.ride} onDismiss={() => dismissHint('ride')} /> : null}

          {!loadingResults && plan && !plan.ok && ranked.length === 0 ? (
            <RideFailure failure={plan} explanation={explanation} action={failureAction} badgeColor={colorOf} />
          ) : null}

          {!loadingResults && itinerary && fare && ride ? (
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

          {!loadingResults && ranked.length > 1 ? (
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

          {!loadingResults && recentRides.length > 0 ? (
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
        </BottomSheet>
      </View>
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
  // ST2-C2: From and To floating over the top of the map, with the typed matches under them
  overlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  results: {
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },
  result: {
    minHeight: MIN_TOUCH_TARGET + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
  },
  noMatch: {
    padding: spacing.md,
  },
  map: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  peek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
