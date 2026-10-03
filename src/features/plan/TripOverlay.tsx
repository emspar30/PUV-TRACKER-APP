import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { lineSliceAlong, lineString, point } from '@turf/turf';
import { useMemo } from 'react';

import type { LineCoordinates } from '@/shared/geo/line';
import type { LatLon } from '@/shared/geo/haversine';
import type { Itinerary } from '@/shared/routing/plan';
import { colors } from '@/theme';

const RIDE_WIDTH = 7;
const RIDE_CASING_WIDTH = 11;
const WALK_WIDTH = 3;
const WALK_DASH = [1, 2];
const MARKER_RADIUS = 8;
const MARKER_STROKE = 3;
const KM = { units: 'kilometers' } as const;

const toPosition = (p: LatLon) => [p.lon, p.lat];

type TripOverlayProps = {
  origin: LatLon | null;
  destination: LatLon | null;
  itinerary: Itinerary | null;
  // Polyline of the line the ride uses, to cut the ride slice from
  rideCoordinates: LineCoordinates | null;
};

// The planned trip on the Plan map: walking legs dashed, the ride slice in the route color,
// the start in green and the destination in red. Must be rendered inside a map.
export function TripOverlay({ origin, destination, itinerary, rideCoordinates }: TripOverlayProps) {
  const shapes = useMemo(() => {
    if (!itinerary || !rideCoordinates) return null;
    const [walkIn, ride, walkOut] = itinerary.legs;
    return {
      ride: lineSliceAlong(lineString(rideCoordinates), ride.fromChainageKm, ride.toChainageKm, KM),
      walks: {
        type: 'FeatureCollection' as const,
        features: [walkIn, walkOut].map((leg) => lineString([toPosition(leg.from), toPosition(leg.to)])),
      },
      color: ride.routeColor,
    };
  }, [itinerary, rideCoordinates]);

  return (
    <>
      {shapes && (
        <>
          <GeoJSONSource id="trip-ride" data={shapes.ride}>
            <Layer
              id="trip-ride-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.routeCasing, 'line-width': RIDE_CASING_WIDTH }}
            />
            <Layer
              id="trip-ride-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': shapes.color, 'line-width': RIDE_WIDTH }}
            />
          </GeoJSONSource>
          <GeoJSONSource id="trip-walks" data={shapes.walks}>
            <Layer
              id="trip-walks-line"
              type="line"
              layout={{ 'line-cap': 'round' }}
              paint={{ 'line-color': colors.walk, 'line-width': WALK_WIDTH, 'line-dasharray': WALK_DASH }}
            />
          </GeoJSONSource>
        </>
      )}
      {origin && <Marker id="trip-origin" at={origin} color={colors.emerald} />}
      {destination && <Marker id="trip-destination" at={destination} color={colors.crimson} />}
    </>
  );
}

function Marker({ id, at, color }: { id: string; at: LatLon; color: string }) {
  const shape = useMemo(() => point(toPosition(at)), [at]);
  return (
    <GeoJSONSource id={id} data={shape}>
      <Layer
        id={`${id}-circle`}
        type="circle"
        paint={{
          'circle-radius': MARKER_RADIUS,
          'circle-color': color,
          'circle-stroke-width': MARKER_STROKE,
          'circle-stroke-color': colors.surface,
        }}
      />
    </GeoJSONSource>
  );
}
