import { create } from 'zustand';

import type { RelayBroadcast } from '@/shared/relay/broadcast';

// B4: the relay sent with GPS, shared until the rider reaches their destination. Outside the Map
// screen's state so other tabs keep it going. Not saved: a restart of the app ends it.
type RelayState = {
  session: RelayBroadcast | null;
  start: (session: RelayBroadcast) => void;
  stop: () => void;
};

export const useRelayStore = create<RelayState>((set) => ({
  session: null,
  start: (session) => set({ session }),
  stop: () => set({ session: null }),
}));
