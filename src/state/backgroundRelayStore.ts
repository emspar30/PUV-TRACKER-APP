import { create } from 'zustand';

// B1: the background location of a relay, as the app sees it. Kept while the app is open, not saved.
type BackgroundRelayState = {
  // The foreground service runs (Android's "Sharing your ride" notification)
  running: boolean;
  // When the background task last delivered a position, for the health check
  lastRunMs: number | null;
  // The rider was asked for background location this app session
  asked: boolean;
  // The "Your phone stopped Tunton" guide was shown this app session
  guideShown: boolean;
  set: (patch: Partial<Omit<BackgroundRelayState, 'set'>>) => void;
};

export const useBackgroundRelayStore = create<BackgroundRelayState>((set) => ({
  running: false,
  lastRunMs: null,
  asked: false,
  guideShown: false,
  set: (patch) => set(patch),
}));
