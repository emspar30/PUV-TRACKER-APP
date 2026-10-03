import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import type { RouteLine } from '@/data/db/routeRepository';
import { useRouteNetwork } from '@/features/plan/useRouteNetwork';
import { colors } from '@/theme';

import arrowImage from '../../../assets/map/route-arrow.png';
import { BASEMAP_TOP_LAYER_ID } from './layers';

const ARROW_IMAGE = 'route-arrow';
const LINE_WIDTH = 4;
const CASING_WIDTH = 7;
// Each direction is drawn this many pixels to the right of its direction of travel, so where
// outbound and return share a road they sit side by side instead of on top of each other
const SIDE_OFFSET = 4;
const RETURN_DASH = [2, 1.2];
const ARROW_SPACING = 70;
// PRD 7.2: routes other than the selected one fade to 8% opacity
const FADED_OPACITY = 0.08;

type RouteLinesProps = {
  // When set, this line is drawn at full opacity and the others are faded
  highlightRouteId?: string | null;
};

function RouteLineLayers({ line, opacity, belowId }: { line: RouteLine; opacity: number; belowId: string }) {
  const shape = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: line.coordinates },
    }),
    [line],
  );
  const id = `route-${line.routeId}`;
  const isReturn = line.direction === 'return';
  const lineLayout = { 'line-cap': 'round', 'line-join': 'round' } as const;

  // One source and fixed colors per line: no data-driven expressions
  return (
    <GeoJSONSource id={id} data={shape}>
      <Layer
        id={`${id}-casing`}
        type="line"
        afterId={belowId}
        layout={lineLayout}
        paint={{
          'line-color': colors.routeCasing,
          'line-width': CASING_WIDTH,
          'line-offset': SIDE_OFFSET,
          'line-opacity': opacity,
        }}
      />
      <Layer
        id={`${id}-line`}
        type="line"
        afterId={`${id}-casing`}
        layout={lineLayout}
        paint={{
          'line-color': line.routeColor,
          'line-width': LINE_WIDTH,
          'line-offset': SIDE_OFFSET,
          'line-opacity': opacity,
          // The return line is dashed, the outbound line solid
          ...(isReturn ? { 'line-dasharray': RETURN_DASH } : {}),
        }}
      />
      {/* Arrows point the way the line runs: its direction of travel */}
      <Layer
        id={`${id}-arrows`}
        type="symbol"
        afterId={`${id}-line`}
        layout={{
          'symbol-placement': 'line',
          'symbol-spacing': ARROW_SPACING,
          'icon-image': ARROW_IMAGE,
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          // Same side shift as the line, in the arrow's own frame (+y is right of travel)
          'icon-offset': [0, SIDE_OFFSET],
        }}
        paint={{ 'icon-opacity': opacity }}
      />
    </GeoJSONSource>
  );
}

// Every route line from the local database, in its route color (PRD 7.2 "Display"), with
// arrows for the direction of travel. Must be rendered inside a map.
export function RouteLines({ highlightRouteId = null }: RouteLinesProps) {
  const { network } = useRouteNetwork();
  if (!network) return null;

  return (
    <>
      <Images images={{ [ARROW_IMAGE]: arrowImage }} />
      {network.lines.map((line) => (
        <RouteLineLayers
          key={line.routeId}
          line={line}
          belowId={BASEMAP_TOP_LAYER_ID}
          opacity={highlightRouteId && highlightRouteId !== line.routeId ? FADED_OPACITY : 1}
        />
      ))}
    </>
  );
}
