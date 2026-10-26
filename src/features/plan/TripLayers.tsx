import { GeoJSONSource, Layer, type LineLayerSpecification } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { useMemo } from 'react';

import { walkGraph } from '@/data/seed/walkways';
import type { LatLon } from '@/shared/geo/haversine';
import { sliceCoordinates } from '@/shared/geo/line';
import type { Itinerary } from '@/shared/routing/plan';
import type { DirectedLine } from '@/shared/routing/types';
import { walksForTrip } from '@/shared/routing/walk';
import { STOP_LAYER_ID } from '@/features/map/StopDots';
import { MAP_GEOMETRY, useTheme } from '@/theme';

type LinePaint = NonNullable<LineLayerSpecification['paint']>;

const ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const;
const toPosition = (p: LatLon) => [p.lon, p.lat];

function rideWidth(extra = 0): LinePaint['line-width'] {
  const stops = MAP_GEOMETRY.lineWidthStops.flatMap(([zoom, width]) => [
    zoom,
    width * MAP_GEOMETRY.tripRideWidthScale + extra,
  ]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as unknown as LinePaint['line-width'];
}

// A picked point and where it meets the route
export type TripPin = {
  point: LatLon;
  // Nearest position on the route, or null when there is no route
  snapped: LatLon | null;
};

type TripLayersProps = {
  lines: DirectedLine[];
  origin: TripPin | null;
  destination: TripPin | null;
  itinerary: Itinerary | null;
};

// Draws the picked origin (green) and destination (red) and, when a trip was found, a dashed walk
// from each to the route and the ridden part of the route in amber.
// Rendered as a child of OfflineMap, after the route lines. The ride and the walks are drawn below
// the stop dots, so a stop on the ride can still be seen and tapped; the picked points above them.
export function TripLayers({ lines, origin, destination, itinerary }: TripLayersProps) {
  const { mapRoute } = useTheme();
  // Emjay, 2026-10-26: the walks show only once From and To give a trip, so a single picked point
  // has no dashed line. Each walk follows the streets to where it meets the ridden line, and the
  // ride is drawn from there.
  const trip = useMemo(() => {
    if (!itinerary || !origin || !destination) return null;
    const leg = itinerary.legs[1];
    const line = lines.find((candidate) => candidate.id === leg.lineId);
    if (!line) return null;
    return { line, walks: walksForTrip(walkGraph(), line.coordinates, leg, origin.point, destination.point) };
  }, [lines, itinerary, origin, destination]);

  const ride = useMemo<Feature<LineString> | null>(() => {
    if (!trip) return null;
    const coordinates = sliceCoordinates(trip.line.coordinates, trip.walks.boardChainageKm, trip.walks.alightChainageKm);
    if (coordinates.length < 2) return null;
    return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
  }, [trip]);

  const guides = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: (trip ? [trip.walks.toBoard, trip.walks.fromAlight] : []).map((walk) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: walk.map(toPosition) },
      })),
    }),
    [trip],
  );

  const points = useMemo<FeatureCollection<Point>>(() => {
    const features: Feature<Point>[] = [];
    const add = (position: LatLon, role: 'origin' | 'destination' | 'snap') =>
      features.push({
        type: 'Feature',
        properties: { role },
        geometry: { type: 'Point', coordinates: toPosition(position) },
      });
    if (trip) {
      add(trip.walks.boardAt, 'snap');
      add(trip.walks.alightAt, 'snap');
    }
    if (origin) add(origin.point, 'origin');
    if (destination) add(destination.point, 'destination');
    return { type: 'FeatureCollection', features };
  }, [origin, destination, trip]);

  return (
    <>
      {ride ? (
        <GeoJSONSource id="trip-ride" data={ride}>
          <Layer
            id="trip-ride-casing"
            beforeId={STOP_LAYER_ID}
            type="line"
            layout={ROUND}
            paint={{ 'line-color': mapRoute.casingColor, 'line-width': rideWidth(mapRoute.casingExtraWidth) }}
          />
          <Layer
            id="trip-ride-line"
            beforeId={STOP_LAYER_ID}
            type="line"
            layout={ROUND}
            paint={{ 'line-color': mapRoute.tripRideColor, 'line-width': rideWidth() }}
          />
        </GeoJSONSource>
      ) : null}

      <GeoJSONSource id="trip-guides" data={guides}>
        <Layer
          id="trip-guides-casing"
          beforeId={STOP_LAYER_ID}
          type="line"
          layout={ROUND}
          paint={{
            'line-color': mapRoute.casingColor,
            'line-width': mapRoute.tripWalkWidth + mapRoute.casingExtraWidth,
          }}
        />
        <Layer
          id="trip-guides-line"
          beforeId={STOP_LAYER_ID}
          type="line"
          paint={{
            'line-color': mapRoute.tripWalkColor,
            'line-width': mapRoute.tripWalkWidth,
            'line-dasharray': [...mapRoute.tripWalkDashPattern],
          }}
        />
      </GeoJSONSource>

      <GeoJSONSource id="trip-points" data={points}>
        <Layer
          id="trip-points-dot"
          type="circle"
          paint={{
            'circle-radius': ['case', ['==', ['get', 'role'], 'snap'], mapRoute.tripSnapRadius, mapRoute.tripPointRadius],
            'circle-color': [
              'match',
              ['get', 'role'],
              'origin',
              mapRoute.tripOriginColor,
              'destination',
              mapRoute.tripDestinationColor,
              mapRoute.tripRideColor,
            ],
            'circle-stroke-color': mapRoute.tripPointStrokeColor,
            'circle-stroke-width': mapRoute.stopStrokeWidth,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
