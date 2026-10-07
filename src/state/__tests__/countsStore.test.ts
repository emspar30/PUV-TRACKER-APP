// F5: the badge counts are kept on the phone, count a planned trip once per From and To, and
// announce a badge once when it is earned.

import { badgeCountsOf, useCountsStore } from '../countsStore';
import { useToastStore } from '../toastStore';

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined },
}));

beforeEach(() => {
  useCountsStore.setState(useCountsStore.getInitialState(), true);
  useToastStore.setState({ current: null });
});

describe('badge counts (F5)', () => {
  it('counts a planned trip once per From and To', () => {
    const { addTrip } = useCountsStore.getState();
    addTrip('a>b');
    addTrip('a>b');
    expect(useCountsStore.getState().tripsPlanned).toBe(1);
    addTrip('a>c');
    expect(useCountsStore.getState().tripsPlanned).toBe(2);
  });

  it('counts relays, and those with GPS separately', () => {
    useCountsStore.getState().addReport(true);
    useCountsStore.getState().addReport(false);
    expect(useCountsStore.getState()).toMatchObject({ reports: 2, gpsReports: 1 });
  });

  it('shows a notice when a badge is earned, not on later counts', () => {
    useCountsStore.getState().addCheckIn();
    expect(useToastStore.getState().current?.title).toBe('Badge earned: First check-in');
    useToastStore.setState({ current: null });
    useCountsStore.getState().addCheckIn();
    expect(useToastStore.getState().current).toBeNull();
  });
});

describe('badge counts with the ride history (F5)', () => {
  it('never fall below the check-ins already in the ride history', () => {
    const rides = Array.from({ length: 5 }, (_v, i) => ({ routeCode: 'R4', stationCode: 'MCA', atMs: i, source: 'checkin' as const }));
    expect(badgeCountsOf({ tripsPlanned: 0, checkIns: 2, reports: 0, gpsReports: 0 }, rides).checkIns).toBe(5);
    expect(badgeCountsOf({ tripsPlanned: 0, checkIns: 7, reports: 0, gpsReports: 0 }, rides).checkIns).toBe(7);
  });
});
