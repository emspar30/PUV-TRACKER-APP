import { create } from 'zustand';

import type { ReportInput } from '@/data/repositories/types';
import type { RelayBroadcast } from '@/shared/relay/broadcast';
import { renewedWatch, startWatch, type RelayWatch } from '@/shared/relay/limits';
import type { BatonRole } from '@/shared/relay/baton';
import type { RelayQueue } from '@/shared/relay/queue';
import type { WindowReason } from '@/shared/verification/verifyWindow';

// B4: the relay sent with GPS, shared until the rider reaches their destination. Outside the Map
// screen's state so other tabs keep it going. Not saved: a restart of the app ends it.
// RL1: with the watch that decides when it ends by itself (arrival countdown, idle, the 3-hour cap).
// RL2c (D12): before that, the relay waits here, queued, until the multicab moves with the rider in it.

// A relay queued after Send: what will be posted (the multicab and its beacon code are filled in on
// release) and the session it starts
export type QueuedRelay = {
  queue: RelayQueue;
  input: Omit<ReportInput, 'vehicleId' | 'beaconHex' | 'routeCode'>;
  session: Omit<RelayBroadcast, 'post' | 'vehicleId' | 'routeCode' | 'startedMs'>;
  // The multicab picked in the form, and whether the demo or the server takes the relay
  vehicleId: string;
  demo: boolean;
};

// V1a: the running relay's verification window: checking until the multicab has moved on its route
// (useRelayVerification), then verified or not
// onDetour (DT1): the ride follows an active detour line
export type RelayVerification = { status: 'pending' | 'verified' | 'failed'; reasons: readonly WindowReason[]; onDetour?: boolean };

type RelayState = {
  session: RelayBroadcast | null;
  verification: RelayVerification | null;
  setVerification: (verification: RelayVerification) => void;
  // BT1: on the live map, whether this rider leads (primary) or is backup (secondary); null before the
  // first heartbeat answer, and for other relays
  baton: BatonRole | null;
  setBaton: (baton: BatonRole) => void;
  watch: RelayWatch;
  queued: QueuedRelay | null;
  start: (session: RelayBroadcast) => void;
  stop: () => void;
  setWatch: (watch: RelayWatch) => void;
  // "Keep sharing": the 3-hour cap starts again
  renew: (nowMs: number) => void;
  enqueue: (queued: QueuedRelay) => void;
  setQueue: (queue: RelayQueue) => void;
  dequeue: () => void;
};

export const useRelayStore = create<RelayState>((set) => ({
  session: null,
  verification: null,
  setVerification: (verification) => set((state) => (state.session ? { verification } : {})),
  baton: null,
  setBaton: (baton) => set((state) => (state.session ? { baton } : {})),
  watch: startWatch(0),
  queued: null,
  start: (session) => set({ session, watch: startWatch(session.startedMs), queued: null, verification: { status: 'pending', reasons: [] }, baton: null }),
  stop: () => set({ session: null, watch: startWatch(0), verification: null, baton: null }),
  setWatch: (watch) => set({ watch }),
  renew: (nowMs) => set((state) => (state.session ? { watch: renewedWatch(state.watch, nowMs) } : {})),
  enqueue: (queued) => set({ queued }),
  setQueue: (queue) => set((state) => (state.queued ? { queued: { ...state.queued, queue } } : {})),
  dequeue: () => set({ queued: null }),
}));
