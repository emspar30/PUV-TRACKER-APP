import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThemeScheme } from '@/theme/tokens';

// App settings kept on this device only. Nothing here is sent anywhere.

const SCHEMES: readonly ThemeScheme[] = ['light', 'dark'];

type StoredSettings = {
  theme: ThemeScheme;
};

type SettingsState = StoredSettings & {
  setTheme: (theme: ThemeScheme) => void;
};

// Light is the default (plan v2, Revision 2)
const DEFAULTS: StoredSettings = { theme: 'light' };

const deviceStorage = createJSONStorage<StoredSettings>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'settings',
      storage: deviceStorage,
      partialize: ({ theme }) => ({ theme }),
      // Ignore a stored value this version does not know
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<StoredSettings>;
        return { ...current, theme: stored.theme && SCHEMES.includes(stored.theme) ? stored.theme : current.theme };
      },
    },
  ),
);
