import { GeoJSONSource, Layer, type CircleLayerSpecification } from '@maplibre/maplibre-react-native';
import type { FeatureCollection, Point } from 'geojson';
import { useMemo } from 'react';

import type { RouteStop } from '@/shared/routing/types';
import { MAP_GEOMETRY, spacing, useTheme } from '@/theme';

type CirclePaint = NonNullable<CircleLayerSpecification['paint']>;

const SOURCE = 'route-stops';
// Extra touch area around a dot, so a small dot is still easy to tap
const HITBOX = { top: spacing.md, right: spacing.md, bottom: spacing.md, left: spacing.md };

// Dot radius grows with zoom; the selected stop is drawn larger
function radiusRamp(): CirclePaint['circle-radius'] {
  const stops = MAP_GEOMETRY.stopRadiusStops.flatMap(([zoom, radius]) => [
    zoom,
    ['case', ['get', 'selected'], radius * MAP_GEOMETRY.stopSelectedScale, radius],
  ]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as unknown as CirclePaint['circle-radius'];
}

type StopDotsProps = {
  stops: RouteStop[];
  // Code of the highlighted stop, if any
  selectedCode: string | null;
  // When given, tapping a dot reports that stop's code
  onPressStop?: (code: string) => void;
};

// Plain dots for the stops. No text is drawn on the map; names are shown in native views outside it.
// Rendered as a child of OfflineMap, after the route lines so the dots sit on top.
export function StopDots({ stops, selectedCode, onPressStop }: StopDotsProps) {
  const { mapRoute } = useTheme();
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
    <GeoJSONSource
      id={SOURCE}
      data={data}
      hitbox={HITBOX}
      onPress={
        onPressStop
          ? (event) => {
              const code: unknown = event.nativeEvent.features[0]?.properties?.code;
              if (typeof code === 'string') onPressStop(code);
            }
          : undefined
      }
    >
      <Layer
        id={`${SOURCE}-dot`}
        type="circle"
        paint={{
          'circle-radius': radiusRamp(),
          'circle-color': ['case', ['get', 'selected'], mapRoute.stopSelectedColor, mapRoute.stopColor],
          'circle-stroke-color': mapRoute.stopStrokeColor,
          'circle-stroke-width': mapRoute.stopStrokeWidth,
        }}
      />
    </GeoJSONSource>
  );
}
