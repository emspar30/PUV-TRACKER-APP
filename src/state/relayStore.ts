import { create } from 'zustand';

import type { RelayBroadcast } from '@/shared/relay/broadcast';
import { renewedWatch, startWatch, type RelayWatch } from '@/shared/relay/limits';

// B4: the relay sent with GPS, shared until the rider reaches their destination. Outside the Map
// screen's state so other tabs keep it going. Not saved: a restart of the app ends it.
// RL1: with the watch that decides when it ends by itself (arrival countdown, idle, the 3-hour cap).
type RelayState = {
  session: RelayBroadcast | null;
  watch: RelayWatch;
  start: (session: RelayBroadcast) => void;
  stop: () => void;
  setWatch: (watch: RelayWatch) => void;
  // "Keep sharing": the 3-hour cap starts again
  renew: (nowMs: number) => void;
};

export const useRelayStore = create<RelayState>((set) => ({
  session: null,
  watch: startWatch(0),
  start: (session) => set({ session, watch: startWatch(session.startedMs) }),
  stop: () => set({ session: null, watch: startWatch(0) }),
  setWatch: (watch) => set({ watch }),
  renew: (nowMs) => set((state) => (state.session ? { watch: renewedWatch(state.watch, nowMs) } : {})),
}));
