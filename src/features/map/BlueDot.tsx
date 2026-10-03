import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { circle, point } from '@turf/turf';
import { useMemo } from 'react';

import { useLocationStore } from '@/state/locationStore';
import { useTheme } from '@/theme';

// From the partner's GPS work (b21b0c1), on our theme tokens.
const METERS_PER_KM = 1000;
const RING_STEPS = 48;
const RING_OPACITY = 0.18;
const DOT_RADIUS = 7;
const DOT_STROKE_WIDTH = 2;

// The rider's position and its accuracy ring, drawn from the location store. Every fix is shown;
// features that need precision apply the accuracy gates instead (G0). Must be rendered inside a map.
export function BlueDot() {
  const { mapPaint } = useTheme();
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
      {shapes.ring ? (
        <GeoJSONSource id="blue-dot-accuracy" data={shapes.ring}>
          <Layer
            id="blue-dot-accuracy-fill"
            type="fill"
            paint={{ 'fill-color': mapPaint.locationDot, 'fill-opacity': RING_OPACITY }}
          />
        </GeoJSONSource>
      ) : null}
      <GeoJSONSource id="blue-dot" data={shapes.dot}>
        <Layer
          id="blue-dot-circle"
          type="circle"
          paint={{
            'circle-radius': DOT_RADIUS,
            'circle-color': mapPaint.locationDot,
            'circle-stroke-width': DOT_STROKE_WIDTH,
            'circle-stroke-color': mapPaint.locationDotStroke,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
