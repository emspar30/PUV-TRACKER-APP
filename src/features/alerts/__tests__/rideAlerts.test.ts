// Tester note (2026-11-13): ride alerts on the lock screen. The native notification and vibration
// modules are mocked; what they do on a phone is in the tracker's checklist.

import { GET_OFF_BUZZ_MAX_S, RIDE_ALERT_VIBRATION_MS } from '@/shared/config';

const mockGranted = { value: true, canAskAgain: true };
const mockScheduled: unknown[] = [];
const mockRequested: unknown[] = [];

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: mockGranted.value, canAskAgain: mockGranted.canAskAgain })),
  requestPermissionsAsync: jest.fn(async () => {
    mockRequested.push(true);
    return { granted: true };
  }),
  scheduleNotificationAsync: jest.fn(async (request: unknown) => {
    mockScheduled.push(request);
    return 'id';
  }),
  AndroidImportance: { MAX: 5 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  AndroidNotificationPriority: { MAX: 'max' },
}));

// eslint-disable-next-line import/first
import { Vibration } from 'react-native';

// eslint-disable-next-line import/first
import { buzzUntilStopped, notifyRide, prepareRideAlerts, stopBuzz } from '../rideAlerts';

const mockVibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
const mockCancel = jest.spyOn(Vibration, 'cancel').mockImplementation(() => undefined);

beforeEach(() => {
  mockScheduled.length = 0;
  mockRequested.length = 0;
  mockVibrate.mockClear();
  mockCancel.mockClear();
  mockGranted.value = true;
  mockGranted.canAskAgain = true;
});

describe('ride alerts', () => {
  it('posts a notification on the ride alerts channel when allowed', async () => {
    await notifyRide('Get ready to get off', 'SM City Butuan is about 300 m ahead.');
    expect(mockScheduled).toEqual([
      { content: { title: 'Get ready to get off', body: 'SM City Butuan is about 300 m ahead.', priority: 'max' }, trigger: { channelId: 'ride-alerts' } },
    ]);
  });

  it('posts nothing without the permission, and asks only when Android still may', async () => {
    mockGranted.value = false;
    await notifyRide('Your multicab has arrived', null);
    expect(mockScheduled).toEqual([]);
    await prepareRideAlerts();
    expect(mockRequested).toHaveLength(1);
    mockGranted.canAskAgain = false;
    await prepareRideAlerts();
    expect(mockRequested).toHaveLength(1);
  });

  it('the get-off buzz repeats until Got it, and stops by itself after GET_OFF_BUZZ_MAX_S', () => {
    jest.useFakeTimers();
    buzzUntilStopped();
    expect(mockVibrate).toHaveBeenCalledWith([...RIDE_ALERT_VIBRATION_MS], true);
    stopBuzz();
    expect(mockCancel).toHaveBeenCalledTimes(2);
    buzzUntilStopped();
    jest.advanceTimersByTime(GET_OFF_BUZZ_MAX_S * 1000);
    expect(mockCancel).toHaveBeenCalledTimes(4);
    jest.useRealTimers();
  });
});
