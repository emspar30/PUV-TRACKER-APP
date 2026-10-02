import { GeoJSONSource, Layer, type LineLayerSpecification } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { useMemo } from 'react';

import type { LatLon } from '@/shared/geo/haversine';
import { sliceCoordinates } from '@/shared/geo/line';
import type { Itinerary } from '@/shared/routing/plan';
import type { DirectedLine } from '@/shared/routing/types';
import { mapRoute } from '@/theme';

type LinePaint = NonNullable<LineLayerSpecification['paint']>;

const ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const;
const toPosition = (p: LatLon) => [p.lon, p.lat];

function rideWidth(extra = 0): LinePaint['line-width'] {
  const stops = mapRoute.lineWidthStops.flatMap(([zoom, width]) => [zoom, width * mapRoute.tripRideWidthScale + extra]);
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

// Draws the picked origin (green) and destination (red), a dashed line from each to the route,
// and, when a trip was found, the ridden part of the route in amber.
// Rendered as a child of OfflineMap, after the route lines.
export function TripLayers({ lines, origin, destination, itinerary }: TripLayersProps) {
  const ride = useMemo<Feature<LineString> | null>(() => {
    if (!itinerary) return null;
    const leg = itinerary.legs[1];
    const line = lines.find((candidate) => candidate.id === leg.lineId);
    if (!line) return null;
    const coordinates = sliceCoordinates(line.coordinates, leg.boardChainageKm, leg.alightChainageKm);
    if (coordinates.length < 2) return null;
    return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
  }, [lines, itinerary]);

  // With a trip, the guides end where the rider boards and alights; without one, at the nearest point of the route
  const guides = useMemo<FeatureCollection<LineString>>(() => {
    const ends: [LatLon, LatLon][] = [];
    const originEnd = itinerary ? itinerary.legs[1].from : origin?.snapped;
    const destinationEnd = itinerary ? itinerary.legs[1].to : destination?.snapped;
    if (origin && originEnd) ends.push([origin.point, originEnd]);
    if (destination && destinationEnd) ends.push([destination.point, destinationEnd]);
    return {
      type: 'FeatureCollection',
      features: ends.map(([from, to]) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [toPosition(from), toPosition(to)] },
      })),
    };
  }, [origin, destination, itinerary]);

  const points = useMemo<FeatureCollection<Point>>(() => {
    const features: Feature<Point>[] = [];
    const add = (position: LatLon, role: 'origin' | 'destination' | 'snap') =>
      features.push({
        type: 'Feature',
        properties: { role },
        geometry: { type: 'Point', coordinates: toPosition(position) },
      });
    const originEnd = itinerary ? itinerary.legs[1].from : origin?.snapped;
    const destinationEnd = itinerary ? itinerary.legs[1].to : destination?.snapped;
    if (origin && originEnd) add(originEnd, 'snap');
    if (destination && destinationEnd) add(destinationEnd, 'snap');
    if (origin) add(origin.point, 'origin');
    if (destination) add(destination.point, 'destination');
    return { type: 'FeatureCollection', features };
  }, [origin, destination, itinerary]);

  return (
    <>
      {ride ? (
        <GeoJSONSource id="trip-ride" data={ride}>
          <Layer
            id="trip-ride-casing"
            type="line"
            layout={ROUND}
            paint={{ 'line-color': mapRoute.casingColor, 'line-width': rideWidth(mapRoute.casingExtraWidth) }}
          />
          <Layer
            id="trip-ride-line"
            type="line"
            layout={ROUND}
            paint={{ 'line-color': mapRoute.tripRideColor, 'line-width': rideWidth() }}
          />
        </GeoJSONSource>
      ) : null}

      <GeoJSONSource id="trip-guides" data={guides}>
        <Layer
          id="trip-guides-casing"
          type="line"
          layout={ROUND}
          paint={{
            'line-color': mapRoute.casingColor,
            'line-width': mapRoute.tripWalkWidth + mapRoute.casingExtraWidth,
          }}
        />
        <Layer
          id="trip-guides-line"
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
