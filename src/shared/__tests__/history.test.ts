import { generalHistory } from '../profile/history';

const T0 = Date.UTC(2026, 9, 6, 2, 0, 0);
const MIN = 60000;

describe('General History (B7)', () => {
  const energy = [
    { kind: 'checkin', amount: 0.3, atMs: T0 },
    { kind: 'passive', amount: 1, atMs: T0 + 10 * MIN },
  ];
  const rides = [{ routeCode: 'R4', stationCode: 'MCA', atMs: T0 + 5 * MIN }];

  it('merges Energy entries and rides, newest first', () => {
    expect(generalHistory(energy, rides, null).map((item) => [item.type, item.atMs])).toEqual([
      ['energy', T0 + 10 * MIN],
      ['ride', T0 + 5 * MIN],
      ['energy', T0],
    ]);
  });

  it('leaves out what came before Clear History', () => {
    expect(generalHistory(energy, rides, T0 + 5 * MIN).map((item) => item.atMs)).toEqual([T0 + 10 * MIN]);
    expect(generalHistory([], [], null)).toEqual([]);
  });
});
