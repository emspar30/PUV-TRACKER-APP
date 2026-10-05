import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { loadUsername, saveUsername, type UsernameResult } from '@/services/profile';

// The username picked in the introduction (PRD 19 D7). It is the one profile value that does reach
// the server: set_username stores it, and feed posts show it. Until the user signs in it waits here,
// `synced` false; syncUsername sends it once there is an account. Kept apart from profileStore,
// whose values never leave the phone.

type StoredUsername = {
  username: string | null;
  synced: boolean;
};

type UsernameState = StoredUsername & {
  // Why the last send failed ('taken', 'invalid' or 'error'); not kept on the device
  syncError: Exclude<UsernameResult, { ok: true }>['reason'] | null;
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
      syncError: null,
      setUsername: (username) => set({ username, synced: false, syncError: null }),
      markSynced: () => set({ synced: true, syncError: null }),
    }),
    {
      name: 'username',
      storage: deviceStorage,
      partialize: ({ username, synced }) => ({ username, synced }),
    },
  ),
);

// SB2, for a signed-in user: sends a handle not yet on the server, or, when this phone has none,
// takes the one the account already holds. Safe to call more than once.
export async function syncUsername(): Promise<void> {
  const { username, synced } = useUsernameStore.getState();
  if (username && synced) return;
  if (!username) {
    const fromServer = await loadUsername();
    if (fromServer && !useUsernameStore.getState().username) useUsernameStore.setState({ username: fromServer, synced: true, syncError: null });
    return;
  }
  const result = await saveUsername(username);
  // A newer edit while the call ran is sent by its own call
  if (useUsernameStore.getState().username !== username) return;
  useUsernameStore.setState(result.ok ? { synced: true, syncError: null } : { syncError: result.reason });
}
