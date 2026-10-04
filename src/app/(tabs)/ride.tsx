import { useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarButton, BottomSheet, Chip, LineBadge, Logo, type SheetRequest } from '@/components';
import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { OfflineMap, type MapFocus, type MapFocusTarget } from '@/features/map/OfflineMap';
import { RouteLines } from '@/features/map/RouteLines';
import { StopDots } from '@/features/map/StopDots';
import { useOfflineTiles } from '@/features/map/useOfflineTiles';
import { useRouteLayers } from '@/features/map/useRouteLayers';
import { DevBenchmark } from '@/features/plan/DevBenchmark';
import { TripLayers, type TripPin } from '@/features/plan/TripLayers';
import { PointPills, type PickTarget, type PickedPoint } from '@/features/ride/PointPills';
import { RideFailure, RideResult } from '@/features/ride/RideResult';
import { discountMultiplier } from '@/shared/fare/fare';
import { boundsOfLines, clipBounds, withMinimumSpan } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { projectOntoLine } from '@/shared/geo/line';
import { describePoint, nearestStop, snapToRoute } from '@/shared/routing/describe';
import { fareForItinerary, planTrip } from '@/shared/routing/plan';
import type { DirectedLine, RouteDirection, RouteStop } from '@/shared/routing/types';
import { useDestinationsStore } from '@/state/destinationsStore';
import { stopsForRoute, toggleRoute } from '@/shared/ui/routeVisibility';
import { useFareType } from '@/state/fareType';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ALL_DIRECTIONS: Record<RouteDirection, boolean> = { outbound: true, return: true };
const LOGO_SIZE = spacing.xl * 3;
const ICON_SIZE = spacing.md + spacing.xs;
const FIELD_NAME: Record<PickTarget, string> = { origin: strings.ride.from, destination: strings.ride.to };

type RouteCard = { code: string; color: string; from: string; to: string; name: string; lines: DirectedLine[]; hasMap: boolean };

// One card per public route code, with its two end stops along its first stored line, or its name
// when the route has no stops yet (R3 and R5 in RR1)
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

