import { create } from 'zustand';

// The tracked multicab (L2, B2), outside the Map screen's own state, so picking another route,
// closing the route card or switching tabs never ends it. Only Stop, or the end of the paid session
// (SB2), does. Not saved: a restart of the app ends tracking.

type TrackingSession = {
  vehicleId: string;
  routeCode: string;
  // When the paid session ends (epoch ms)
  endsAtMs: number;
  alertOn: boolean;
};

type TrackingState = {
  vehicleId: string | null;
  routeCode: string | null;
  endsAtMs: number;
  alertOn: boolean;
  start: (session: TrackingSession) => void;
  stop: () => void;
  setAlertOn: (on: boolean) => void;
};

export const useTrackingStore = create<TrackingState>((set) => ({
  vehicleId: null,
  routeCode: null,
  endsAtMs: Number.POSITIVE_INFINITY,
  alertOn: false,
  start: (session) => set(session),
  stop: () => set({ vehicleId: null, routeCode: null, endsAtMs: Number.POSITIVE_INFINITY, alertOn: false }),
  setAlertOn: (alertOn) => set({ alertOn }),
}));
