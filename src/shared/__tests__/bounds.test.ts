import { boundsContainPoint, type Bounds } from '../geo/bounds';

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
