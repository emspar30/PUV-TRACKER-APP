import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  OFFLINE_SOURCE_ID,
  OFFLINE_SOURCE_LAYERS,
  WATER_AREA_MIN_ZOOM,
  buildOfflineStyle,
  pmtilesUrl,
  type MapPalette,
} from '../../data/map/offlineStyle';
import { GLYPHSET, GLYPH_FONT_REGULAR, LABEL_PROOF } from '../../data/map/glyphset';
import { TILESET } from '../../data/map/tileset';
import { glyphsUrl } from '../map/glyphInstall';
import { BASE_MAPS } from '../../theme/tokens';
import { R4_LINES, R4_STATIONS } from './fixtures/r4Placeholder';
import { MAP_OVERZOOM_LEVELS, MAP_VIEW_STEP_DEG } from '../config';
import { boundsContain, boundsOfLines, clipBounds, panLimit, roundView } from '../geo/bounds';

// Distinct marker colours, so the test can tell where each one ends up
const PALETTE: MapPalette = {
  background: '#000001',
  land: '#000002',
  water: '#000003',
  landuse: '#000004',
  building: '#000005',
  road: '#000006',
  roadCasing: '#000008',
  boundary: '#000007',
  landuseOpacity: 0.5,
  buildingOpacity: 0.5,
  roadOpacity: 0.5,
  boundaryOpacity: 0.5,
};

const FILE_URI = 'file:///data/user/0/com.tunton.app/files/map/butuan.v1.pmtiles';
const TILE_FILE = path.join(__dirname, '..', '..', '..', 'assets', 'map', 'butuan_v2.pmtiles');

