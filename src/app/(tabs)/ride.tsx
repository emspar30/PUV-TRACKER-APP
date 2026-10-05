import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, Hint, LineBadge, Logo, TopBar } from '@/components';
import { TILESET } from '@/data/map/tileset';
import { DRAFT_ROUTE_CODES } from '@/data/seed/routes';
import { useRouteData } from '@/data/RouteDataProvider';
import { OfflineMap, type MapFocus, type MapFocusTarget } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { useRouteLayers } from '@/features/map/useRouteLayers';
import { DevBenchmark } from '@/features/plan/DevBenchmark';
import { TripLayers, type TripPin } from '@/features/plan/TripLayers';
import type { PickTarget, PickedPoint } from '@/features/ride/PointPills';
import { FareSummaryCard, SuggestedRouteCard } from '@/features/ride/RideCards';
import { RideFailure } from '@/features/ride/RideResult';
import { TripCard } from '@/features/ride/TripCard';
import { DEMO_COMMUTER_STOP_CODE, FARE_REGULAR_MULTIPLIER } from '@/shared/config';
import { discountMultiplier } from '@/shared/fare/fare';
import { boundsOfLines, clipBounds, withMinimumSpan } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { projectOntoLine } from '@/shared/geo/line';
import { describePoint, nearestStop, snapToRoute } from '@/shared/routing/describe';
import { explainFailure, type FailureExplanation } from '@/shared/routing/explainFailure';
import { fareForItinerary, planTrip } from '@/shared/routing/plan';
import type { DirectedLine, RouteDirection, RouteStop } from '@/shared/routing/types';
import { isSingleLegRoute, stopsForRoute, toggleRoute } from '@/shared/ui/routeVisibility';
import { useDestinationsStore } from '@/state/destinationsStore';
import { useFareType } from '@/state/fareType';
import { useHintsStore } from '@/state/hintsStore';
import { useSettingsStore } from '@/state/settingsStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const LOGO_SIZE = spacing.xl * 2;
const MAP_HEIGHT = 260;
const ICON_SIZE = spacing.md + spacing.xs;
const FIELD_NAME: Record<PickTarget, string> = { origin: strings.ride.from, destination: strings.ride.to };

type RouteCard = { code: string; color: string; from: string; to: string; name: string; lines: DirectedLine[]; hasMap: boolean };

// One card per public route code, with its two end stops along its first stored line, or its name
// when the route has no stops yet
function routeCards(lines: DirectedLine[], stops: RouteStop[]): RouteCard[] {
  const codes = [...new Set(lines.map((line) => line.routeCode))];
  return codes.map((code) => {
    const ofRoute = lines.filter((line) => line.routeCode === code);
    const first = ofRoute.find((line) => line.direction === 'outbound') ?? ofRoute[0];
    const hasMap = ofRoute.some((line) => line.coordinates.length >= 2);
    const ordered = hasMap
      ? stopsForRoute(lines, stops, code).sort(
          (a, b) => projectOntoLine(first.coordinates, a).chainageKm - projectOntoLine(first.coordinates, b).chainageKm,
        )
      : [];
    return {
      code,
      color: first.color,
      from: ordered[0]?.code ?? '',
      to: ordered[ordered.length - 1]?.code ?? '',
      name: first.name.split(',')[0],
      lines: ofRoute,
      hasMap,
    };
  });
}

