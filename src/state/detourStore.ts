import { create } from 'zustand';

import { loadActiveDetours } from '@/services/detours';

import { useSettingsStore } from './settingsStore';

// DT1: the ids of the detours active now. Live data only (demo data has none); read when the Map opens
// and every DETOUR_REFRESH_MIN while it is open. Kept as it was when the server cannot be reached.
type DetourState = {
  activeIds: readonly string[];
  set: (activeIds: readonly string[]) => void;
};

export const useDetourStore = create<DetourState>((set) => ({
  activeIds: [],
  set: (activeIds) => set({ activeIds }),
}));

export async function refreshDetours(): Promise<void> {
  if (useSettingsStore.getState().demoData) {
    useDetourStore.getState().set([]);
    return;
  }
  const ids = await loadActiveDetours();
  if (ids) useDetourStore.getState().set(ids);
}
