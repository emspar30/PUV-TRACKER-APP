import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { LANDMARKS } from '@/data/seed/landmarks.placeholder';
import {
  addDestination,
  cleanDestinations,
  refreshSavedLandmarks,
  removeDestination,
  type AddResult,
  type Destination,
} from '@/shared/profile/destinations';
import { placeIdOf } from '@/shared/routing/suggest';
import { strings } from '@/strings';

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

// Landmark ids are the stop code with this prefix (landmarks.placeholder.ts)
const LANDMARK_ID_PREFIX = 'stop-';

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
      // EQ-16: places saved as stops of older route data move to a current stop or a map point
      merge: (persisted, current) => ({
        ...current,
        destinations: refreshSavedLandmarks(
          cleanDestinations((persisted as Partial<StoredDestinations> | undefined)?.destinations),
          LANDMARKS,
          (id) => id.startsWith(LANDMARK_ID_PREFIX),
          placeIdOf,
          strings.ride.near,
        ),
      }),
    },
  ),
);
