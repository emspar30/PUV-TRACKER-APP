import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { parseStoredCheckIn, startCheckIn, type LocalCheckIn } from '@/shared/checkin/localCheckin';

import { useRidesStore } from './ridesStore';

// The user's station check-in as this phone shows it; crowdStore sends it to the cloud first (C1).
// Only the expiry time is stored, so the countdown survives a restart.

type StoredCheckIn = {
  checkIn: LocalCheckIn | null;
};

type CheckInState = StoredCheckIn & {
  checkInAt: (routes: string | readonly string[], stationCode: string, nowMs: number, expiresAtMs?: number) => void;
  // "I boarded" ends it and keeps the ride in My Rides' recent rides; "Cancel" only ends it
  boarded: (nowMs: number) => void;
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
    (set, get) => ({
      checkIn: null,
      boarded: (nowMs) => {
        const current = get().checkIn;
        if (current) useRidesStore.getState().add({ routeCode: current.routeCode, stationCode: current.stationCode, atMs: nowMs, source: 'checkin' });
        set({ checkIn: null });
      },
      checkInAt: (routes, stationCode, nowMs, expiresAtMs) => set({ checkIn: startCheckIn(routes, stationCode, nowMs, expiresAtMs) }),
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
