import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { DriverProvisioning } from '@/shared/driver/provisioning';

// DR4: what the driver phone keeps about its setup. Never a secret: the beacon secret and the SMS key
// go straight from the setup code into the native module (Android Keystore). The admin PIN is kept
// only as its salted hash.

export type DriverSetup = Pick<
  DriverProvisioning,
  'deviceId' | 'vehicleId' | 'shortId' | 'routeCode' | 'plate' | 'gatewayNumbers' | 'adminPinHash' | 'adminPinSalt'
> & { provisionedAtMs: number };

type Stored = {
  setup: DriverSetup | null;
  beaconEnabled: boolean;
};

type DriverState = Stored & {
  setSetup: (setup: DriverSetup) => void;
  setBeaconEnabled: (on: boolean) => void;
  resetDriver: () => void;
};

const DEFAULTS: Stored = { setup: null, beaconEnabled: false };

const deviceStorage = createJSONStorage<Stored>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

// The secrets must never be stored here, whatever the caller passes
export function setupFrom(payload: DriverProvisioning, nowMs: number): DriverSetup {
  const { deviceId, vehicleId, shortId, routeCode, plate, gatewayNumbers, adminPinHash, adminPinSalt } = payload;
  return { deviceId, vehicleId, shortId, routeCode, plate, gatewayNumbers: [...gatewayNumbers], adminPinHash, adminPinSalt, provisionedAtMs: nowMs };
}

const isString = (value: unknown): value is string => typeof value === 'string';

function validSetup(value: unknown): DriverSetup | null {
  if (typeof value !== 'object' || value === null) return null;
  const s = value as Record<string, unknown>;
  const ok =
    isString(s.deviceId) &&
    isString(s.vehicleId) &&
    typeof s.shortId === 'number' &&
    isString(s.routeCode) &&
    isString(s.plate) &&
    Array.isArray(s.gatewayNumbers) &&
    s.gatewayNumbers.every(isString) &&
    isString(s.adminPinHash) &&
    isString(s.adminPinSalt) &&
    typeof s.provisionedAtMs === 'number';
  return ok ? setupFrom(s as unknown as DriverProvisioning, s.provisionedAtMs as number) : null;
}

export const useDriverStore = create<DriverState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setSetup: (setup) => set({ setup }),
      setBeaconEnabled: (beaconEnabled) => set({ beaconEnabled }),
      resetDriver: () => set(DEFAULTS),
    }),
    {
      name: 'driver',
      storage: deviceStorage,
      partialize: ({ setup, beaconEnabled }) => ({ setup, beaconEnabled }),
      // A damaged or old saved value falls back to "not set up", never to a half setup
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Stored>;
        return {
          ...current,
          setup: validSetup(saved.setup),
          beaconEnabled: typeof saved.beaconEnabled === 'boolean' ? saved.beaconEnabled : current.beaconEnabled,
        };
      },
    },
  ),
);
