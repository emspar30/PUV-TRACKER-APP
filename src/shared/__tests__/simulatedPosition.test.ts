// Demo & simulation: where the commuter stands while simulated location or fake GPS is on (CA1.1).

import { simulatedPosition } from '../demo/simulatedPosition';
import { FIXTURE_STOPS, pointAt } from './fixtures/routeFixture';

describe('simulated position', () => {
  it('a pinned spot comes first, with no stop', () => {
    expect(simulatedPosition(FIXTURE_STOPS, 'BBB', pointAt(3), 'AAA')).toEqual({ ...pointAt(3), stopCode: null });
  });

  it('else the chosen stop', () => {
    const bbb = FIXTURE_STOPS.find((stop) => stop.code === 'BBB');
    expect(simulatedPosition(FIXTURE_STOPS, 'BBB', null, 'AAA')).toEqual({ lat: bbb?.lat, lon: bbb?.lon, stopCode: 'BBB' });
  });

  it('a stop that is gone falls back to the default; none at all gives nothing', () => {
    expect(simulatedPosition(FIXTURE_STOPS, 'GONE', null, 'AAA')?.stopCode).toBe('AAA');
    expect(simulatedPosition([], 'GONE', null, 'AAA')).toBeNull();
  });
});
