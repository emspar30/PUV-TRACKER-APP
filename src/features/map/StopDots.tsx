import { GeoJSONSource, Layer, type CircleLayerSpecification } from '@maplibre/maplibre-react-native';
import type { FeatureCollection, Point } from 'geojson';
import { useMemo } from 'react';

import type { RouteStop } from '@/data/routeSource';
import { mapRoute } from '@/theme';

type CirclePaint = NonNullable<CircleLayerSpecification['paint']>;

const SOURCE = 'route-stops';

// Dot radius grows with zoom; the selected stop is drawn larger
function radiusRamp(): CirclePaint['circle-radius'] {
  const stops = mapRoute.stopRadiusStops.flatMap(([zoom, radius]) => [
    zoom,
    ['case', ['get', 'selected'], radius * mapRoute.stopSelectedScale, radius],
  ]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as unknown as CirclePaint['circle-radius'];
}

type StopDotsProps = {
  stops: RouteStop[];
  // Code of the stop highlighted from the list outside the map, if any
  selectedCode: string | null;
};

// Plain dots for the stops. No text is drawn on the map; names are listed outside it.
// Rendered as a child of OfflineMap, after the route lines so the dots sit on top.
export function StopDots({ stops, selectedCode }: StopDotsProps) {
  const data = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: stops.map((stop) => ({
        type: 'Feature',
        properties: { code: stop.code, selected: stop.code === selectedCode },
        geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] },
      })),
    }),
    [stops, selectedCode],
  );

  return (
    <GeoJSONSource id={SOURCE} data={data}>
      <Layer
        id={`${SOURCE}-dot`}
        type="circle"
        paint={{
          'circle-radius': radiusRamp(),
          'circle-color': ['case', ['get', 'selected'], mapRoute.stopSelectedColor, mapRoute.stopColor],
          'circle-stroke-color': mapRoute.casingColor,
          'circle-stroke-width': mapRoute.stopStrokeWidth,
        }}
      />
    </GeoJSONSource>
  );
}
