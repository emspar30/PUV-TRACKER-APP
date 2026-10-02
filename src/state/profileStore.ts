import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CLASSIFICATIONS, type Classification } from '@/shared/config';

// PRD 7.1: the fare classification is self-declared, stored ONLY on this device, and used only
// to apply the discount to the fare estimate. It must never be sent to a server: this store
// imports nothing from src/services, and a unit test checks that no service code mentions it.

type ProfileState = {
  classification: Classification;
  setClassification: (classification: Classification) => void;
};

const DEFAULT_CLASSIFICATION: Classification = 'regular';

const deviceStorage = createJSONStorage<Pick<ProfileState, 'classification'>>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      classification: DEFAULT_CLASSIFICATION,
      setClassification: (classification) => set({ classification }),
    }),
    {
      name: 'profile',
      storage: deviceStorage,
      partialize: (state) => ({ classification: state.classification }),
      // Ignore a stored value this version does not know
      merge: (persisted, current) => {
        const stored = (persisted as Partial<ProfileState> | undefined)?.classification;
        return { ...current, classification: stored && CLASSIFICATIONS.includes(stored) ? stored : current.classification };
      },
    },
  ),
);
