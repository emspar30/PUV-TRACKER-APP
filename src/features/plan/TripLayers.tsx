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

function rideWidth(): LinePaint['line-width'] {
  const stops = mapRoute.lineWidthStops.flatMap(([zoom, width]) => [zoom, width * mapRoute.tripRideWidthScale]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as unknown as LinePaint['line-width'];
}

type TripLayersProps = {
  lines: DirectedLine[];
  origin: LatLon | null;
  destination: LatLon | null;
  itinerary: Itinerary | null;
};

// Draws the picked origin and destination and, when a trip was found, the ridden part of the route
// and the two walks. Rendered as a child of OfflineMap, after the route lines.
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

  const walks = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: itinerary
        ? [itinerary.legs[0], itinerary.legs[2]].map((leg) => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [toPosition(leg.from), toPosition(leg.to)] },
          }))
        : [],
    }),
    [itinerary],
  );

  const points = useMemo<FeatureCollection<Point>>(() => {
    const features: Feature<Point>[] = [];
    const add = (position: LatLon, role: 'origin' | 'destination' | 'snap') =>
      features.push({
        type: 'Feature',
        properties: { role },
        geometry: { type: 'Point', coordinates: toPosition(position) },
      });
    if (itinerary) {
      add(itinerary.legs[1].from, 'snap');
      add(itinerary.legs[1].to, 'snap');
    }
    if (origin) add(origin, 'origin');
    if (destination) add(destination, 'destination');
    return { type: 'FeatureCollection', features };
  }, [origin, destination, itinerary]);

  return (
    <>
      {ride ? (
        <GeoJSONSource id="trip-ride" data={ride}>
          <Layer
            id="trip-ride-line"
            type="line"
            layout={ROUND}
            paint={{ 'line-color': mapRoute.tripRideColor, 'line-width': rideWidth() }}
          />
        </GeoJSONSource>
      ) : null}

      <GeoJSONSource id="trip-walks" data={walks}>
        <Layer
          id="trip-walks-line"
          type="line"
          layout={ROUND}
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
            'circle-stroke-color': mapRoute.casingColor,
            'circle-stroke-width': mapRoute.stopStrokeWidth,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
