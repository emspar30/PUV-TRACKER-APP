import { create } from 'zustand';

// Whether the Relay form is open (Emjay, 2026-10-26: Relay is the middle button of the bottom bar,
// and the form opens over the tab the commuter is on). The Map opens it too: out of Energy for
// tracking, or the coverage nudge's share button. Kept while the app is open, not saved to disk.
type RelayFormState = {
  open: boolean;
  show: () => void;
  hide: () => void;
};

export const useRelayFormStore = create<RelayFormState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
