import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { RECENT_RIDES_MAX } from '@/shared/config';

// The commuter's recent rides for My Rides: a ride counts once it is confirmed, by "I boarded" at
// check-in now, and by a passenger relay report later (RP1). Stored on this phone only.

export type RecentRide = {
  routeCode: string;
  // Where the rider boarded
  stationCode: string;
  atMs: number;
  source: 'checkin' | 'report';
};

type StoredRides = {
  rides: RecentRide[];
};

type RidesState = StoredRides & {
  add: (ride: RecentRide) => void;
};

const deviceStorage = createJSONStorage<StoredRides>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useRidesStore = create<RidesState>()(
  persist(
    (set, get) => ({
      rides: [],
      // Newest first, at most RECENT_RIDES_MAX
      add: (ride) => set({ rides: [ride, ...get().rides].slice(0, RECENT_RIDES_MAX) }),
    }),
    {
      name: 'recent-rides',
      storage: deviceStorage,
      partialize: ({ rides }) => ({ rides }),
    },
  ),
);
