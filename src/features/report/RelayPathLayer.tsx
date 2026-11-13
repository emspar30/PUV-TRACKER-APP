import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { lineString } from '@turf/turf';
import { useMemo } from 'react';

import type { LatLon } from '@/shared/geo/haversine';
import type { LineCoordinates } from '@/shared/geo/line';
import { alongRoutePath } from '@/shared/relay/progress';
import { useTheme } from '@/theme';

const PATH_WIDTH = 6;
const CASING_WIDTH = 9;

// Tester note (2026-11-13): during a relay, the ride left from the rider to their destination, as a
// solid line along the route, like a directions line. The same part of the line as the relay bar's
// "km to go"; nothing when the rider is off the route. Rendered inside a map.
export function RelayPathLayer({ position, destination, lines }: { position: LatLon; destination: LatLon; lines: readonly LineCoordinates[] }) {
  const { colors, mapPaint } = useTheme();
  const path = useMemo(() => {
    const coordinates = alongRoutePath(lines, position, destination);
    return coordinates ? lineString(coordinates) : null;
  }, [lines, position, destination]);
  if (!path) return null;
  return (
    <GeoJSONSource id="relay-path" data={path}>
      <Layer
        id="relay-path-casing"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': mapPaint.locationDotStroke, 'line-width': CASING_WIDTH }}
      />
      <Layer
        id="relay-path-line"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': colors.primary, 'line-width': PATH_WIDTH }}
      />
    </GeoJSONSource>
  );
}
