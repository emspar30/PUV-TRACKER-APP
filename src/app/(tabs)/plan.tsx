import type { CameraRef, LngLatBounds } from '@maplibre/maplibre-react-native';
import { bbox, featureCollection, lineSliceAlong, lineString, point } from '@turf/turf';
import type { Geometry } from 'geojson';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BentoCard, BentoGrid, Screen } from '@/components';
import { BlueDot } from '@/features/map/BlueDot';
import { OfflineMap } from '@/features/map/OfflineMap';
import { RouteLegend } from '@/features/map/RouteLegend';
import { RouteLines } from '@/features/map/RouteLines';
import { FareCard } from '@/features/plan/FareCard';
import { ItineraryCard } from '@/features/plan/ItineraryCard';
import { PlacePicker, type HereStatus } from '@/features/plan/PlacePicker';
import { formatCoordinates, placeKey, splitStationName, stopOptions, type Place } from '@/features/plan/places';
import { TripCard, type FieldValue } from '@/features/plan/TripCard';
import { TripOverlay } from '@/features/plan/TripOverlay';
import { formatMeters, formatWalk } from '@/features/plan/format';
import { useRouteNetwork } from '@/features/plan/useRouteNetwork';
import { MAX_WALK_PER_LEG_M, ROUTING_BENCHMARK_PAIRS } from '@/shared/config';
import { discountMultiplier } from '@/shared/fare/fare';
import type { LatLon } from '@/shared/geo/haversine';
import { randomPairsNearLines, runRoutingBenchmark, seededRandom } from '@/shared/routing/benchmark';
import { planTrip, type PlanFailureResult } from '@/shared/routing/plan';
import { useLocationStore } from '@/state/locationStore';
import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

const BENCHMARK_SEED = 42;
const MS_DECIMALS = 2;
// Share of the screen height given to the map at the top of the Plan tab
const MAP_HEIGHT_RATIO = 0.38;
const FIT_PADDING = 48;
const FIT_DURATION_MS = 600;
const KM = { units: 'kilometers' } as const;

const asBounds = (box: number[]): LngLatBounds => [box[0], box[1], box[2], box[3]];

function failureText({ reason, originToRouteM, destinationToRouteM }: PlanFailureResult): string {
  if (reason === 'not_ahead') return strings.plan.notAhead;
  if (reason === 'no_routes') return strings.plan.noRoutes;

  // Say which end is too far, and by how much, so a placeholder line far from the road is visible
  const limit = formatMeters(MAX_WALK_PER_LEG_M);
  const startTooFar = originToRouteM > MAX_WALK_PER_LEG_M;
  const endTooFar = destinationToRouteM > MAX_WALK_PER_LEG_M;
  if (startTooFar && endTooFar) {
    return strings.plan.tooFarBoth(formatWalk(originToRouteM), formatWalk(destinationToRouteM), limit);
  }
  return startTooFar
    ? strings.plan.tooFarStart(formatWalk(originToRouteM), limit)
    : strings.plan.tooFarEnd(formatWalk(destinationToRouteM), limit);
}

const formatMs = (ms: number) => `${ms.toFixed(MS_DECIMALS)} ms`;

