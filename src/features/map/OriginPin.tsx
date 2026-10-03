import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { point } from '@turf/turf';
import { useMemo } from 'react';

import { useLocationStore } from '@/state/locationStore';
import { colors } from '@/theme';

const PIN_RADIUS = 8;
const PIN_STROKE_WIDTH = 3;

// The starting point set by a long-press when location is off (PRD 4.2 reduced mode).
// Must be rendered inside a map.
export function OriginPin() {
  const origin = useLocationStore((state) => state.manualOrigin);
  const shape = useMemo(() => (origin ? point([origin.lon, origin.lat]) : null), [origin]);

  if (!shape) return null;

  return (
    <GeoJSONSource id="origin-pin" data={shape}>
      <Layer
        id="origin-pin-circle"
        type="circle"
        paint={{
          'circle-radius': PIN_RADIUS,
          'circle-color': colors.amber,
          'circle-stroke-width': PIN_STROKE_WIDTH,
          'circle-stroke-color': colors.surface,
        }}
      />
    </GeoJSONSource>
  );
}
