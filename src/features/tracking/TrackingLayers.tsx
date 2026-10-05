import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { lineString, point } from '@turf/turf';
import { useMemo } from 'react';

import { GLYPH_FONT_MEDIUM } from '@/data/map/glyphset';
import type { LatLon } from '@/shared/geo/haversine';
import { projectOntoLine, sliceCoordinates } from '@/shared/geo/line';
import type { DirectedLine } from '@/shared/routing/types';
import { strings } from '@/strings';
import { useTheme } from '@/theme';

const PIN_RADIUS = 8;
const PIN_STROKE = 3;
const RING_RADIUS = 18;
const RING_OPACITY = 0.2;
const GUIDE_WIDTH = 5;
const GUIDE_DASH = [1, 1.5];
const LABEL_SIZE = 12;
const LABEL_OFFSET_EM = 1.4;
const LABEL_HALO = 2;

// The commuter's waiting point ("You") and, while tracking, a dashed guide line along the route from
// the tracked multicab to that point (PRD 7.3: tracking adds a guide line). Rendered inside a map.
export function TrackingLayers({
  commuter,
  vehicle,
  line,
  labels,
}: {
  commuter: LatLon;
  // The tracked vehicle and its line, or null when nothing is tracked
  vehicle: LatLon | null;
  line: DirectedLine | null;
  // True when the style has local glyphs; the "You" label needs them
  labels: boolean;
}) {
  const { mapPaint, colors, baseMap } = useTheme();
  const pin = useMemo(() => point([commuter.lon, commuter.lat]), [commuter]);
  const guide = useMemo(() => {
    if (!vehicle || !line) return null;
    const from = projectOntoLine(line.coordinates, vehicle).chainageKm;
    const to = projectOntoLine(line.coordinates, commuter).chainageKm;
    const coordinates = sliceCoordinates(line.coordinates, from, to);
    return coordinates.length >= 2 ? lineString(coordinates) : null;
  }, [vehicle, line, commuter]);

  return (
    <>
      {guide ? (
        <GeoJSONSource id="track-guide" data={guide}>
          <Layer
            id="track-guide-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.primary, 'line-width': GUIDE_WIDTH, 'line-dasharray': GUIDE_DASH }}
          />
        </GeoJSONSource>
      ) : null}
      <GeoJSONSource id="commuter-pin" data={pin}>
        <Layer id="commuter-pin-ring" type="circle" paint={{ 'circle-radius': RING_RADIUS, 'circle-color': mapPaint.locationDot, 'circle-opacity': RING_OPACITY }} />
        <Layer
          id="commuter-pin-dot"
          type="circle"
          paint={{
            'circle-radius': PIN_RADIUS,
            'circle-color': mapPaint.locationDot,
            'circle-stroke-width': PIN_STROKE,
            'circle-stroke-color': mapPaint.locationDotStroke,
          }}
        />
        {labels ? (
          <Layer
            id="commuter-pin-label"
            type="symbol"
            layout={{
              'text-field': strings.live.tracking.you.toUpperCase(),
              'text-font': [GLYPH_FONT_MEDIUM],
              'text-size': LABEL_SIZE,
              'text-offset': [0, LABEL_OFFSET_EM],
              'text-anchor': 'top',
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': colors.textPrimary, 'text-halo-color': baseMap.land, 'text-halo-width': LABEL_HALO }}
          />
        ) : null}
      </GeoJSONSource>
    </>
  );
}
