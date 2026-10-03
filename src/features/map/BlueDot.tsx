import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { circle, point } from '@turf/turf';
import { useMemo } from 'react';

import { useLocationStore } from '@/state/locationStore';
import { colors } from '@/theme';

const METERS_PER_KM = 1000;
const RING_STEPS = 48;
const RING_OPACITY = 0.18;
const DOT_RADIUS = 7;
const DOT_STROKE_WIDTH = 2;

// The rider's position and its accuracy ring, drawn from the location store.
// Must be rendered inside a map.
export function BlueDot() {
  const fix = useLocationStore((state) => state.fix);

  const shapes = useMemo(() => {
    if (!fix) return null;
    const center = [fix.lon, fix.lat];
    return {
      dot: point(center),
      // The ring is a real-world circle, so it scales with the map
      ring: fix.accuracyM ? circle(center, fix.accuracyM / METERS_PER_KM, { steps: RING_STEPS }) : null,
    };
  }, [fix]);

  if (!shapes) return null;

  return (
    <>
      {shapes.ring && (
        <GeoJSONSource id="blue-dot-accuracy" data={shapes.ring}>
          <Layer
            id="blue-dot-accuracy-fill"
            type="fill"
            paint={{ 'fill-color': colors.locationDot, 'fill-opacity': RING_OPACITY }}
          />
        </GeoJSONSource>
      )}
      <GeoJSONSource id="blue-dot" data={shapes.dot}>
        <Layer
          id="blue-dot-circle"
          type="circle"
          paint={{
            'circle-radius': DOT_RADIUS,
            'circle-color': colors.locationDot,
            'circle-stroke-width': DOT_STROKE_WIDTH,
            'circle-stroke-color': colors.surface,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
