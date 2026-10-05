import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// The username picked in the introduction (PRD 19 D7). It is the one profile value that does reach
// the server: set_username stores it, and feed posts show it. Until the user signs in it waits here,
// `synced` false; the sign-in screen sends it. Kept apart from profileStore, whose values never
// leave the phone.

type StoredUsername = {
  username: string | null;
  synced: boolean;
};

type UsernameState = StoredUsername & {
  setUsername: (username: string | null) => void;
  markSynced: () => void;
};

const deviceStorage = createJSONStorage<StoredUsername>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useUsernameStore = create<UsernameState>()(
  persist(
    (set) => ({
      username: null,
      synced: false,
      setUsername: (username) => set({ username, synced: false }),
      markSynced: () => set({ synced: true }),
    }),
    {
      name: 'username',
      storage: deviceStorage,
      partialize: ({ username, synced }) => ({ username, synced }),
    },
  ),
);
