import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, LineString } from 'geojson';
import { useMemo } from 'react';

import type { RouteLine } from '@/data/routeSource';

type RouteLinesProps = {
  lines: RouteLine[];
};

// Draws each directed route line in its route colour. Rendered as a child of OfflineMap.
export function RouteLines({ lines }: RouteLinesProps) {
  // Keep the GeoJSON objects stable between renders so the map does not reload them
  const features = useMemo(
    () =>
      lines.map((line) => ({
        line,
        feature: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: line.coordinates },
        } satisfies Feature<LineString>,
      })),
    [lines],
  );

  return features.map(({ line, feature }) => (
    <GeoJSONSource key={line.id} id={`route-${line.id}`} data={feature}>
      <Layer
        id={`route-${line.id}-line`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': line.color,
          'line-opacity': 0.9,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 4, 18, 8],
        }}
      />
    </GeoJSONSource>
  ));
}
