import { SEED_LINES, SEED_STATIONS } from '../../data/seed/routes';
import type { StopDisplay } from '../driver/heatmap';
import { groupRows } from '../driver/heatmapView';
import { inRouteOrder } from '../relay/broadcast';

// Owner, 2026-10-31 (docs/superpowers/specs/2026-10-31-driver-near-subrows-design.md): the driver's
// list keeps the real stops; a fill stop with someone waiting shows under the nearer of the two real
// stops it lies between in riding order.

const WAITING: StopDisplay = { kind: 'known', band: 1, exact: 2 };
const ZERO: StopDisplay = { kind: 'known', band: 0, exact: 0 };
const UNKNOWN: StopDisplay = { kind: 'unknown' };
const LAT = 8.95;

// A stop on an east-west line: lon in thousandths of a degree east of 125.5 (about 110 m each)
const row = (code: string, east: number, display: StopDisplay = WAITING) => ({ code, name: code, lat: LAT, lon: 125.5 + east / 1000, display });
const shape = (groups: ReturnType<typeof groupRows>) => groups.map((group) => [group.stop.code, group.near.map((near) => near.code)]);

describe('driver list: fill stops as sub-rows (owner, 2026-10-31)', () => {
  it('puts a fill stop under the nearer of the real stops it lies between', () => {
    expect(shape(groupRows([row('AAA', 0), row('FXXX', 7), row('BBB', 10)]))).toEqual([
      ['AAA', []],
      ['BBB', ['FXXX']],
    ]);
  });

  it('gives a tie to the earlier stop', () => {
    // 125.5, 126 and 126.5: exact in binary, so the two distances are equal
    expect(shape(groupRows([row('AAA', 0), row('FXXX', 500), row('BBB', 1000)]))).toEqual([
      ['AAA', ['FXXX']],
      ['BBB', []],
    ]);
  });

  it('puts fill stops before the first real stop under it, and after the last under the last', () => {
    const rows = [row('FAAA', 0), row('FBBB', 2), row('AAA', 4), row('BBB', 8), row('FCCC', 12)];
    expect(shape(groupRows(rows))).toEqual([
      ['AAA', ['FAAA', 'FBBB']],
      ['BBB', ['FCCC']],
    ]);
  });

  it('leaves out a fill stop at 0 or with no count yet', () => {
    const rows = [row('AAA', 0), row('FXXX', 2, ZERO), row('FYYY', 3, UNKNOWN), row('BBB', 10)];
    expect(shape(groupRows(rows))).toEqual([
      ['AAA', []],
      ['BBB', []],
    ]);
  });

  it('keeps a fill stop with a band above 0 and no exact count (night)', () => {
    const rows = [row('AAA', 0), row('FXXX', 2, { kind: 'known', band: 2, exact: null }), row('BBB', 10)];
    expect(shape(groupRows(rows))).toEqual([
      ['AAA', ['FXXX']],
      ['BBB', []],
    ]);
  });

  it('keeps every real stop, in riding order, whatever its count', () => {
    const rows = [row('CCC', 0, UNKNOWN), row('AAA', 3, ZERO), row('BBB', 6)];
    expect(groupRows(rows).map((group) => group.stop)).toEqual(rows);
  });

  it('lists every row with someone waiting exactly once', () => {
    const rows = [row('FAAA', 0), row('AAA', 1, ZERO), row('FBBB', 2), row('FCCC', 3, ZERO), row('BBB', 6), row('FDDD', 7, UNKNOWN), row('FEEE', 9)];
    const waiting = (display: StopDisplay) => display.kind === 'known' && display.band > 0;
    const listed = groupRows(rows).flatMap((group) => [group.stop, ...group.near]);
    expect(listed.filter((listedRow) => waiting(listedRow.display)).map((listedRow) => listedRow.code).sort()).toEqual(
      rows.filter((input) => waiting(input.display)).map((input) => input.code).sort(),
    );
  });

  it('returns fill stops as plain rows when the route has no real stop', () => {
    expect(shape(groupRows([row('FAAA', 0), row('FBBB', 2, ZERO)]))).toEqual([
      ['FAAA', []],
      ['FBBB', []],
    ]);
  });

  it("groups R4's Near Akiammer Laundry Service under Baan Viaduct or FSUU, never Palawan Pawnshop", () => {
    const lines = SEED_LINES.filter((line) => line.routeCode === 'R4').map((line) => line.coordinates);
    const stops = inRouteOrder(lines, SEED_STATIONS.filter((station) => station.routeCodes.includes('R4')));
    const rows = stops.map((stop) => ({ ...stop, display: { kind: 'known', band: 1, exact: 1 } as StopDisplay }));
    const group = groupRows(rows).find((candidate) => candidate.near.some((near) => near.code === 'FPML'));
    expect(['BAA', 'FSU']).toContain(group?.stop.code);
  });
});
