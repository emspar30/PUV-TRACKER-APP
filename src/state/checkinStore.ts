import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { parseStoredCheckIn, startCheckIn, type LocalCheckIn } from '@/shared/checkin/localCheckin';

// The user's station check-in, kept on this phone only until the cloud check-in arrives (G1).
// Only the expiry time is stored, so the countdown survives a restart.

type StoredCheckIn = {
  checkIn: LocalCheckIn | null;
};

type CheckInState = StoredCheckIn & {
  checkInAt: (routeCode: string, stationCode: string, nowMs: number) => void;
  // "I boarded" and "Cancel" both end it
  clear: () => void;
};

const deviceStorage = createJSONStorage<StoredCheckIn>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useCheckInStore = create<CheckInState>()(
  persist(
    (set) => ({
      checkIn: null,
      checkInAt: (routeCode, stationCode, nowMs) => set({ checkIn: startCheckIn(routeCode, stationCode, nowMs) }),
      clear: () => set({ checkIn: null }),
    }),
    {
      name: 'checkin',
      storage: deviceStorage,
      partialize: ({ checkIn }) => ({ checkIn }),
      // A stored value that is not a well-formed check-in is dropped
      merge: (persisted, current) => ({
        ...current,
        checkIn: parseStoredCheckIn((persisted as Partial<StoredCheckIn> | undefined)?.checkIn ?? null),
      }),
    },
  ),
);
