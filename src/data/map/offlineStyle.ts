// Label-free map style for the Protomaps basemap v4 schema, in a light or a dark palette.
// It has no text layers, so it needs no glyphs or sprites, and it names no remote URL:
// the only source is the local tile file. The LB1a proof adds one test label read from local
// glyph files (file://). Pure data: no React Native or Expo imports.

import type { BaseMapPalette } from '../../theme/tokens';

export type MapPalette = BaseMapPalette;

export type OfflineStyle = {
  version: 8;
  // Local glyph template (file://), only when the style has text (LB1a)
  glyphs?: string;
  sources: Record<string, { type: 'vector'; url: string } | { type: 'geojson'; data: unknown }>;
  layers: Record<string, unknown>[];
};

// LB1a: one test label drawn from the local glyph files
export type LabelProof = {
  glyphsUrl: string;
  font: string;
  text: string;
  lon: number;
  lat: number;
  textColor: string;
  haloColor: string;
};

export const LABEL_PROOF_SOURCE_ID = 'label-proof';
const LABEL_PROOF_SIZE = 16;
const LABEL_PROOF_HALO = 1.5;

export const OFFLINE_SOURCE_ID = 'basemap';

// Protomaps v4 source layers this style draws. Not used: landcover, places, pois (labels and low zooms).
export const OFFLINE_SOURCE_LAYERS = ['earth', 'landuse', 'water', 'buildings', 'roads', 'boundaries'] as const;

// MapLibre Native reads a local PMTiles archive through this URL scheme
export function pmtilesUrl(fileUri: string): string {
  return `pmtiles://${fileUri}`;
}

const ROAD_WIDTH = ['interpolate', ['linear'], ['zoom'], 8, 0.4, 12, 1, 16, 4];
// The casing is the road width plus this much on each side
const ROAD_CASING_WIDTH = ['interpolate', ['linear'], ['zoom'], 8, 0.8, 12, 2, 16, 6];

// With `glyphsUrl` (the installed local glyphs), layers added on top of the map may draw text, such as
// the "DEMO" badge on demo vehicles (AF3); the base style itself still has no text layer.
export function buildOfflineStyle(tilesUrl: string, palette: MapPalette, glyphsUrl?: string | null, proof?: Omit<LabelProof, 'glyphsUrl'>): OfflineStyle {
  const base = buildBaseStyle(tilesUrl, palette);
  const style = glyphsUrl ? { ...base, glyphs: glyphsUrl } : base;
  if (!proof || !glyphsUrl) return style;
  return {
    ...style,
    sources: {
      ...style.sources,
      [LABEL_PROOF_SOURCE_ID]: {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [proof.lon, proof.lat] } },
      },
    },
    layers: [
      ...style.layers,
      {
        id: LABEL_PROOF_SOURCE_ID,
        type: 'symbol',
        source: LABEL_PROOF_SOURCE_ID,
        layout: { 'text-field': proof.text, 'text-font': [proof.font], 'text-size': LABEL_PROOF_SIZE },
        paint: { 'text-color': proof.textColor, 'text-halo-color': proof.haloColor, 'text-halo-width': LABEL_PROOF_HALO },
      },
    ],
  };
}

function buildBaseStyle(tilesUrl: string, palette: MapPalette): OfflineStyle {
  const source = OFFLINE_SOURCE_ID;
  const roadCasing = palette.roadCasing
    ? [
        {
          id: 'roads-casing',
          type: 'line',
          source,
          'source-layer': 'roads',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': palette.roadCasing, 'line-width': ROAD_CASING_WIDTH },
        },
      ]
    : [];

  return {
    version: 8,
    sources: {
      [source]: { type: 'vector', url: tilesUrl },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': palette.background } },
      { id: 'earth', type: 'fill', source, 'source-layer': 'earth', paint: { 'fill-color': palette.land } },
      {
        id: 'landuse',
        type: 'fill',
        source,
        'source-layer': 'landuse',
        paint: { 'fill-color': palette.landuse, 'fill-opacity': palette.landuseOpacity },
      },
      { id: 'water', type: 'fill', source, 'source-layer': 'water', paint: { 'fill-color': palette.water } },
      {
        id: 'buildings',
        type: 'fill',
        source,
        'source-layer': 'buildings',
        paint: { 'fill-color': palette.building, 'fill-opacity': palette.buildingOpacity },
      },
      ...roadCasing,
      {
        id: 'roads',
        type: 'line',
        source,
        'source-layer': 'roads',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': palette.road, 'line-opacity': palette.roadOpacity, 'line-width': ROAD_WIDTH },
      },
      {
        id: 'boundaries',
        type: 'line',
        source,
        'source-layer': 'boundaries',
        paint: {
          'line-color': palette.boundary,
          'line-opacity': palette.boundaryOpacity,
          'line-dasharray': [2, 2],
        },
      },
    ],
  };
}