// My Ride: pick where you start and where you are going, on the map or from the stops, and see
// the route, where to board and get off, and the fare. Also lists every route, for new residents.
export default function MyRideScreen() {
  const styles = useStyles();
  const { colors, typography, mapRoute, routeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { lines, stops, isPlaceholder } = useRouteData();
  const { state: tiles } = useOfflineTiles();
  const [fareType] = useFareType();

  const [origin, setOrigin] = useState<PickedPoint | null>(null);
  const [destination, setDestination] = useState<PickedPoint | null>(null);
  const [active, setActive] = useState<PickTarget>('origin');
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [sheetRequest, setSheetRequest] = useState<SheetRequest | null>(null);

  // A frequent-destination chip on the Live greeting opens this tab with that destination as To.
  // Each tap carries a new time stamp; it is applied once, while rendering, with no effect.
  const params = useLocalSearchParams<{ to?: string; at?: string }>();
  const destinations = useDestinationsStore((state) => state.destinations);
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

  // The routes' box, clipped to the tile set so the opening view always has map data (RR1)
  const initialBounds = useMemo(() => clipBounds(boundsOfLines(lines.map((line) => line.coordinates)), TILESET.bounds), [lines]);
  const cards = useMemo(() => routeCards(lines, stops), [lines, stops]);

  const moveCamera = useCallback((next: MapFocusTarget) => {
    setFocus((current) => ({ ...next, key: (current?.key ?? 0) + 1 }));
  }, []);
  const moveSheet = useCallback((snap: SheetRequest['snap']) => {
    setSheetRequest((current) => ({ key: (current?.key ?? 0) + 1, snap }));
  }, []);

  // A pinned point is named from its nearest stop; the distance to the route is in Details
  const pinnedPoint = useCallback(
    (position: LatLon): PickedPoint => {
      const { nearestStopCode } = describePoint(lines, stops, position);
      return { ...position, label: nearestStopCode ? strings.ride.near(nearestStopCode) : strings.ride.pinned };
    },
    [lines, stops],
  );
  const stopPoint = useCallback((stop: RouteStop): PickedPoint => ({ lat: stop.lat, lon: stop.lon, label: stop.code }), []);

  // Runs on the phone from local data: no network is involved
  const plan = useMemo(
    () => (origin && destination ? planTrip(lines, origin, destination) : null),
    [lines, origin, destination],
  );
  const itinerary = plan?.ok ? plan.itinerary : null;
  const fare = useMemo(
    () => (itinerary ? fareForItinerary(lines, itinerary, discountMultiplier(fareType)) : null),
    [lines, itinerary, fareType],
  );

  // Fill the highlighted field and frame the points; once both are set, open the result half way
  const pick = useCallback(
    (point: PickedPoint) => {
      const nextOrigin = active === 'origin' ? point : origin;
      const nextDestination = active === 'destination' ? point : destination;
      setOrigin(nextOrigin);
      setDestination(nextDestination);
      if (active === 'origin') setActive('destination');
      if (nextOrigin && nextDestination) {
        const bounds = boundsOfLines([
          [
            [nextOrigin.lon, nextOrigin.lat],
            [nextDestination.lon, nextDestination.lat],
          ],
        ]);
        moveCamera({ kind: 'bounds', bounds: withMinimumSpan(bounds, mapRoute.minFocusSpanDeg) });
        moveSheet('half');
      } else {
        moveCamera({ kind: 'center', center: point });
      }
    },
    [active, origin, destination, moveCamera, moveSheet, mapRoute.minFocusSpanDeg],
  );

  const swap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  // UX3: no route line until one is chosen from "All routes"; a trip draws only its ride segment.
  // Kept while the app is open, not saved.
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const layers = useRouteLayers(lines, stops, 'ride', selectedRoute, itinerary !== null);

  const clear = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setActive('origin');
    setSelectedRoute(null);
    moveCamera({ kind: 'bounds', bounds: initialBounds });
  }, [initialBounds, moveCamera]);

  const pinOf = useCallback(
    (point: PickedPoint | null): TripPin | null => (point ? { point, snapped: describePoint(lines, stops, point).snapped } : null),
    [lines, stops],
  );
  const originPin = useMemo(() => pinOf(origin), [pinOf, origin]);
  const destinationPin = useMemo(() => pinOf(destination), [pinOf, destination]);

  // The one way out of a failed plan
  const failureAction = useMemo(() => {
    if (!plan || plan.ok || !origin || !destination) return null;
    if (plan.reason === 'destination_not_ahead') return { label: strings.ride.swap, onPress: swap };
    if (plan.reason === 'origin_too_far') {
      return { label: strings.ride.moveToRoute, onPress: () => setOrigin(pinnedPoint(snapToRoute(lines, origin))) };
    }
    if (plan.reason === 'destination_too_far') {
      return {
        label: strings.ride.moveToRoute,
        onPress: () => setDestination(pinnedPoint(snapToRoute(lines, destination))),
      };
    }
    return null;
  }, [plan, origin, destination, lines, swap, pinnedPoint]);

  const nearestCode = (point: LatLon) => nearestStop(stops, point)?.stop.code ?? '';

  const viewOnMap = useCallback(() => {
    if (!origin || !destination) return;
    const bounds = boundsOfLines([
      [
        [origin.lon, origin.lat],
        [destination.lon, destination.lat],
      ],
    ]);
    moveSheet('peek');
    moveCamera({ kind: 'bounds', bounds: withMinimumSpan(bounds, mapRoute.minFocusSpanDeg) });
  }, [origin, destination, moveSheet, moveCamera, mapRoute.minFocusSpanDeg]);

  const showRoute = useCallback(
    (card: RouteCard) => {
      const next = toggleRoute(selectedRoute, card.code);
      setSelectedRoute(next);
      if (!next) return;
      moveSheet('peek');
      moveCamera({ kind: 'bounds', bounds: boundsOfLines(card.lines.map((line) => line.coordinates)) });
    },
    [moveSheet, moveCamera, selectedRoute],
  );

  const header = (
    <PointPills origin={origin} destination={destination} active={active} onActivate={setActive} onSwap={swap} />
  );

  return (
    <View style={styles.root}>
      {tiles.status === 'ready' ? (
        <OfflineMap
          tilesUrl={tiles.tiles.url}
          initialBounds={initialBounds}
          focus={focus}
          bottomInset={sheetHeight}
          attributionTop={insets.top + spacing.sm}
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
      <View style={[styles.topRight, { top: insets.top + spacing.sm }]}>
        <AvatarButton />
      </View>

      <BottomSheet
        id="ride"
        defaultSnap="half"
        request={sheetRequest}
        onSnapChange={(_snap, visibleHeight) => setSheetHeight(visibleHeight)}
        header={header}
      >
        <View style={styles.toolbar}>
          {isPlaceholder ? <Chip label={strings.common.sampleData} /> : null}
          <View style={styles.grow} />
          {origin || destination ? (
            <Pressable style={styles.clear} onPress={clear} accessibilityRole="button" accessibilityLabel={strings.ride.clear}>
              <X color={colors.textSecondary} size={ICON_SIZE} />
              <Text style={typography.labelLg}>{strings.ride.clear}</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stops}>
          {stops.map((stop) => (
            <Chip
              key={stop.code}
              label={stop.code}
              accessibilityLabel={strings.ride.pickFor(FIELD_NAME[active], `${stop.code}, ${stop.name}`)}
              onPress={() => pick(stopPoint(stop))}
            />
          ))}
        </ScrollView>

        {plan && !plan.ok ? <RideFailure failure={plan} action={failureAction} /> : null}
        {itinerary && fare ? (
          <RideResult
            itinerary={itinerary}
            fare={fare}
            classification={fareType}
            badgeColor={routeColor(itinerary.legs[1].routeCode, lines.find((line) => line.id === itinerary.legs[1].lineId)?.color ?? colors.primary)}
            boardNear={nearestCode(itinerary.legs[1].from)}
            getOffNear={nearestCode(itinerary.legs[1].to)}
            onViewOnMap={viewOnMap}
          />
        ) : null}

        <Text style={typography.headlineSm}>{strings.ride.allRoutes}</Text>
        {cards.map((card) => (
          <Pressable
            key={card.code}
            style={[styles.routeCard, card.code === selectedRoute && styles.routeCardSelected]}
            onPress={() => (card.hasMap ? showRoute(card) : undefined)}
            disabled={!card.hasMap}
            accessibilityRole="button"
            accessibilityState={{ selected: card.code === selectedRoute }}
            accessibilityLabel={strings.live.routeChip(card.code, card.code === selectedRoute)}
          >
            <LineBadge code={card.code} color={routeColor(card.code, card.color)} />
            <Text style={[typography.labelLg, styles.grow]}>
              {!card.hasMap ? strings.ride.mapComingSoon : card.from && card.to ? strings.ride.routeEnds(card.from, card.to) : card.name}
            </Text>
          </Pressable>
        ))}

        <DevBenchmark lines={lines} />
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
  topRight: {
    position: 'absolute',
    right: spacing.md,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  clear: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  stops: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  routeCardSelected: {
    backgroundColor: colors.primaryContainer,
  },
  routeCard: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
  },
}));
