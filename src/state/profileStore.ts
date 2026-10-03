import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Classification } from '@/shared/config';

type ProfileState = {
  // null until the rider picks one; the fare is then the regular fare
  classification: Classification | null;
  setClassification: (classification: Classification) => void;
};

// PRD 7.1: the classification is kept only in on-device storage and never sent to the cloud
export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      classification: null,
      setClassification: (classification) => set({ classification }),
    }),
    {
      name: 'profile',
      storage: createJSONStorage(() => Storage),
    },
  ),
);
