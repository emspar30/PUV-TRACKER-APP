import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  OFFLINE_SOURCE_ID,
  OFFLINE_SOURCE_LAYERS,
  buildOfflineStyle,
  pmtilesUrl,
  type MapPalette,
} from '../../data/map/offlineStyle';
import { TILESET } from '../../data/map/tileset';
import { getSeedRouteData } from '../../data/routeSource';
import { R4_STATIONS } from '../../data/seed/r4.placeholder';
import { MAP_OVERZOOM_LEVELS } from '../config';
import { boundsContain, boundsOfLines } from '../geo/bounds';

const PALETTE: MapPalette = {
  background: '#000001',
  land: '#000002',
  water: '#000003',
  landuse: '#000004',
  building: '#000005',
  road: '#000006',
  boundary: '#000007',
};

const FILE_URI = 'file:///data/user/0/com.tunton.app/files/map/butuan.v1.pmtiles';
const TILE_FILE = path.join(__dirname, '..', '..', '..', 'assets', 'map', 'butuan.pmtiles');

describe('offline map style', () => {
  const style = buildOfflineStyle(pmtilesUrl(FILE_URI), PALETTE);
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
    const used = style.layers.map((layer) => layer['source-layer']).filter(Boolean);
    expect(used).toEqual([...OFFLINE_SOURCE_LAYERS]);
  });

  it('takes every colour from the palette it is given', () => {
    const colours = json.match(/#[0-9a-fA-F]{6}/g) ?? [];
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) expect(Object.values(PALETTE)).toContain(colour);
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
    expect(TILESET.maxZoom + MAP_OVERZOOM_LEVELS).toBe(18);
  });
});

describe('initial map view', () => {
  const routeBounds = boundsOfLines(getSeedRouteData().lines.map((line) => line.coordinates));

  it('covers every route stop', () => {
    for (const stop of R4_STATIONS) {
      expect(boundsContain(routeBounds, [stop.lon, stop.lat, stop.lon, stop.lat])).toBe(true);
    }
  });

  it('lies inside the tile set, so the opening view has map data', () => {
    expect(boundsContain(TILESET.bounds, routeBounds)).toBe(true);
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
