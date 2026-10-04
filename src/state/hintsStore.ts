import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// First-run hints, one short line per tab (AF1). Once dismissed, a hint never comes back.
// Stored on this device only.

export type HintTab = 'live' | 'checkin' | 'ride';

type StoredHints = {
  seen: Record<HintTab, boolean>;
};

type HintsState = StoredHints & {
  dismiss: (tab: HintTab) => void;
};

const NONE_SEEN: Record<HintTab, boolean> = { live: false, checkin: false, ride: false };

const deviceStorage = createJSONStorage<StoredHints>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useHintsStore = create<HintsState>()(
  persist(
    (set, get) => ({
      seen: NONE_SEEN,
      dismiss: (tab) => {
        if (!get().seen[tab]) set({ seen: { ...get().seen, [tab]: true } });
      },
    }),
    {
      name: 'hints',
      storage: deviceStorage,
      partialize: ({ seen }) => ({ seen }),
      // Unknown or missing values count as not seen; a stored "seen" is kept
      merge: (persisted, current) => {
        const stored = (persisted as Partial<StoredHints> | undefined)?.seen ?? {};
        const seen = { ...NONE_SEEN };
        for (const tab of Object.keys(NONE_SEEN) as HintTab[]) seen[tab] = (stored as Partial<Record<HintTab, unknown>>)[tab] === true;
        return { ...current, seen };
      },
    },
  ),
);
