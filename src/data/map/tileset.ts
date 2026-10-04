// Facts about the offline tile set that ships with the app (assets/map/butuan_v2.pmtiles).
// v2 (2026-10-05): Emjay's larger extract, north to 9.07 so R5 is covered, zoom 0 to 15.
// Pure data: no React Native or Expo imports.
//
// TODO(placeholder): small OpenStreetMap-derived extract made with `pmtiles extract`
// (see docs/tiles.md). When the file is replaced, update `bytes` and bump `version`
// so installed copies are replaced on the next launch.

import type { Bounds } from '../../shared/geo/bounds';

export type Tileset = {
  id: string;
  version: number;
  // Exact size of the bundled file, used to detect a missing, old or interrupted copy
  bytes: number;
  bounds: Bounds;
  minZoom: number;
  maxZoom: number;
  attribution: string;
};

export const TILESET: Tileset = {
  id: 'butuan',
  version: 2,
  bytes: 3674024,
  bounds: [125.45, 8.85, 125.7, 9.07],
  minZoom: 0,
  maxZoom: 15,
  // Protomaps basemap 4.15.2 (build 20261002), built from OpenStreetMap (ODbL) and Natural Earth
  attribution: '© OpenStreetMap contributors',
};