describe.each([
  ['test palette', PALETTE],
  ['light theme', BASE_MAPS.light],
  ['dark theme', BASE_MAPS.dark],
] as const)('offline map style, %s', (_name, palette) => {
  const style = buildOfflineStyle(pmtilesUrl(FILE_URI), palette);
  const json = JSON.stringify(style);

  it('has no network URLs', () => {
    expect(json).not.toMatch(/https?:\/\//);
  });

  it('has no glyphs, sprite or text layers', () => {
    expect(style).not.toHaveProperty('glyphs');
    expect(style).not.toHaveProperty('sprite');
    expect(style.layers.filter((layer) => layer.type === 'symbol')).toEqual([]);
    expect(json).not.toContain('text-field');
  });

  it('reads only the local tile file, through the pmtiles scheme', () => {
    expect(Object.keys(style.sources)).toEqual([OFFLINE_SOURCE_ID]);
    expect(style.sources[OFFLINE_SOURCE_ID]).toEqual({ type: 'vector', url: `pmtiles://${FILE_URI}` });
  });

  it('draws the documented Protomaps v4 source layers and no others', () => {
    const used = new Set(style.layers.map((layer) => layer['source-layer']).filter(Boolean));
    expect([...used]).toEqual([...OFFLINE_SOURCE_LAYERS]);
  });

  it('leaves out the water polygons tagged as a lake (the fishponds drawn over land, ST2-C2)', () => {
    const water = style.layers.find((layer) => layer.id === 'water');
    expect(JSON.stringify(water?.filter)).toContain('["literal",["lake"]]');
  });

  it('draws inland water areas from zoom 14 and rivers as lines below, the sea at every zoom (ST2-C3)', () => {
    const byId = Object.fromEntries(style.layers.map((layer) => [layer.id, layer]));
    expect(byId['water-ocean']).toMatchObject({ type: 'fill', filter: ['==', ['get', 'kind'], 'ocean'] });
    expect(byId['water-ocean']).not.toHaveProperty('minzoom');
    expect(byId.water).toMatchObject({ type: 'fill', minzoom: WATER_AREA_MIN_ZOOM });
    expect(byId['water-river-line']).toMatchObject({ type: 'line', maxzoom: WATER_AREA_MIN_ZOOM, 'source-layer': 'water' });
  });

  it('does not shade farmland, wetland or woods, which read as water in grey (ST2-C3)', () => {
    const landuse = style.layers.find((layer) => layer.id === 'landuse');
    expect(JSON.stringify(landuse?.filter)).toContain('farmland');
    expect(JSON.stringify(landuse?.filter)).toContain('wetland');
    expect(JSON.stringify(landuse?.filter)).not.toContain('park');
  });

  it('takes every colour from the palette it is given', () => {
    const colours = json.match(/#[0-9a-fA-F]{6}/g) ?? [];
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) expect(Object.values(palette)).toContain(colour);
  });
});

describe('offline map style with the LB1a test label', () => {
  const GLYPHS_ROOT = 'file:///data/user/0/com.tunton.app/files/glyphs/';
  const style = buildOfflineStyle(pmtilesUrl(FILE_URI), BASE_MAPS.light, glyphsUrl(GLYPHS_ROOT, GLYPHSET), {
    font: GLYPH_FONT_REGULAR,
    ...LABEL_PROOF,
    textColor: '#111111',
    haloColor: BASE_MAPS.light.land,
  });
  const json = JSON.stringify(style);

  it('has no network URLs', () => {
    expect(json).not.toMatch(/https?:\/\//);
  });

  it('reads glyphs from a local file:// template inside the versioned folder', () => {
    expect(style.glyphs).toBe(`${GLYPHS_ROOT}glyphs-v1/{fontstack}/{range}.pbf`);
    expect(style.glyphs?.startsWith('file:///')).toBe(true);
  });

  it('has exactly one text layer, in a bundled font, above the base map', () => {
    const symbols = style.layers.filter((layer) => layer.type === 'symbol');
    expect(symbols).toHaveLength(1);
    expect(style.layers[style.layers.length - 1]).toBe(symbols[0]);
    const fonts = (symbols[0].layout as Record<string, unknown>)['text-font'];
    expect(fonts).toEqual([GLYPH_FONT_REGULAR]);
    expect(GLYPHSET.files.map((file) => file.font)).toContain(GLYPH_FONT_REGULAR);
  });

  it('the label sits inside the tile set', () => {
    expect(boundsContain(TILESET.bounds, [LABEL_PROOF.lon, LABEL_PROOF.lat, LABEL_PROOF.lon, LABEL_PROOF.lat])).toBe(true);
  });
});

describe('offline map style with local glyphs and no test label (AF3: room for the DEMO badge)', () => {
  const style = buildOfflineStyle(pmtilesUrl(FILE_URI), BASE_MAPS.dark, 'file:///data/user/0/com.tunton.app/files/glyphs/glyphs-v1/{fontstack}/{range}.pbf');

  it('names the local glyphs but draws no text of its own, and has no network URL', () => {
    expect(style.glyphs?.startsWith('file:///')).toBe(true);
    expect(style.layers.filter((layer) => layer.type === 'symbol')).toEqual([]);
    expect(JSON.stringify(style)).not.toMatch(/https?:\/\//);
  });
});

describe('glyph set facts', () => {
  const GLYPH_DIR = path.join(__dirname, '..', '..', '..', 'assets', 'glyphs', `glyphs-v${GLYPHSET.version}`);

  it.each(GLYPHSET.files.map((file) => [`${file.font} ${file.range}`, file] as const))('%s matches the bundled file', (_name, file) => {
    expect(fs.statSync(path.join(GLYPH_DIR, file.font, `${file.range}.pbf`)).size).toBe(file.bytes);
  });

  it('ships the font licence beside the files', () => {
    expect(fs.readFileSync(path.join(GLYPH_DIR, 'OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });
});

describe('tile set facts', () => {
  it('match the bundled file', () => {
    expect(fs.statSync(TILE_FILE).size).toBe(TILESET.bytes);
  });

  it('match the PMTiles header of the bundled file', () => {
    const header = Buffer.alloc(127);
    const fd = fs.openSync(TILE_FILE, 'r');
    fs.readSync(fd, header, 0, header.length, 0);
    fs.closeSync(fd);

    expect(header.toString('ascii', 0, 7)).toBe('PMTiles');
    // Byte 99 is the tile type (1 = vector), bytes 100 and 101 the zoom range
    expect(header[99]).toBe(1);
    expect(header[100]).toBe(TILESET.minZoom);
    expect(header[101]).toBe(TILESET.maxZoom);
    // Bounds are stored as degrees x 10,000,000 from byte 102: west, south, east, north
    const stored = [102, 106, 110, 114].map((offset) => header.readInt32LE(offset) / 1e7);
    stored.forEach((value, index) => expect(value).toBeCloseTo(TILESET.bounds[index], 6));
  });

  it('credit OpenStreetMap', () => {
    expect(TILESET.attribution).toBe('© OpenStreetMap contributors');
  });

  it('allows zooming past the last tile level by the configured allowance', () => {
    expect(TILESET.maxZoom + MAP_OVERZOOM_LEVELS).toBe(19);
  });
});

describe('initial map view', () => {
  // Fixture lines (the old placeholder), not the live seed; plus one line that runs 2 km north
  // of the tiles, like R5 in RR1
  const routeBounds = boundsOfLines(R4_LINES.map((line) => line.coordinates));
  const overrun = [
    [125.6, 9.0],
    [125.6, 9.09],
  ];

  it('covers every route stop', () => {
    for (const stop of R4_STATIONS) {
      expect(boundsContain(routeBounds, [stop.lon, stop.lat, stop.lon, stop.lat])).toBe(true);
    }
  });

  it('is clipped to the tile set, so the opening view has map data even when a line runs past it', () => {
    const all = boundsOfLines([...R4_LINES.map((line) => line.coordinates), overrun]);
    expect(boundsContain(TILESET.bounds, all)).toBe(false);
    expect(boundsContain(TILESET.bounds, clipBounds(all, TILESET.bounds))).toBe(true);
    expect(clipBounds(routeBounds, TILESET.bounds)).toEqual(routeBounds);
  });

  it('a box with no overlap falls back to the tile set', () => {
    expect(clipBounds([126, 10, 127, 11], TILESET.bounds)).toEqual(TILESET.bounds);
  });

  it('boundsOfLines returns west, south, east, north', () => {
    expect(
      boundsOfLines([
        [
          [125.5, 8.9],
          [125.6, 8.8],
        ],
        [[125.4, 9.0]],
      ]),
    ).toEqual([125.4, 8.8, 125.6, 9.0]);
    expect(() => boundsOfLines([])).toThrow(RangeError);
  });
});

describe('pan limit (ST2-C3)', () => {
  const tiles = TILESET.bounds;

  it('lets the screen edge reach the tile edge, and no further', () => {
    const view: [number, number, number, number] = [125.5, 8.9, 125.52, 8.94];
    const limit = panLimit(tiles, view);
    expect(limit[0]).toBeCloseTo(tiles[0] + 0.01);
    expect(limit[2]).toBeCloseTo(tiles[2] - 0.01);
    expect(limit[1]).toBeCloseTo(tiles[1] + 0.02);
    expect(limit[3]).toBeCloseTo(tiles[3] - 0.02);
  });

  it('reaches nearer the corners the further the map is zoomed in', () => {
    const wide = panLimit(tiles, [0, 0, 0.2, 0.1]);
    const close = panLimit(tiles, [0, 0, 0.01, 0.005]);
    expect(boundsContain(close, wide)).toBe(true);
    expect(close[3]).toBeGreaterThan(wide[3]);
  });

  it('holds the centre at the middle of a side the screen cannot fit', () => {
    const limit = panLimit(tiles, [0, 0, 1, 1]);
    expect(limit[0]).toBeCloseTo((tiles[0] + tiles[2]) / 2);
    expect(limit[0]).toBe(limit[2]);
  });

  it('rounds the visible area up to the step, so small moves keep the same limit', () => {
    const a = roundView([125.5, 8.9, 125.5131, 8.92], MAP_VIEW_STEP_DEG);
    const b = roundView([125.51, 8.91, 125.5229, 8.9299], MAP_VIEW_STEP_DEG);
    expect(a).toEqual(b);
    expect(a[2]).toBeGreaterThanOrEqual(0.0131);
  });
});
