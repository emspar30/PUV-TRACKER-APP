import type { Position } from 'geojson';

import { ROUTE_MAX_POINTS_PER_LINE, ROUTE_SIMPLIFY_TOLERANCE_M } from '../config';
import type { Bounds } from '../geo/bounds';
import { chainages, checkBounds, extractPieces, importRoute, isClosed, mergePieces, simplifyLine } from '../routing/routeImport';

// Small fixed fixtures near Butuan; not the real route files
const BOUNDS: Bounds = [125.45, 8.85, 125.7, 9.02];
const DEG_PER_M = 1 / 111320;
// A straight east-west street 2 km long with a point every 100 m, altitude included
const street: Position[] = Array.from({ length: 21 }, (_, i) => [125.5 + i * 100 * DEG_PER_M, 8.95, 0]);
const feature = (geometry: unknown) => ({ type: 'Feature', properties: { Name: 'x' }, geometry });

describe('route import: geometry types', () => {
  it.each([
    ['LineString', { type: 'LineString', coordinates: street }],
    ['Feature', feature({ type: 'LineString', coordinates: street })],
    ['FeatureCollection', { type: 'FeatureCollection', features: [feature({ type: 'LineString', coordinates: street }), feature({ type: 'Point', coordinates: [125.5, 8.95, 0] })] }],
    ['MultiLineString (connected)', { type: 'MultiLineString', coordinates: [street.slice(0, 11), street.slice(10)] }],
  ])('%s gives one 21-point line', (_name, geojson) => {
    const { pieces } = extractPieces(geojson);
    const { line, issues } = mergePieces(pieces);
    expect(issues).toEqual([]);
    expect(line).toHaveLength(21);
  });

  it('strips altitude', () => {
    const { pieces } = extractPieces({ type: 'LineString', coordinates: street });
    expect(pieces[0].every((p) => p.length === 2)).toBe(true);
  });

  it('lists Point features apart from the line', () => {
    const { points } = extractPieces({ type: 'FeatureCollection', features: [feature({ type: 'Point', coordinates: [125.5, 8.95] })] });
    expect(points).toEqual([[125.5, 8.95]]);
  });

  it('refuses to join pieces that do not connect', () => {
    const far = street.slice(15).map((p) => [p[0], p[1] + 500 * DEG_PER_M]);
    const { issues } = mergePieces([street.slice(0, 10), far]);
    expect(issues[0].level).toBe('fail');
  });
});

describe('route import: checks', () => {
  it('a swapped (latitude-first) file fails', () => {
    const swapped = street.map((p) => [p[1], p[0]]);
    expect(importRoute({ type: 'LineString', coordinates: swapped }, 'partial_return', BOUNDS).issues.some((i) => i.level === 'fail')).toBe(true);
  });

  it('points outside the tiles warn (loudly beyond 1 km); more than 2 km outside fails', () => {
    const north = (m: number) => [[125.5, 9.02 + m * DEG_PER_M]];
    expect(checkBounds(north(500), BOUNDS)[0]).toMatchObject({ level: 'warn' });
    expect(checkBounds(north(500), BOUNDS)[0].message).not.toMatch(/far outside/);
    expect(checkBounds(north(1500), BOUNDS)[0]).toMatchObject({ level: 'warn', message: expect.stringMatching(/far outside/) });
    expect(checkBounds(north(2500), BOUNDS)[0].level).toBe('fail');
    expect(checkBounds(street, BOUNDS)).toEqual([]);
  });
});

describe('route import: simplification', () => {
  it('drops collinear points and stays within the tolerance', () => {
    const wiggly = street.map((p, i) => [p[0], p[1] + (i % 2) * 2 * DEG_PER_M]);
    const { line, maxDeviationM } = simplifyLine(wiggly);
    expect(line.length).toBeLessThan(wiggly.length);
    expect(maxDeviationM).toBeLessThanOrEqual(ROUTE_SIMPLIFY_TOLERANCE_M);
  });

  it('keeps a bend larger than the tolerance', () => {
    const bend = [...street.slice(0, 11), [street[10][0], 8.95 + 300 * DEG_PER_M]];
    expect(simplifyLine(bend).line.length).toBeGreaterThanOrEqual(3);
  });

  it('the point limit is a config constant', () => {
    expect(ROUTE_MAX_POINTS_PER_LINE).toBe(1500);
  });
});

