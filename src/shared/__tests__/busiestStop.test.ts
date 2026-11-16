import type { StopDisplay } from '../driver/heatmap';
import { busiestStop, type HeatmapRow } from '../driver/heatmapView';

const row = (code: string, display: StopDisplay): HeatmapRow => ({ code, name: `Stop ${code}`, display });
const known = (band: number, exact: number | null): StopDisplay => ({ kind: 'known', band, exact, near: 0 });

describe('busiestStop (the "most waiting" line over the driver list)', () => {
  it('picks the highest count', () => {
    const rows = [row('A', known(1, 3)), row('B', known(3, 12)), row('C', known(2, 7))];
    expect(busiestStop(rows)).toEqual({ code: 'B', name: 'Stop B', band: 3, exact: 12 });
  });

  it('keeps riding order on a tie', () => {
    expect(busiestStop([row('A', known(2, 6)), row('B', known(2, 6))])?.code).toBe('A');
  });

  it('compares counts inside a band', () => {
    expect(busiestStop([row('A', known(3, 10)), row('B', known(3, 14))])?.code).toBe('B');
  });

  it('uses the band at night, when no exact count is shown', () => {
    expect(busiestStop([row('A', known(1, null)), row('B', known(2, null)), row('C', known(2, null))])).toEqual({
      code: 'B',
      name: 'Stop B',
      band: 2,
      exact: null,
    });
  });

  it('counts those checked in near a stop (a stop with only "Near 1" is named)', () => {
    const nearOnly: StopDisplay = { kind: 'known', band: 0, exact: 0, near: 1 };
    expect(busiestStop([row('A', known(0, 0)), row('B', nearOnly)])).toEqual({ code: 'B', name: 'Stop B', band: 1, exact: 1 });
  });

  it('adds the near count to the at-stop count', () => {
    const atAndNear: StopDisplay = { kind: 'known', band: 1, exact: 3, near: 2 };
    expect(busiestStop([row('A', known(1, 4)), row('B', atAndNear)])).toEqual({ code: 'B', name: 'Stop B', band: 2, exact: 5 });
  });

  it('at night, someone near makes the stop at least Light', () => {
    const nearAtNight: StopDisplay = { kind: 'known', band: 0, exact: null, near: 1 };
    expect(busiestStop([row('A', known(0, null)), row('B', nearAtNight)])).toEqual({ code: 'B', name: 'Stop B', band: 1, exact: null });
  });

  it('names nothing when no one is waiting or nothing is known', () => {
    expect(busiestStop([row('A', known(0, 0)), row('B', { kind: 'unknown' })])).toBeNull();
    expect(busiestStop([])).toBeNull();
  });
});
