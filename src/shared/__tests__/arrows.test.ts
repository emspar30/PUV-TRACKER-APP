import type { Position } from 'geojson';

import { R4_LINES } from '../../data/seed/r4.placeholder';
import { directionArrows } from '../geo/arrows';
import { haversineMeters } from '../geo/haversine';
import { lineLengthKm, projectOntoLine } from '../geo/line';

const outbound = R4_LINES.find((line) => line.direction === 'outbound')!.coordinates;
const returning = R4_LINES.find((line) => line.direction === 'return')!.coordinates;

const OPTIONS = { spacingM: 600, sizeM: 60, wingAngleDeg: 30 };

const toLatLon = ([lon, lat]: Position) => ({ lat, lon });

describe('direction arrows', () => {
  const arrows = directionArrows(outbound, OPTIONS);

  it('places one arrow per spacing along the line', () => {
    const expected = Math.ceil((lineLengthKm(outbound) * 1000 - OPTIONS.spacingM / 2) / OPTIONS.spacingM);
    expect(arrows).toHaveLength(expected);
    expect(arrows.length).toBeGreaterThan(5);
  });

  it('each arrow is a V of three points with its tip on the line', () => {
    for (const arrow of arrows) {
      expect(arrow).toHaveLength(3);
      expect(projectOntoLine(outbound, toLatLon(arrow[1])).offsetM).toBeLessThan(1);
    }
  });

  it('wings have the requested length and trail behind the tip', () => {
    for (const [left, tip, right] of arrows) {
      expect(haversineMeters(toLatLon(left), toLatLon(tip))).toBeCloseTo(OPTIONS.sizeM, 0);
      expect(haversineMeters(toLatLon(right), toLatLon(tip))).toBeCloseTo(OPTIONS.sizeM, 0);

      const tipChainage = projectOntoLine(outbound, toLatLon(tip)).chainageKm;
      expect(projectOntoLine(outbound, toLatLon(left)).chainageKm).toBeLessThan(tipChainage);
      expect(projectOntoLine(outbound, toLatLon(right)).chainageKm).toBeLessThan(tipChainage);
    }
  });

  it('arrows on the return line point the opposite way', () => {
    // On the long straight stretch, outbound runs east and the return line runs west
    const lastOut = arrows[arrows.length - 1];
    const firstBack = directionArrows(returning, OPTIONS)[0];
    const eastward = lastOut[1][0] - lastOut[0][0];
    const westward = firstBack[1][0] - firstBack[0][0];
    expect(eastward).toBeGreaterThan(0);
    expect(westward).toBeLessThan(0);
  });

  it('honours a start offset, so two directions on one street do not stack their arrows', () => {
    const shifted = directionArrows(outbound, { ...OPTIONS, startOffsetM: 0.75 * OPTIONS.spacingM });
    const gap = haversineMeters(toLatLon(shifted[0][1]), toLatLon(arrows[0][1]));
    expect(gap).toBeGreaterThan(100);
  });

  it('returns no arrows for a line shorter than the first offset', () => {
    expect(directionArrows(outbound.slice(0, 2), { ...OPTIONS, spacingM: 100000 })).toEqual([]);
  });

  it('rejects a non-positive spacing or size', () => {
    expect(() => directionArrows(outbound, { ...OPTIONS, spacingM: 0 })).toThrow(RangeError);
    expect(() => directionArrows(outbound, { ...OPTIONS, sizeM: -1 })).toThrow(RangeError);
  });
});