describe('route import: chainage and loops', () => {
  it('chainage grows by the segment lengths', () => {
    const c = chainages(street.map((p) => [p[0], p[1]]));
    expect(c[0]).toBe(0);
    expect(c[20]).toBeCloseTo(2, 1);
  });

  it('start and end within 100 m is a loop', () => {
    const loop = [...street, [125.5 + 50 * DEG_PER_M, 8.95]];
    expect(isClosed(loop)).toBe(true);
    expect(isClosed(street)).toBe(false);
    expect(importRoute({ type: 'LineString', coordinates: loop }, 'partial_return', BOUNDS).directionMode).toBe('loop');
  });
});

describe('route import: directions', () => {
  it('a "vice versa" route gets a derived reverse return (R3)', () => {
    const r = importRoute({ type: 'LineString', coordinates: street }, 'vice_versa', BOUNDS);
    expect(r.directions.map((d) => [d.direction, d.derived])).toEqual([
      ['outbound', false],
      ['return', true],
    ]);
    expect(r.directions[1].coordinates).toEqual([...r.directions[0].coordinates].reverse());
    expect(r.note).toBe('outbound traced; return derived (reverse)');
  });

  it('a partial return leg is stored as the return direction only, marked partial (R4, R5)', () => {
    const r = importRoute({ type: 'LineString', coordinates: street }, 'partial_return', BOUNDS);
    expect(r.directionMode).toBe('one_way');
    expect(r.directions.map((d) => [d.direction, d.derived, d.partial])).toEqual([['return', false, true]]);
    expect(r.note).toBe('return leg traced, partial; outbound not provided');
  });

  it('an outbound-only leg is stored as the outbound direction, marked partial (R14, RR3)', () => {
    const r = importRoute({ type: 'LineString', coordinates: street }, 'outbound_only', BOUNDS);
    expect(r.directionMode).toBe('one_way');
    expect(r.directions.map((d) => [d.direction, d.derived, d.partial])).toEqual([['outbound', false, true]]);
    expect(r.note).toBe('outbound traced, partial; return not provided');
  });
});

// R4's shape: a highway in from the turnaround, then a loop downtown that ends back on the highway
// where it passed before. Here: east 2 km along the street, a 600 m loop north, back to 1 km.
describe('route import: closes_back (R4)', () => {
  const north = (m: number, eastM: number) => [125.5 + eastM * DEG_PER_M, 8.95 + m * DEG_PER_M];
  const inAndRound: Position[] = [...street.map((p) => [p[0], p[1]]), north(300, 2000), north(300, 1000), north(0, 1000)];

  it('derives the outbound from the end back along the line to its start, with no U-turn', () => {
    const r = importRoute({ type: 'LineString', coordinates: inAndRound }, 'closes_back', BOUNDS);
    expect(r.directionMode).toBe('two_way');
    const ret = r.directions.find((d) => d.direction === 'return')!;
    const out = r.directions.find((d) => d.direction === 'outbound')!;
    expect(out.derived).toBe(true);
    // The outbound starts where the return ends and ends where the return starts: one round
    expect(out.coordinates[0]).toEqual(ret.coordinates[ret.coordinates.length - 1]);
    expect(out.coordinates[out.coordinates.length - 1][0]).toBeCloseTo(ret.coordinates[0][0], 6);
    // Back along the first 1 km only, westbound
    expect(out.lengthKm).toBeCloseTo(1, 1);
    expect(out.coordinates[out.coordinates.length - 1][0]).toBeLessThan(out.coordinates[0][0]);
  });

  it('a line that never comes back stays one partial return', () => {
    const r = importRoute({ type: 'LineString', coordinates: street }, 'closes_back', BOUNDS);
    expect(r.directions.map((d) => d.direction)).toEqual(['return']);
    expect(r.issues.some((i) => i.level === 'warn')).toBe(true);
  });
});
