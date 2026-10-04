// RR2: the terminal trim and the Draft rule. Synthetic fixtures only.

import { lineLengthKm } from '../geo/line';
import { importRoute, isDraftRoute, trimLine } from '../routing/routeImport';
import { pointAt } from './fixtures/routeFixture';

const BOUNDS: [number, number, number, number] = [125.4, 8.9, 125.7, 9.1];
const at = (km: number, northM = 0): [number, number] => {
  const p = pointAt(km, northM);
  return [p.lon, p.lat];
};
// A straight 8 km street, east from the start
const STREET = [at(0), at(2), at(5), at(8)];

describe('trimLine', () => {
  it('cuts the line at the point nearest the trim point and reports the length removed', () => {
    const result = trimLine(STREET, at(6, 40));
    expect(result.applied).toBe(true);
    expect(lineLengthKm(result.line)).toBeCloseTo(6, 2);
    expect(result.tailKm).toBeCloseTo(2, 2);
    expect(result.reason).toContain('trimmed 2.00 km');
  });

  it('does not trim when the trim point is more than 150 m from the line', () => {
    const result = trimLine(STREET, at(6, 160));
    expect(result.applied).toBe(false);
    expect(result.line).toBe(STREET);
    expect(result.reason).toContain('160 m from the line');
  });

  it('does not trim a tail of 300 m or less', () => {
    const result = trimLine(STREET, at(7.75));
    expect(result.applied).toBe(false);
    expect(result.reason).toContain('250 m beyond');
  });

  it('importRoute applies the trim to the traced return leg only', () => {
    const geojson = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: STREET } };
    const route = importRoute(geojson, 'partial_return', BOUNDS, { trimAt: { return: at(6) } });
    expect(route.directions).toHaveLength(1);
    expect(route.directions[0].lengthKm).toBeCloseTo(6, 2);
    expect(route.directions[0].trim?.applied).toBe(true);
    const untouched = importRoute(geojson, 'partial_return', BOUNDS, { trimAt: { outbound: at(6) } });
    expect(untouched.directions[0].lengthKm).toBeCloseTo(8, 2);
  });

  it('a primary file never counts as per-direction data', () => {
    const geojson = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: STREET } };
    const route = importRoute(geojson, 'vice_versa', BOUNDS);
    expect(route.directions.map((d) => d.perDirection)).toEqual([false, false]);
    expect(isDraftRoute(route.directions)).toBe(true);
  });
});

describe('Draft rule', () => {
  it('a route is a draft until both legs came from per-direction files', () => {
    expect(isDraftRoute([{ direction: 'return', perDirection: false }])).toBe(true);
    expect(isDraftRoute([{ direction: 'return', perDirection: true }])).toBe(true);
    expect(isDraftRoute([{ direction: 'outbound', perDirection: true }, { direction: 'return', perDirection: false }])).toBe(true);
    expect(isDraftRoute([{ direction: 'outbound' }, { direction: 'return' }])).toBe(true);
    expect(isDraftRoute([{ direction: 'outbound', perDirection: true }, { direction: 'return', perDirection: true }])).toBe(false);
  });
});