export default function PlanScreen() {
  const { network, failed } = useRouteNetwork();
  const { height } = useWindowDimensions();
  const cameraRef = useRef<CameraRef>(null);
  const fix = useLocationStore((state) => state.fix);
  const manualOrigin = useLocationStore((state) => state.manualOrigin);
  const classification = useProfileStore((state) => state.classification);

  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  // Set while the rider is choosing a point by tapping the map
  const [pickingOnMap, setPickingOnMap] = useState<'from' | 'to' | null>(null);
  const [benchmark, setBenchmark] = useState<string | null>(null);

  const here: LatLon | null = fix ? { lat: fix.lat, lon: fix.lon } : manualOrigin;
  const multiplier = discountMultiplier(classification ?? 'regular');
  const stops = useMemo(() => (network ? stopOptions(network) : []), [network]);

  // Start from the rider's position by default when there is one
  const effectiveFrom: Place | null = from ?? (here ? { kind: 'here' } : null);

  const hereStatus: HereStatus = {
    available: here !== null,
    detail: fix
      ? fix.accuracyM !== null
        ? strings.plan.gpsAccuracy(formatWalk(fix.accuracyM))
        : strings.plan.gpsWaiting
      : strings.plan.currentPin,
  };

  const resolve = (place: Place | null): LatLon | null => {
    if (!place) return null;
    if (place.kind === 'here') return here;
    if (place.kind === 'point') return place.at;
    const station = network?.stations.find((s) => s.stationId === place.stationId);
    return station ? { lat: station.lat, lon: station.lon } : null;
  };
  const origin = resolve(effectiveFrom);
  const destination = resolve(to);

  // How a choice reads in the trip card: the phone's position is always labelled as such
  const describe = (place: Place | null): FieldValue | null => {
    if (!place) return null;
    if (place.kind === 'here') {
      return fix
        ? { kind: 'here', title: strings.plan.yourLocation, subtitle: hereStatus.detail }
        : { kind: 'here', title: strings.plan.yourMapPin, subtitle: here ? formatCoordinates(here) : undefined };
    }
    if (place.kind === 'point') {
      return { kind: 'point', title: strings.plan.pointOnMap, subtitle: formatCoordinates(place.at) };
    }
    const station = network?.stations.find((s) => s.stationId === place.stationId);
    return station ? { kind: 'stop', ...splitStationName(station.name) } : null;
  };

  const choose = (place: Place) => {
    if (picker === 'from') setFrom(place);
    else setTo(place);
    setPicker(null);
  };

  const swap = () => {
    setFrom(to);
    setTo(effectiveFrom);
  };

  const startPickOnMap = () => {
    setPickingOnMap(picker);
    setPicker(null);
  };

  const handleMapPress = (at: LatLon) => {
    if (pickingOnMap === 'from') setFrom({ kind: 'point', at });
    else if (pickingOnMap === 'to') setTo({ kind: 'point', at });
    setPickingOnMap(null);
  };

  // Tens of milliseconds at most (see the benchmark), so it is simply recomputed on each render
  const result = network && origin && destination ? planTrip(origin, destination, network.lines, multiplier) : null;

  const itinerary = result?.ok ? result.itinerary : null;
  const rideLine = itinerary ? network?.lines.find((line) => line.routeId === itinerary.legs[1].routeId) : null;

  // The whole network is shown first
  const networkBounds = useMemo(
    () =>
      network && network.lines.length > 0
        ? asBounds(bbox(featureCollection(network.lines.map((line) => lineString(line.coordinates)))))
        : undefined,
    [network],
  );

  // Frame the trip when a new one is planned. Keyed on the choices, not on coordinates, so a
  // moving GPS fix does not keep pulling the camera around.
  const tripKey = itinerary ? `${placeKey(effectiveFrom)}>${placeKey(to)}>${itinerary.legs[1].routeId}` : null;
  useEffect(() => {
    if (!tripKey || !itinerary || !rideLine) return;
    const [walkIn, ride, walkOut] = itinerary.legs;
    const slice = lineSliceAlong(lineString(rideLine.coordinates), ride.fromChainageKm, ride.toChainageKm, KM);
    const box = bbox(
      featureCollection<Geometry>([
        slice,
        point([walkIn.from.lon, walkIn.from.lat]),
        point([walkOut.to.lon, walkOut.to.lat]),
      ]),
    );
    try {
      cameraRef.current?.fitBounds(asBounds(box), {
        padding: { top: FIT_PADDING, right: FIT_PADDING, bottom: FIT_PADDING, left: FIT_PADDING },
        duration: FIT_DURATION_MS,
      });
    } catch {
      // The map is not ready yet
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the trip itself changes
  }, [tripKey]);

  const runBenchmark = () => {
    if (!network) return;
    setBenchmark(strings.plan.benchmarkRunning);
    // Let the label render before the work starts
    setTimeout(() => {
      const pairs = randomPairsNearLines(network.lines, ROUTING_BENCHMARK_PAIRS, seededRandom(BENCHMARK_SEED));
      const run = runRoutingBenchmark(network.lines, pairs, multiplier, () => performance.now());
      setBenchmark(
        strings.plan.benchmarkResult(run.count, formatMs(run.p50Ms), formatMs(run.p95Ms), formatMs(run.maxMs)),
      );
    }, 0);
  };

  if (!network) {
    return (
      <Screen title={strings.plan.title}>
        <Text style={typography.caption}>{failed ? strings.plan.loadFailed : strings.plan.loading}</Text>
      </Screen>
    );
  }

  return (
    <Screen title={strings.plan.title} mode="fill">
      <View style={[styles.map, { height: height * MAP_HEIGHT_RATIO }]}>
        <OfflineMap cameraRef={cameraRef} initialBounds={networkBounds} onPress={handleMapPress}>
          <RouteLines highlightRouteId={rideLine?.routeId ?? null} />
          <BlueDot />
          <TripOverlay
            origin={origin}
            destination={destination}
            itinerary={itinerary}
            rideCoordinates={rideLine?.coordinates ?? null}
          />
        </OfflineMap>

        <View style={styles.mapOverlay} pointerEvents="box-none">
          {pickingOnMap ? (
            <View style={styles.pickBanner}>
              <Text style={[typography.body, styles.pickText]}>
                {pickingOnMap === 'from' ? strings.plan.tapMapFrom : strings.plan.tapMapTo}
              </Text>
              <Pressable onPress={() => setPickingOnMap(null)} style={styles.pickCancel} accessibilityRole="button">
                <Text style={styles.pickCancelLabel}>{strings.plan.cancel}</Text>
              </Pressable>
            </View>
          ) : (
            <RouteLegend />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BentoGrid>
          <View style={styles.full}>
            <TripCard
              from={describe(effectiveFrom)}
              to={describe(to)}
              onPressFrom={() => setPicker('from')}
              onPressTo={() => setPicker('to')}
              onSwap={swap}
            />
          </View>

          {result && !result.ok && (
            <BentoCard span={2}>
              <Text style={[typography.body, styles.failure]}>{failureText(result)}</Text>
            </BentoCard>
          )}

          {itinerary && rideLine && (
            <>
              <FareCard
                itinerary={itinerary}
                fareParams={rideLine.fare}
                classification={classification}
                multiplier={multiplier}
              />
              <ItineraryCard itinerary={itinerary} />
            </>
          )}

          {__DEV__ && (
            <BentoCard span={2}>
              <Pressable style={styles.devButton} onPress={runBenchmark} accessibilityRole="button">
                <Text style={typography.body}>{strings.plan.benchmark}</Text>
              </Pressable>
              {benchmark && <Text style={typography.caption}>{benchmark}</Text>}
            </BentoCard>
          )}
        </BentoGrid>
      </ScrollView>

      {picker && (
        <PlacePicker
          target={picker}
          current={picker === 'to' ? to : effectiveFrom}
          here={hereStatus}
          stops={stops}
          onSelect={choose}
          onPickOnMap={startPickOnMap}
          onClose={() => setPicker(null)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  content: {
    padding: spacing.md,
  },
  full: {
    width: '100%',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
  },
  pickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingLeft: spacing.md,
  },
  pickText: {
    flex: 1,
    color: colors.onPrimary,
  },
  pickCancel: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  pickCancelLabel: {
    ...typography.body,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  failure: {
    color: colors.warning,
  },
  devButton: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
});
