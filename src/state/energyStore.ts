import { AppState } from 'react-native';
import { create } from 'zustand';

import { createDemoEnergy } from '@/data/demo/demoEnergy';
import { createLiveEnergy } from '@/data/live/liveEnergy';
import { selectEnergy } from '@/data/repositories/select';
import type { EnergySnapshot, LiveSource, TrackingStart } from '@/data/repositories/types';
import { supabaseEnergyPort } from '@/services/energy';
import { isSupabaseConfigured } from '@/services/supabase';
import { newRequestKey } from '@/shared/backend/rules';

import { useSessionStore } from './sessionStore';
import { useSettingsStore } from './settingsStore';

// Tracking Energy (SB2) as the screens show it: the wallet of the source the "Demo data" switch
// picks. `snapshot` is null while unknown (signed out, no backend, or not loaded yet).

type EnergyState = {
  source: LiveSource;
  snapshot: EnergySnapshot | null;
  error: string | null;
};

export const useEnergyStore = create<EnergyState>(() => ({ source: 'none', snapshot: null, error: null }));

const demoEnergy = createDemoEnergy();
const liveEnergy = isSupabaseConfigured() ? createLiveEnergy(supabaseEnergyPort) : null;

const currentEnergy = () => selectEnergy(useSettingsStore.getState().demoData, demoEnergy, liveEnergy);

// Only the newest refresh may write, so a slow answer from the other source never wins
let generation = 0;

// Books the passive refill when due and reads the wallet again. Never throws.
export async function refreshEnergy(): Promise<void> {
  const repository = currentEnergy();
  generation += 1;
  const mine = generation;
  try {
    const snapshot = await repository.refresh();
    if (mine === generation) useEnergyStore.setState({ source: repository.source, snapshot, error: null });
  } catch (error) {
    if (mine !== generation) return;
    const message = error instanceof Error ? error.message : String(error);
    // Keep the last wallet of the same source on a network error; never show another source's
    useEnergyStore.setState((state) => ({
      source: repository.source,
      snapshot: state.source === repository.source ? state.snapshot : null,
      error: message,
    }));
  }
}

// Pays for one tracking session (free while Energy is off), then refreshes the wallet
export async function startTrackingSession(): Promise<TrackingStart> {
  const result = await currentEnergy().startTracking(newRequestKey('track', Date.now(), Math.random()));
  void refreshEnergy();
  return result;
}

// The countdown reached the refill: refresh once for that due time (not once per screen showing it,
// and not again when the server booked nothing, e.g. the daily refill limit)
let refreshedFor: number | null = null;
export function refreshWhenDue(nextRefillMs: number): void {
  if (refreshedFor === nextRefillMs) return;
  refreshedFor = nextRefillMs;
  void refreshEnergy();
}

let started = false;

// Refreshes on start, on sign-in or sign-out, on the Demo switch and when the app comes back to the
// front (the server books the passive refill then). Call once when the app starts.
export function startEnergySync(): void {
  if (started) return;
  started = true;
  void refreshEnergy();
  useSessionStore.subscribe((state, previous) => {
    if (state.status !== previous.status) void refreshEnergy();
  });
  useSettingsStore.subscribe((state, previous) => {
    if (state.demoData !== previous.demoData) void refreshEnergy();
  });
  AppState.addEventListener('change', (status) => {
    if (status === 'active') void refreshEnergy();
  });
}