// My Rides (restyle): a map preview, From and To, the distance and fare, the suggested route with
// ways on to the Map and Check-in tabs, every route, and the user's places. Planning runs on the phone.
export default function MyRidesScreen() {
  const styles = useStyles();
  const { colors, typography, mapRoute, routeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { lines, stops, isPlaceholder } = useRouteData();
  const { state: tiles } = useOfflineTiles();
  const [fareType] = useFareType();
  const demo = useSettingsStore((state) => state.demoData);
  const hintSeen = useHintsStore((state) => state.seen.ride);
  const dismissHint = useHintsStore((state) => state.dismiss);
  const destinations = useDestinationsStore((state) => state.destinations);

  // Until "Use my location" (G0), the demo commuter waits at a fixed stop (the same one as on Map)
  const myStop = demo ? (stops.find((stop) => stop.code === DEMO_COMMUTER_STOP_CODE) ?? null) : null;
  const myPosition = useMemo<PickedPoint | null>(
    () => (myStop ? { lat: myStop.lat, lon: myStop.lon, label: strings.ride.you(myStop.code) } : null),
    [myStop],
  );

  const [origin, setOrigin] = useState<PickedPoint | null>(myPosition);
  const [destination, setDestination] = useState<PickedPoint | null>(null);
  const [active, setActive] = useState<PickTarget>(myPosition ? 'destination' : 'origin');
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

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
  const cards = useMemo(() => routeCards(lines, stops), [lines, stops]);

  const pinnedPoint = useCallback(
    (position: LatLon): PickedPoint => {
      const { nearestStopCode } = describePoint(lines, stops, position);
      return { ...position, label: nearestStopCode ? strings.ride.near(nearestStopCode) : strings.ride.pinned };
    },
    [lines, stops],
  );
  const stopPoint = useCallback((stop: RouteStop): PickedPoint => ({ lat: stop.lat, lon: stop.lon, label: stop.code }), []);

  const plan = useMemo(() => (origin && destination ? planTrip(lines, origin, destination) : null), [lines, origin, destination]);
  const itinerary = plan?.ok ? plan.itinerary : null;
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

  const layers = useRouteLayers(lines, stops, 'ride', selectedRoute, itinerary !== null);

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

  const showRoute = (card: RouteCard) => {
    const next = toggleRoute(selectedRoute, card.code);
    setSelectedRoute(next);
    if (next) moveCamera({ kind: 'bounds', bounds: boundsOfLines(card.lines.map((line) => line.coordinates)) });
  };

  const needsPick = !origin || !destination;
  const ride = itinerary?.legs[1] ?? null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <TopBar />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.map}>
          {tiles.status === 'ready' ? (
            <OfflineMap
              tilesUrl={tiles.tiles.url}
              glyphsUrl={tiles.tiles.glyphsUrl}
              labelsDimmed={selectedRoute !== null || itinerary !== null}
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
          {isPlaceholder ? (
            <View style={styles.mapChip}>
              <Chip label={strings.common.sampleData} />
            </View>
          ) : null}
        </View>

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

        {plan && !plan.ok ? (
          <RideFailure failure={plan} explanation={explanation} action={failureAction} badgeColor={colorOf} />
        ) : null}

        {itinerary && fare && ride ? (
          <>
            <FareSummaryCard itinerary={itinerary} fare={fare} regularFare={regularFare} classification={fareType} />
            <Text style={typography.headlineSm}>{strings.ride.suggested}</Text>
            <SuggestedRouteCard
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

        <Text style={typography.overline}>{strings.ride.otherRoutes}</Text>
        {cards.map((card) => (
          <Pressable
            key={card.code}
            style={[styles.routeRow, card.code === selectedRoute && styles.routeRowSelected]}
            onPress={() => (card.hasMap ? showRoute(card) : undefined)}
            disabled={!card.hasMap}
            accessibilityRole="button"
            accessibilityState={{ selected: card.code === selectedRoute }}
            accessibilityLabel={strings.live.routeChip(card.code, card.code === selectedRoute)}
          >
            <LineBadge code={card.code} color={routeColor(card.code, card.color)} />
            <View style={styles.grow}>
              <Text style={typography.labelLg}>{card.name}</Text>
              <Text style={typography.bodySm}>
                {!card.hasMap ? strings.ride.mapComingSoon : card.from && card.to ? strings.ride.routeEnds(card.from, card.to) : ''}
              </Text>
            </View>
            {DRAFT_ROUTE_CODES.has(card.code) ? <Chip label={strings.common.draft} /> : null}
            {isSingleLegRoute(lines, card.code) ? <Chip label={strings.common.partial} /> : null}
            <ChevronRight color={colors.textSecondary} size={ICON_SIZE} />
          </Pressable>
        ))}

        {destinations.length > 0 ? (
          <>
            <Text style={typography.overline}>{strings.ride.yourPlaces}</Text>
            <View style={styles.places}>
              {destinations.map((place, index) => (
                <Pressable
                  key={place.id}
                  style={[styles.place, index > 0 && styles.placeDivider]}
                  onPress={() => {
                    setActive('destination');
                    const point = { lat: place.lat, lon: place.lon, label: place.label };
                    setDestination(point);
                    if (origin) frameBoth(origin, point);
                  }}
                  accessibilityRole="button"
                >
                  <MapPin color={colors.textSecondary} size={ICON_SIZE} />
                  <Text style={[typography.labelLg, styles.grow]}>{place.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <DevBenchmark lines={lines} />
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
    paddingTop: 0,
  },
  map: {
    height: MAP_HEIGHT,
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  mapChip: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
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
  routeRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
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
