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

// ST2-C2: water polygons tagged as a lake are left out. In the Butuan extract they are hundreds of
// small unnamed ponds and fishponds north of Bancasi, Libertad and downtown (OpenStreetMap), drawn
// as blue blocks over places people live; there is no real lake inside the map area. The sea,
// the river and canals stay.
export const WATER_KIND_DETAILS_HIDDEN = ['lake'] as const;
const NOT_HIDDEN_WATER = ['!', ['in', ['get', 'kind_detail'], ['literal', WATER_KIND_DETAILS_HIDDEN]]];
// ST2-C3: in the lower zoom tiles (used up to map zoom 14, as MapLibre reads 512 px vector tiles one
// level down) the extract holds the Agusan River as one polygon whose hole, the land between its
// channels with downtown, fills most of it, and other water as rings MapLibre cannot fill cleanly:
// it floods the land around them. Inland water areas are drawn from map zoom 14, where the tiles hold
// simple pieces; below that rivers and canals are drawn as lines. The sea is drawn at every zoom.
export const WATER_AREA_MIN_ZOOM = 14;
const IS_OCEAN = ['==', ['get', 'kind'], 'ocean'];
const WATER_FILTER = ['all', NOT_HIDDEN_WATER, ['!', IS_OCEAN]];
const RIVER_LINE_FILTER = ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'kind'], ['literal', ['river', 'canal']]]];
const RIVER_LINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 4, 14, 10];

// ST2-C3: the wide rural land uses are not shaded: farmland, wetland and woods cover most of the
// map around the city and, in grey, read as water. Parks, schools, cemeteries and the like stay.
export const LANDUSE_KINDS_HIDDEN = ['farmland', 'farmyard', 'orchard', 'meadow', 'grassland', 'scrub', 'wetland', 'wood', 'forest'] as const;
const LANDUSE_FILTER = ['!', ['in', ['get', 'kind'], ['literal', LANDUSE_KINDS_HIDDEN]]];

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
        filter: LANDUSE_FILTER,
        paint: { 'fill-color': palette.landuse, 'fill-opacity': palette.landuseOpacity },
      },
      { id: 'water-ocean', type: 'fill', source, 'source-layer': 'water', filter: IS_OCEAN, paint: { 'fill-color': palette.water } },
      {
        id: 'water',
        type: 'fill',
        source,
        'source-layer': 'water',
        minzoom: WATER_AREA_MIN_ZOOM,
        filter: WATER_FILTER,
        paint: { 'fill-color': palette.water },
      },
      {
        id: 'water-river-line',
        type: 'line',
        source,
        'source-layer': 'water',
        maxzoom: WATER_AREA_MIN_ZOOM,
        filter: RIVER_LINE_FILTER,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': palette.water, 'line-width': RIVER_LINE_WIDTH },
      },
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
