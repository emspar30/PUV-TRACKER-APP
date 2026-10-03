import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CLASSIFICATIONS, type Classification } from '@/shared/config';
import {
  assignAvatar,
  GENDERS,
  isAvatarId,
  shuffleAvatar,
  type Gender,
} from '@/shared/profile/avatarPick';

// PRD 7.1 and 19 (D3): the fare classification, the gender answer and the avatar are stored ONLY
// on this device. The classification applies the discount to the fare estimate; the gender answer
// only chooses the set the avatar is drawn from; the avatar is shown only to the user. None of
// them is ever sent to a server: this store imports nothing from src/services, and a unit test
// checks that no service or server code mentions them.

type StoredProfile = {
  classification: Classification;
  // null until answered; 'unstated' is "Prefer not to say"
  gender: Gender | null;
  avatarId: number;
  // True once an avatar has been picked; it is then kept until the user taps Shuffle
  avatarAssigned: boolean;
  // True once the introduction has been finished or skipped
  onboarded: boolean;
};

type ProfileState = StoredProfile & {
  setClassification: (classification: Classification) => void;
  setGender: (gender: Gender) => void;
  setAvatarId: (avatarId: number) => void;
  // Picks an avatar from the set for the gender answer, only if none was picked before
  assignAvatar: () => void;
  shuffleAvatar: () => void;
  setOnboarded: (onboarded: boolean) => void;
};

const DEFAULTS: StoredProfile = {
  classification: 'regular',
  gender: null,
  avatarId: 0,
  avatarAssigned: false,
  onboarded: false,
};

const deviceStorage = createJSONStorage<StoredProfile>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      setClassification: (classification) => set({ classification }),
      // Changing the answer never re-rolls the avatar (decision D3)
      setGender: (gender) => set({ gender }),
      setAvatarId: (avatarId) => set({ avatarId, avatarAssigned: true }),
      assignAvatar: () => {
        const { avatarId, avatarAssigned, gender } = get();
        set(assignAvatar({ avatarId, avatarAssigned }, gender, Math.random));
      },
      shuffleAvatar: () => {
        const { avatarId, gender } = get();
        set({ avatarId: shuffleAvatar(avatarId, gender, Math.random), avatarAssigned: true });
      },
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    {
      name: 'profile',
      storage: deviceStorage,
      partialize: ({ classification, gender, avatarId, avatarAssigned, onboarded }) => ({
        classification,
        gender,
        avatarId,
        avatarAssigned,
        onboarded,
      }),
      // Ignore stored values this version does not know, and fill in ones an older version did not
      // save. A phone from before onboarding v2 saved a hand-picked avatar: it counts as assigned.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<StoredProfile>;
        const storedAvatar = isAvatarId(stored.avatarId);
        return {
          ...current,
          classification:
            stored.classification && CLASSIFICATIONS.includes(stored.classification)
              ? stored.classification
              : current.classification,
          gender: stored.gender && GENDERS.includes(stored.gender) ? stored.gender : null,
          avatarId: storedAvatar ? (stored.avatarId as number) : current.avatarId,
          avatarAssigned: storedAvatar && stored.avatarAssigned !== false,
          onboarded: stored.onboarded === true,
        };
      },
    },
  ),
);
