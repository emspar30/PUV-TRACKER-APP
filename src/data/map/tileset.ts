// Facts about the offline tile set that ships with the app (assets/map/butuan.pmtiles).
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
  version: 1,
  bytes: 1775640,
  bounds: [125.45, 8.85, 125.7, 9.02],
  minZoom: 0,
  maxZoom: 14,
  // Protomaps basemap 4.15.2, built from OpenStreetMap (ODbL) and Natural Earth
  attribution: '© OpenStreetMap contributors',
};
