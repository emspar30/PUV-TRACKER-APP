import { boundsContainPoint, northCenterCap, type Bounds } from '../geo/bounds';

// A fixed box, not the tile set's bounds
const BOX: Bounds = [125.0, 8.0, 126.0, 9.0];

describe('boundsContainPoint (blue dot inside the offline map)', () => {
  it('accepts a point inside and on the edges', () => {
    expect(boundsContainPoint(BOX, { lat: 8.5, lon: 125.5 })).toBe(true);
    expect(boundsContainPoint(BOX, { lat: 8.0, lon: 125.0 })).toBe(true);
    expect(boundsContainPoint(BOX, { lat: 9.0, lon: 126.0 })).toBe(true);
  });

  it('rejects a point outside on any side', () => {
    expect(boundsContainPoint(BOX, { lat: 7.99, lon: 125.5 })).toBe(false);
    expect(boundsContainPoint(BOX, { lat: 9.01, lon: 125.5 })).toBe(false);
    expect(boundsContainPoint(BOX, { lat: 8.5, lon: 124.99 })).toBe(false);
    expect(boundsContainPoint(BOX, { lat: 8.5, lon: 126.01 })).toBe(false);
  });
});

describe('northCenterCap (driver map: the top of the screen stays on the tiles)', () => {
  const tiles: Bounds = [125.45, 8.85, 125.7, 9.07];

  it('keeps the screen top at the tiles north edge', () => {
    expect(northCenterCap(tiles, 0.05, 8.9)).toBeCloseTo(9.02);
  });

  it('never cuts off the default view', () => {
    expect(northCenterCap(tiles, 0.2, 8.93)).toBe(8.93);
  });

  it('never goes below the tiles south edge', () => {
    expect(northCenterCap(tiles, 0.5, 8.7)).toBe(8.85);
  });
});
