// The vehicle card's next stop: the closest stop ahead on the vehicle's own line. Fixtures only.

import { nextStopOf } from '../telemetry/nextStop';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN, FIXTURE_STOPS, pointAt } from './fixtures/routeFixture';

const LINES = [FIXTURE_OUTBOUND, FIXTURE_RETURN];

describe('next stop', () => {
  it('past the last stop of a leg, is the first stop of the leg it drives on to (B2)', () => {
    // The return starts at the east end, so its first stop is CCC at 6 km
    expect(nextStopOf({ ...pointAt(7), lineId: 'T1-OUT' }, LINES, FIXTURE_STOPS)?.code).toBe('CCC');
  });

  it('is the closest stop ahead in the direction of travel', () => {
    expect(nextStopOf({ ...pointAt(1), lineId: 'T1-OUT' }, LINES, FIXTURE_STOPS)?.code).toBe('BBB');
    expect(nextStopOf({ ...pointAt(3), lineId: 'T1-RET' }, LINES, FIXTURE_STOPS)?.code).toBe('BBB');
  });

  it('skips stops too far from the line, and is null past the last stop of a lone leg or on an unknown line', () => {
    expect(nextStopOf({ ...pointAt(3), lineId: 'T1-OUT' }, LINES, FIXTURE_STOPS)?.code).toBe('CCC');
    expect(nextStopOf({ ...pointAt(7), lineId: 'T1-OUT' }, [FIXTURE_OUTBOUND], FIXTURE_STOPS)).toBeNull();
    expect(nextStopOf({ ...pointAt(1), lineId: 'NOPE' }, LINES, FIXTURE_STOPS)).toBeNull();
  });
});
