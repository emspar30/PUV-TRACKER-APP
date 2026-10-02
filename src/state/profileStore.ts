import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CLASSIFICATIONS, type Classification } from '@/shared/config';

// PRD 7.1: the fare classification and the avatar are stored ONLY on this device. The
// classification is used only to apply the discount to the fare estimate; the avatar is shown
// only on the Profile screen. Neither is ever sent to a server: this store imports nothing from
// src/services, and a unit test checks that no service or server code mentions them.

// Number of preset avatars (see src/features/profile/Avatar.tsx)
const AVATAR_CHOICES = 12;

type StoredProfile = {
  classification: Classification;
  avatarId: number;
  // True once the introduction has been finished or skipped
  onboarded: boolean;
};

type ProfileState = StoredProfile & {
  setClassification: (classification: Classification) => void;
  setAvatarId: (avatarId: number) => void;
  setOnboarded: (onboarded: boolean) => void;
};

const DEFAULTS: StoredProfile = { classification: 'regular', avatarId: 0, onboarded: false };

const deviceStorage = createJSONStorage<StoredProfile>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

const validAvatar = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < AVATAR_CHOICES;

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setClassification: (classification) => set({ classification }),
      setAvatarId: (avatarId) => set({ avatarId }),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    {
      name: 'profile',
      storage: deviceStorage,
      partialize: ({ classification, avatarId, onboarded }) => ({ classification, avatarId, onboarded }),
      // Ignore stored values this version does not know, and fill in ones an older version did not save
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<StoredProfile>;
        return {
          ...current,
          classification:
            stored.classification && CLASSIFICATIONS.includes(stored.classification)
              ? stored.classification
              : current.classification,
          avatarId: validAvatar(stored.avatarId) ? stored.avatarId : current.avatarId,
          onboarded: stored.onboarded === true,
        };
      },
    },
  ),
);
