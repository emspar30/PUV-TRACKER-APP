import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { GatewayProvisioning } from '@/shared/driver/provisioning';

// DR7: what the gateway phone keeps about its setup in JavaScript. Never the access token: it goes
// from the setup code straight into the native module (Android Keystore). The admin PIN is kept only
// as its salted hash.

export type GatewaySetup = Pick<GatewayProvisioning, 'gatewayId' | 'workerUrl' | 'adminPinHash' | 'adminPinSalt'> & { provisionedAtMs: number };

type Stored = { setup: GatewaySetup | null };

type GatewayStoreState = Stored & {
  setSetup: (setup: GatewaySetup) => void;
  resetGateway: () => void;
};

const deviceStorage = createJSONStorage<Stored>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

// The token must never be stored here, whatever the caller passes
export function gatewaySetupFrom(payload: GatewayProvisioning, nowMs: number): GatewaySetup {
  const { gatewayId, workerUrl, adminPinHash, adminPinSalt } = payload;
  return { gatewayId, workerUrl, adminPinHash, adminPinSalt, provisionedAtMs: nowMs };
}

function validSetup(value: unknown): GatewaySetup | null {
  if (typeof value !== 'object' || value === null) return null;
  const s = value as Record<string, unknown>;
  const ok =
    typeof s.gatewayId === 'string' &&
    typeof s.workerUrl === 'string' &&
    typeof s.adminPinHash === 'string' &&
    typeof s.adminPinSalt === 'string' &&
    typeof s.provisionedAtMs === 'number';
  return ok ? gatewaySetupFrom(s as unknown as GatewayProvisioning, s.provisionedAtMs as number) : null;
}

export const useGatewayStore = create<GatewayStoreState>()(
  persist(
    (set) => ({
      setup: null,
      setSetup: (setup) => set({ setup }),
      resetGateway: () => set({ setup: null }),
    }),
    {
      name: 'gateway',
      storage: deviceStorage,
      partialize: ({ setup }) => ({ setup }),
      // A damaged or old saved value falls back to "not set up", never to a half setup
      merge: (persisted, current) => ({ ...current, setup: validSetup((persisted as Partial<Stored> | undefined)?.setup) }),
    },
  ),
);
