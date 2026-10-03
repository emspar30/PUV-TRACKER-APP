import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  addDestination,
  cleanDestinations,
  removeDestination,
  type AddResult,
  type Destination,
} from '@/shared/profile/destinations';

// PRD 19 (D4): the commuter's frequent destinations, at most FREQUENT_DESTINATIONS_MAX, stored ONLY
// on this device. Home or work places are sensitive: this store imports nothing from src/services,
// and a unit test checks that no service or server code mentions destinations.

type StoredDestinations = {
  destinations: Destination[];
};

type DestinationsState = StoredDestinations & {
  add: (item: Destination) => AddResult;
  remove: (id: string) => void;
  clear: () => void;
};

const deviceStorage = createJSONStorage<StoredDestinations>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useDestinationsStore = create<DestinationsState>()(
  persist(
    (set, get) => ({
      destinations: [],
      add: (item) => {
        const { list, result } = addDestination(get().destinations, item);
        if (result === 'added') set({ destinations: [...list] });
        return result;
      },
      remove: (id) => set({ destinations: [...removeDestination(get().destinations, id)] }),
      clear: () => set({ destinations: [] }),
    }),
    {
      name: 'destinations',
      storage: deviceStorage,
      partialize: ({ destinations }) => ({ destinations }),
      merge: (persisted, current) => ({
        ...current,
        destinations: cleanDestinations((persisted as Partial<StoredDestinations> | undefined)?.destinations),
      }),
    },
  ),
);
