// B1: the background relay task only feeds the location store, so the relay's own rules (queue,
// acceptFix, send rule, outbox, RL1) see background positions as they see foreground ones.

import { useBackgroundRelayStore } from '@/state/backgroundRelayStore';
import { useLocationStore } from '@/state/locationStore';

import { BACKGROUND_RELAY_TASK, startBackgroundRelay, stopBackgroundRelay } from '../backgroundLocation';

type Executor = (body: { data: unknown; error: unknown }) => Promise<void>;
type FakeLocation = { started: string[]; granted: boolean };

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-sqlite/kv-store', () => {
  const saved = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (key: string) => saved.get(key) ?? null,
      setItemSync: (key: string, value: string) => saved.set(key, value),
      removeItemSync: (key: string) => saved.delete(key),
    },
  };
});
jest.mock('expo-location', () => {
  const state = { started: [] as string[], granted: false };
  return {
    state,
    Accuracy: { High: 4 },
    getBackgroundPermissionsAsync: async () => ({ granted: state.granted }),
    hasStartedLocationUpdatesAsync: async (name: string) => state.started.includes(name),
    startLocationUpdatesAsync: async (name: string) => {
      state.started.push(name);
    },
    stopLocationUpdatesAsync: async (name: string) => {
      state.started.splice(state.started.indexOf(name), 1);
    },
  };
});

const fake = (jest.requireMock('expo-location') as { state: FakeLocation }).state;
const executorOf = (name: string): Executor => {
  const calls = (jest.requireMock('expo-task-manager') as { defineTask: jest.Mock }).defineTask.mock.calls as [string, Executor][];
  const found = calls.find(([task]) => task === name);
  if (!found) throw new Error(`${name} not defined`);
  return found[1];
};

const location = (lat: number, timestamp: number) => ({
  coords: { latitude: lat, longitude: 125.54, accuracy: 8, heading: 90, speed: 6, altitude: null, altitudeAccuracy: null },
  timestamp,
  mocked: false,
});

describe('B1 background relay', () => {
  it('is defined at start, and the newest position of a batch becomes the fix', async () => {
    const executor = executorOf(BACKGROUND_RELAY_TASK);
    // G0: without consent nothing is kept, in the background too
    await executor({ data: { locations: [location(8.9, 500)] }, error: null });
    expect(useLocationStore.getState().fix).toBeNull();
    useLocationStore.getState().agree(0);
    useLocationStore.getState().setPermission({ permission: 'granted', canAskAgain: true });
    await executor({ data: { locations: [location(8.94, 1000), location(8.95, 2000)] }, error: null });
    expect(useLocationStore.getState().fix).toMatchObject({ lat: 8.95, lon: 125.54, accuracyM: 8, speedMps: 6, timestampMs: 2000, mocked: false });
    expect(useBackgroundRelayStore.getState().lastRunMs).not.toBeNull();
    // An error or an empty batch changes nothing
    await executor({ data: { locations: [] }, error: null });
    await executor({ data: null, error: { code: 1, message: 'x' } });
    expect(useLocationStore.getState().fix?.lat).toBe(8.95);
  });

  it('starts only with background location allowed, once, and stops', async () => {
    fake.granted = false;
    expect(await startBackgroundRelay('R4')).toBe(false);
    expect(fake.started).toEqual([]);
    fake.granted = true;
    expect(await startBackgroundRelay('R4')).toBe(true);
    expect(await startBackgroundRelay('R4')).toBe(true);
    expect(fake.started).toEqual([BACKGROUND_RELAY_TASK]);
    await stopBackgroundRelay();
    expect(fake.started).toEqual([]);
  });
});
