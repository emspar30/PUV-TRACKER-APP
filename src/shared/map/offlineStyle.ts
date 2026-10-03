// Helpers for the offline map style (assets/map/style.json).
// The style file names no tile location: the tile set's path is only known on the device,
// and MapLibre on Android needs a fully specified URL, so the URL is added at run time.

export const BASEMAP_SOURCE_ID = 'basemap';

const PMTILES_SCHEME = 'pmtiles://';
const FILE_SCHEME = 'file://';

export type StyleSource = {
  type: string;
  url?: string;
  [key: string]: unknown;
};

export type StyleJson = {
  sources: Record<string, StyleSource>;
  [key: string]: unknown;
};

// MapLibre reads a local PMTiles archive from pmtiles://file://<absolute path>
export function toPmtilesUrl(fileUri: string): string {
  if (!fileUri.startsWith(FILE_SCHEME)) {
    throw new Error(`The tile set must be a local file, got: ${fileUri}`);
  }
  return `${PMTILES_SCHEME}${fileUri}`;
}

// Returns a copy of the style whose basemap source reads from the given tile set
export function withTileSource<T extends StyleJson>(style: T, pmtilesUrl: string): T {
  const basemap = style.sources[BASEMAP_SOURCE_ID];
  if (!basemap) {
    throw new Error(`The style has no "${BASEMAP_SOURCE_ID}" source`);
  }
  return {
    ...style,
    sources: {
      ...style.sources,
      [BASEMAP_SOURCE_ID]: { ...basemap, url: pmtilesUrl },
    },
  };
}
