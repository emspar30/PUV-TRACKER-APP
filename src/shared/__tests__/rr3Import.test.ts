// RR3: direction from the file name, cycle split, loop report (a block loop is listed, never fails)
// and the Draft removal. Synthetic fixtures only.

import { lineLengthKm } from '../geo/line';
import { findLoops, importLegs, isDraftRoute, parseRouteFileName, pickRouteFiles, splitLine } from '../routing/routeImport';
import { pointAt } from './fixtures/routeFixture';

const BOUNDS: [number, number, number, number] = [125.4, 8.9, 125.7, 9.1];
const at = (km: number, northM = 0): [number, number] => {
  const p = pointAt(km, northM);
  return [p.lon, p.lat];
};
const feature = (coordinates: [number, number][]) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
const file = (name: string) => parseRouteFileName(name)!;

describe('file-name rule', () => {
  it('reads the route number and the kind from the name', () => {
    expect(parseRouteFileName('route_4_outbound.geojson')).toMatchObject({ routeNumber: 4, kind: 'outbound', updated: false });
    expect(parseRouteFileName('route_5_return_updated.geojson')).toMatchObject({ routeNumber: 5, kind: 'return', updated: true });
    expect(parseRouteFileName('route_3_primary.geojson')).toMatchObject({ kind: 'primary' });
    expect(parseRouteFileName('route_4_return_directions.txt')).toBeNull();
    expect(parseRouteFileName('route_4_backwards.geojson')).toBeNull();
  });

  it('an _updated file supersedes the plain one', () => {
    const picked = pickRouteFiles(['route_4_primary.geojson', 'route_4_primary_updated.geojson', 'route_3_primary.geojson', 'notes.txt']);
    expect(picked.map((f) => f.file)).toEqual(['route_3_primary.geojson', 'route_4_primary_updated.geojson']);
  });
});

describe('cycle split', () => {
  // Out east 6 km, 1.1 km north, back west to the start: a cycle with its turnaround near 6 km
  const north = 1100;
  const cycle: [number, number][] = [at(0), at(6), at(6, north), at(0, north)];

  it('splits at the point nearest the turnaround', () => {
    const split = splitLine(cycle, at(6, north / 2));
    expect(split.atKm).toBeCloseTo(6.55, 1);
    expect(lineLengthKm(split.outbound) + lineLengthKm(split.ret)).toBeCloseTo(lineLengthKm(cycle), 3);
  });

  it('a cycle file gives two legs from Emjay\'s files, so the route is no longer a draft', () => {
    const legs = importLegs([{ file: file('route_9_cycle.geojson'), geojson: feature(cycle) }], BOUNDS, { splitAt: at(6, north / 2) });
    expect(legs.issues.filter((i) => i.level === 'fail')).toEqual([]);
    expect(legs.directions.map((d) => [d.direction, d.perDirection])).toEqual([
      ['outbound', true],
      ['return', true],
    ]);
    expect(isDraftRoute(legs.directions)).toBe(false);
    expect(legs.turnaround?.point).toEqual(at(6, north));
  });

  it('a cycle without a confirmed split point fails and proposes the turnaround', () => {
    const legs = importLegs([{ file: file('route_9_cycle.geojson'), geojson: feature(cycle) }], BOUNDS);
    expect(legs.issues.some((i) => i.level === 'fail')).toBe(true);
    expect(legs.turnaround).toBeDefined();
  });
});

describe('per-direction files', () => {
  it('two files give two legs and remove Draft', () => {
    const legs = importLegs(
      [
        { file: file('route_9_outbound.geojson'), geojson: feature([at(0), at(4)]) },
        { file: file('route_9_return.geojson'), geojson: feature([at(4, 100), at(0, 100)]) },
      ],
      BOUNDS,
    );
    expect(legs.directions.map((d) => d.direction)).toEqual(['outbound', 'return']);
    expect(isDraftRoute(legs.directions)).toBe(false);
  });

  it('one file stays a draft; the other leg is reversed only when allowed (R3), never otherwise', () => {
    const one = [{ file: file('route_9_outbound.geojson'), geojson: feature([at(0), at(4)]) }];
    const strict = importLegs(one, BOUNDS);
    expect(strict.directions.map((d) => d.direction)).toEqual(['outbound']);
    expect(isDraftRoute(strict.directions)).toBe(true);
    const viceVersa = importLegs(one, BOUNDS, { reverseMissing: true });
    expect(viceVersa.directions.map((d) => [d.direction, d.derived])).toEqual([
      ['outbound', false],
      ['return', true],
    ]);
    expect(isDraftRoute(viceVersa.directions)).toBe(true);
  });
});

describe('loop report', () => {
  it('a block loop (south, east, north and on) is listed for confirmation and never fails', () => {
    // East 2 km, 300 m south, 250 m east, back north, then on east: like R. Calo, T. Sanchez, M. Calo
    const block: [number, number][] = [at(0), at(2), at(2, -300), at(2.25, -300), at(2.25), at(4)];
    const loops = findLoops(block);
    expect(loops.some((l) => l.kind === 'near_return' && l.confirm)).toBe(true);
    const legs = importLegs([{ file: file('route_9_outbound.geojson'), geojson: feature(block) }], BOUNDS);
    expect(legs.issues.filter((i) => i.level === 'fail')).toEqual([]);
  });

  it('a line that runs over itself is reported as an overlap', () => {
    const back: [number, number][] = [at(0), at(2), at(2, 500), at(1, 500), at(1, 0), at(3)];
    expect(findLoops(back).some((l) => l.kind === 'overlap')).toBe(true);
  });

  it('a straight line has no loops', () => {
    expect(findLoops([at(0), at(5)])).toEqual([]);
  });
});
