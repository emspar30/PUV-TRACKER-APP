import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// B7: when the user last tapped Clear History on Profile. Kept on this phone only; the history
// before it is hidden, nothing on the server changes.

type StoredHistory = {
  clearedAtMs: number | null;
};

type HistoryState = StoredHistory & {
  clear: (atMs: number) => void;
};

const deviceStorage = createJSONStorage<StoredHistory>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      clearedAtMs: null,
      clear: (clearedAtMs) => set({ clearedAtMs }),
    }),
    { name: 'history', storage: deviceStorage },
  ),
);
