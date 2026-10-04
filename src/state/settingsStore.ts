import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEMO_MODE_DEFAULT } from '@/shared/config';
import type { ThemeScheme } from '@/theme/tokens';

// App settings kept on this device only. Nothing here is sent anywhere.

const SCHEMES: readonly ThemeScheme[] = ['light', 'dark'];

type StoredSettings = {
  theme: ThemeScheme;
  // AF2: simulated live data, always labelled "Demo"
  demoData: boolean;
};

type SettingsState = StoredSettings & {
  setTheme: (theme: ThemeScheme) => void;
  setDemoData: (on: boolean) => void;
};

// Light is the default (plan v2, Revision 2); Demo data is on by default for the prototype (Emjay, 2026-10-04)
const DEFAULTS: StoredSettings = { theme: 'light', demoData: DEMO_MODE_DEFAULT };

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
      setDemoData: (demoData) => set({ demoData }),
    }),
    {
      name: 'settings',
      storage: deviceStorage,
      partialize: ({ theme, demoData }) => ({ theme, demoData }),
      // Ignore a stored value this version does not know
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<StoredSettings>;
        return {
          ...current,
          theme: stored.theme && SCHEMES.includes(stored.theme) ? stored.theme : current.theme,
          demoData: typeof stored.demoData === 'boolean' ? stored.demoData : current.demoData,
        };
      },
    },
  ),
);
