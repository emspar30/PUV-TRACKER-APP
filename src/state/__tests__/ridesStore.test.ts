// My Rides' recent rides: "I boarded" at check-in keeps the ride; Cancel does not. Newest first,
// at most RECENT_RIDES_MAX.

import { RECENT_RIDES_MAX } from '@/shared/config';

import { useCheckInStore } from '../checkinStore';
import { useRidesStore } from '../ridesStore';

// jest.mock is hoisted above the imports, so the stores load with the mocked storage

const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));

const T0 = Date.UTC(2026, 9, 5, 2, 0, 0);

describe('recent rides', () => {
  beforeEach(() => {
    useRidesStore.setState({ rides: [] });
    useCheckInStore.setState({ checkIn: null });
  });

  it('keeps a ride when the rider taps "I boarded", and none on Cancel', () => {
    useCheckInStore.getState().checkInAt('R4', 'JCA', T0);
    useCheckInStore.getState().boarded(T0 + 1000);
    expect(useRidesStore.getState().rides).toEqual([{ routeCode: 'R4', stationCode: 'JCA', atMs: T0 + 1000, source: 'checkin' }]);
    expect(useCheckInStore.getState().checkIn).toBeNull();

    useCheckInStore.getState().checkInAt('R4', 'RCA', T0);
    useCheckInStore.getState().clear();
    expect(useRidesStore.getState().rides).toHaveLength(1);
  });

  it('lists the newest first and keeps at most the configured number', () => {
    for (let n = 0; n < RECENT_RIDES_MAX + 2; n += 1) {
      useRidesStore.getState().add({ routeCode: 'R4', stationCode: `S${n}`, atMs: T0 + n, source: 'checkin' });
    }
    const rides = useRidesStore.getState().rides;
    expect(rides).toHaveLength(RECENT_RIDES_MAX);
    expect(rides[0].atMs).toBeGreaterThan(rides[1].atMs);
  });
});
