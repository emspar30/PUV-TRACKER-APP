// Map label layers (LB1b): city, barangay, road and street names from the offline tiles, drawn with
// the bundled Noto Sans glyphs. Pure data: no React Native or Expo imports.
// Tiers (docs/LABELS_PLAN.md §3): cities from zoom 11; barangays and major roads from 13; streets
// from 15. Names use the local `name`, with `name:en` as a fallback. Collisions drop the lower tiers
// first (symbol-sort-key), and labels are added under the route lines, so a route is never covered.

import {
  LABEL_BARANGAY_MIN_ZOOM,
  LABEL_CITY_MIN_ZOOM,
  LABEL_DIMMED_OPACITY,
  LABEL_MAJOR_ROAD_MIN_ZOOM,
  LABEL_STREET_MIN_ZOOM,
} from '../../shared/config';
import type { MapLabelPaint } from '../../theme/tokens';
import { GLYPH_FONT_MEDIUM, GLYPH_FONT_REGULAR } from './glyphset';
import { OFFLINE_SOURCE_ID } from './offlineStyle';

export type LabelLayer = {
  id: string;
  type: 'symbol';
  source: string;
  'source-layer': string;
  minzoom: number;
  filter: unknown[];
  layout: Record<string, unknown>;
  paint: Record<string, unknown>;
};

const NAME = ['coalesce', ['get', 'name'], ['get', 'name:en']];
const HALO_WIDTH = 1.5;
const PADDING = 4;
const ROAD_SPACING = 300;
// Text sizes in dp, growing a little with zoom
const SIZE = {
  city: ['interpolate', ['linear'], ['zoom'], 11, 13, 14, 14],
  barangay: ['interpolate', ['linear'], ['zoom'], 13, 12, 16, 13],
  road: ['interpolate', ['linear'], ['zoom'], 13, 11, 17, 12],
} as const;
// Lower numbers are placed first: city, barangay, major road, street
const SORT = { city: 1, barangay: 2, major: 3, street: 4 } as const;

export const LABEL_LAYER_IDS = ['label-city', 'label-barangay', 'label-major-road', 'label-street'] as const;

export function labelLayers(paint: MapLabelPaint, dimmed: boolean): LabelLayer[] {
  const opacity = dimmed ? LABEL_DIMMED_OPACITY : 1;
  const text = (color: string) => ({ 'text-color': color, 'text-halo-color': paint.halo, 'text-halo-width': HALO_WIDTH, 'text-opacity': opacity });
  const point = (font: string, size: unknown, sort: number) => ({
    'text-field': NAME,
    'text-font': [font],
    'text-size': size,
    'text-padding': PADDING,
    'text-allow-overlap': false,
    'symbol-sort-key': sort,
  });
  const along = (sort: number) => ({ ...point(GLYPH_FONT_REGULAR, SIZE.road, sort), 'symbol-placement': 'line', 'symbol-spacing': ROAD_SPACING });
  const base = { type: 'symbol' as const, source: OFFLINE_SOURCE_ID };
  return [
    {
      ...base,
      id: LABEL_LAYER_IDS[0],
      'source-layer': 'places',
      minzoom: LABEL_CITY_MIN_ZOOM,
      filter: ['==', ['get', 'kind'], 'locality'],
      layout: point(GLYPH_FONT_MEDIUM, SIZE.city, SORT.city),
      paint: text(paint.text),
    },
    {
      ...base,
      id: LABEL_LAYER_IDS[1],
      'source-layer': 'places',
      minzoom: LABEL_BARANGAY_MIN_ZOOM,
      filter: ['in', ['get', 'kind'], ['literal', ['macrohood', 'neighbourhood']]],
      layout: point(GLYPH_FONT_REGULAR, SIZE.barangay, SORT.barangay),
      paint: text(paint.text),
    },
    {
      ...base,
      id: LABEL_LAYER_IDS[2],
      'source-layer': 'roads',
      minzoom: LABEL_MAJOR_ROAD_MIN_ZOOM,
      filter: ['in', ['get', 'kind'], ['literal', ['highway', 'major_road']]],
      layout: along(SORT.major),
      paint: text(paint.muted),
    },
    {
      ...base,
      id: LABEL_LAYER_IDS[3],
      'source-layer': 'roads',
      minzoom: LABEL_STREET_MIN_ZOOM,
      filter: ['in', ['get', 'kind'], ['literal', ['medium_road', 'minor_road']]],
      layout: along(SORT.street),
      paint: text(paint.muted),
    },
  ];
}
