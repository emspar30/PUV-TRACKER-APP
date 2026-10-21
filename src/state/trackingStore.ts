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
  // CA1.1: the tracked multicab is near the commuter (the Map tab's red dot)
  near: boolean;
  start: (session: TrackingSession) => void;
  stop: () => void;
  setAlertOn: (on: boolean) => void;
  setNear: (near: boolean) => void;
};

export const useTrackingStore = create<TrackingState>((set) => ({
  vehicleId: null,
  routeCode: null,
  endsAtMs: Number.POSITIVE_INFINITY,
  alertOn: false,
  near: false,
  start: (session) => set({ ...session, near: false }),
  stop: () => set({ vehicleId: null, routeCode: null, endsAtMs: Number.POSITIVE_INFINITY, alertOn: false, near: false }),
  setAlertOn: (alertOn) => set({ alertOn }),
  setNear: (near) => set({ near }),
}));
