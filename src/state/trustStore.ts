import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { loadTrustPoints } from '@/services/profile';
import { isTrusted, trustPoints } from '@/shared/profile/trust';

import { useSettingsStore } from './settingsStore';

// B7: the user's own trust points. Live: profiles.trust_points, which only the server changes
// (read again after a check-in or relay, and when Profile opens). Demo: the times of this phone's
// demo check-ins and relays, counted with the same daily cap.

const DEMO_EVENTS_MAX = 100;

type StoredTrust = {
  demoEventsMs: number[];
};

type TrustState = StoredTrust & {
  // null until read, or signed out
  livePoints: number | null;
  addDemoEvent: (atMs: number) => void;
  setLivePoints: (points: number | null) => void;
};

const deviceStorage = createJSONStorage<StoredTrust>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

export const useTrustStore = create<TrustState>()(
  persist(
    (set, get) => ({
      demoEventsMs: [],
      livePoints: null,
      addDemoEvent: (atMs) => set({ demoEventsMs: [atMs, ...get().demoEventsMs].slice(0, DEMO_EVENTS_MAX) }),
      setLivePoints: (livePoints) => set({ livePoints }),
    }),
    {
      name: 'trust',
      storage: deviceStorage,
      partialize: (state) => ({ demoEventsMs: state.demoEventsMs }),
    },
  ),
);

export async function refreshTrust(): Promise<void> {
  useTrustStore.getState().setLivePoints(await loadTrustPoints());
}

// The user's points on the source the "Demo data" switch picks; null when unknown
export function useTrustPoints(): number | null {
  const demo = useSettingsStore((state) => state.demoData);
  const demoEventsMs = useTrustStore((state) => state.demoEventsMs);
  const livePoints = useTrustStore((state) => state.livePoints);
  return demo ? trustPoints(demoEventsMs) : livePoints;
}

export function useTrusted(): boolean {
  return isTrusted(useTrustPoints());
}
