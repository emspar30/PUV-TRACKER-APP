import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { RELAY_SAME_VEHICLE_GAP_H } from '@/shared/config';

// RL2b: the multicabs this phone relayed lately, so the Relay form can say "You already relayed
// this multicab." before Send. Only a hint: the server (or the demo) decides.

type Relay = { vehicleId: string; atMs: number };
type StoredRelays = { relays: Relay[] };

type RecentRelaysState = StoredRelays & {
  add: (vehicleId: string, atMs: number) => void;
};

const MS_PER_HOUR = 3600000;

const deviceStorage = createJSONStorage<StoredRelays>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useRecentRelaysStore = create<RecentRelaysState>()(
  persist(
    (set) => ({
      relays: [],
      // Relays older than the gap no longer matter, so they are dropped
      add: (vehicleId, atMs) =>
        set((state) => ({
          relays: [...state.relays.filter((relay) => atMs - relay.atMs < RELAY_SAME_VEHICLE_GAP_H * MS_PER_HOUR), { vehicleId, atMs }],
        })),
    }),
    {
      name: 'recent-relays',
      storage: deviceStorage,
      partialize: ({ relays }) => ({ relays }),
    },
  ),
);
