// Background alerts (owner, 2026-11-23): which background service runs, if any.

import { backgroundWatch, watchKey } from '../alerts/backgroundWatch';

describe('the background watch', () => {
  it('stands down during a relay, which has its own service', () => {
    expect(backgroundWatch({ relaying: true, trackedRoute: 'R4', checkInStation: 'CSU' })).toBeNull();
  });

  it('tracking comes before a check-in; nothing when neither runs', () => {
    expect(backgroundWatch({ relaying: false, trackedRoute: 'R4', checkInStation: 'CSU' })).toEqual({ kind: 'tracking', routeCode: 'R4' });
    expect(backgroundWatch({ relaying: false, trackedRoute: null, checkInStation: 'CSU' })).toEqual({ kind: 'checkin', stationCode: 'CSU' });
    expect(backgroundWatch({ relaying: false, trackedRoute: null, checkInStation: null })).toBeNull();
  });

  it('restarts the service only when the watch changes', () => {
    expect(watchKey({ kind: 'tracking', routeCode: 'R4' })).toBe('tracking:R4');
    expect(watchKey({ kind: 'checkin', stationCode: 'CSU' })).toBe('checkin:CSU');
    expect(watchKey(null)).toBeNull();
  });
});
