import type { StopDisplay } from '../driver/heatmap';
import { busiestStop, type HeatmapRow } from '../driver/heatmapView';

const row = (code: string, display: StopDisplay): HeatmapRow => ({ code, name: `Stop ${code}`, display });
const known = (band: number, exact: number | null): StopDisplay => ({ kind: 'known', band, exact });

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

  it('names nothing when no one is waiting or nothing is known', () => {
    expect(busiestStop([row('A', known(0, 0)), row('B', { kind: 'unknown' })])).toBeNull();
    expect(busiestStop([])).toBeNull();
  });
});
