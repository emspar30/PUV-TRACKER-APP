import style from '../../../assets/map/style.json';
import { R4_STATIONS } from '../../data/seed/r4.placeholder';
import { MAP_BOUNDS, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from '../config';
import { containsPoint } from '../geo/bounds';
import { BASEMAP_SOURCE_ID, toPmtilesUrl, withTileSource } from '../map/offlineStyle';

// Layers of the Protomaps basemap that the bundled tile set contains (docs/tiles.md)
const TILE_SET_LAYERS = [
  'boundaries',
  'buildings',
  'earth',
  'landcover',
  'landuse',
  'places',
  'pois',
  'roads',
  'water',
];

type Layer = { id: string; type: string; source?: string; 'source-layer'?: string };
const layers = style.layers as Layer[];

describe('style has no network URLs', () => {
  it('contains no http or https address anywhere', () => {
    expect(JSON.stringify(style)).not.toMatch(/https?:/i);
  });

  it('has no glyph or sprite files to fetch', () => {
    expect(style).not.toHaveProperty('glyphs');
    expect(style).not.toHaveProperty('sprite');
  });

  it('has no text or icon layers, which would need font files', () => {
    expect(layers.filter((layer) => layer.type === 'symbol')).toEqual([]);
  });

  it('has one source, with no address until the app sets it', () => {
    expect(Object.keys(style.sources)).toEqual([BASEMAP_SOURCE_ID]);
    expect(style.sources[BASEMAP_SOURCE_ID]).not.toHaveProperty('url');
    expect(style.sources[BASEMAP_SOURCE_ID]).not.toHaveProperty('tiles');
  });
});

describe('style layers', () => {
  it('read only from the basemap source and from layers the tile set has', () => {
    for (const layer of layers) {
      if (layer.type === 'background') continue;
      expect(layer.source).toBe(BASEMAP_SOURCE_ID);
      expect(TILE_SET_LAYERS).toContain(layer['source-layer']);
    }
  });

  it('have unique ids', () => {
    const ids = layers.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('tile source', () => {
  const fileUri = 'file:///data/user/0/com.tunton.app/cache/butuan.pmtiles';

  it('builds a pmtiles address from a local file', () => {
    expect(toPmtilesUrl(fileUri)).toBe(`pmtiles://${fileUri}`);
  });

  it('refuses a tile set that is not a local file', () => {
    expect(() => toPmtilesUrl('https://example.com/butuan.pmtiles')).toThrow();
  });

  it('sets the address on a copy and leaves the style file untouched', () => {
    const url = toPmtilesUrl(fileUri);
    const result = withTileSource(style, url);
    expect(result.sources[BASEMAP_SOURCE_ID]).toMatchObject({ type: 'vector', url });
    expect(result.layers).toBe(style.layers);
    expect(style.sources[BASEMAP_SOURCE_ID]).not.toHaveProperty('url');
  });

  it('fails clearly when the style has no basemap source', () => {
    expect(() => withTileSource({ sources: {} }, 'pmtiles://file:///x')).toThrow();
  });
});

describe('map bounds', () => {
  it('cover every placeholder stop', () => {
    for (const station of R4_STATIONS) {
      expect(containsPoint(MAP_BOUNDS, station)).toBe(true);
    }
  });

  it('include the edges and exclude points outside', () => {
    const [west, south, east, north] = MAP_BOUNDS;
    expect(containsPoint(MAP_BOUNDS, { lat: south, lon: west })).toBe(true);
    expect(containsPoint(MAP_BOUNDS, { lat: north, lon: east })).toBe(true);
    expect(containsPoint(MAP_BOUNDS, { lat: north + 1, lon: east })).toBe(false);
    expect(containsPoint(MAP_BOUNDS, { lat: south, lon: west - 1 })).toBe(false);
  });

  it('are ordered west, south, east, north', () => {
    const [west, south, east, north] = MAP_BOUNDS;
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
    expect(MAP_MIN_ZOOM).toBeLessThan(MAP_MAX_ZOOM);
  });
});
