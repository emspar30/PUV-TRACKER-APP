// DR4: the driver phone keeps its setup without a single secret; a damaged saved value means "not set up".

import type { DriverProvisioning } from '@/shared/driver/provisioning';

const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));

type StoreModule = typeof import('../state/driverStore');

function restart(): StoreModule {
  let loaded: StoreModule | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual('../state/driverStore') as StoreModule;
  });
  if (!loaded) throw new Error('store not loaded');
  return loaded;
}

// Made-up test values
const PAYLOAD: DriverProvisioning = {
  v: 1,
  kind: 'driver',
  exp: 2_000_000_000,
  adminPinHash: 'a'.repeat(64),
  adminPinSalt: 'b'.repeat(32),
  deviceId: 'DRV-0001',
  vehicleId: 'R4-TEST-01',
  shortId: 7,
  routeCode: 'R4',
  plate: 'TEST 001',
  beaconSecret: 'c'.repeat(64),
  smsKey: 'd'.repeat(64),
  gatewayNumbers: ['+639170000001'],
};

afterEach(() => mockSaved.clear());

describe('driver store (DR4)', () => {
  it('starts not set up, with the beacon off', () => {
    const { useDriverStore } = restart();
    expect(useDriverStore.getState().setup).toBeNull();
    expect(useDriverStore.getState().beaconEnabled).toBe(false);
  });

  it('keeps the setup across a restart, and never a secret', () => {
    const { useDriverStore, setupFrom } = restart();
    useDriverStore.getState().setSetup(setupFrom(PAYLOAD, 1000));
    useDriverStore.getState().setBeaconEnabled(true);

    const saved = [...mockSaved.values()].join('');
    expect(saved).not.toContain(PAYLOAD.beaconSecret);
    expect(saved).not.toContain(PAYLOAD.smsKey);
    expect(saved).not.toMatch(/beaconSecret|smsKey/);

    const again = restart().useDriverStore.getState();
    expect(again.setup).toEqual({
      deviceId: 'DRV-0001',
      vehicleId: 'R4-TEST-01',
      shortId: 7,
      routeCode: 'R4',
      plate: 'TEST 001',
      gatewayNumbers: ['+639170000001'],
      adminPinHash: 'a'.repeat(64),
      adminPinSalt: 'b'.repeat(32),
      provisionedAtMs: 1000,
    });
    expect(again.beaconEnabled).toBe(true);
  });

  it('treats a damaged saved setup as not set up', () => {
    mockSaved.set('driver', JSON.stringify({ state: { setup: { deviceId: 'DRV-0001', shortId: 'seven' }, beaconEnabled: 'yes' }, version: 0 }));
    const state = restart().useDriverStore.getState();
    expect(state.setup).toBeNull();
    expect(state.beaconEnabled).toBe(false);
  });

  it('forgets everything on reset', () => {
    const { useDriverStore, setupFrom } = restart();
    useDriverStore.getState().setSetup(setupFrom(PAYLOAD, 1000));
    useDriverStore.getState().resetDriver();
    expect(restart().useDriverStore.getState().setup).toBeNull();
  });
});
