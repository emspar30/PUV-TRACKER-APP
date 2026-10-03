import { create, type StateCreator } from 'zustand';

import type { LatLon } from '@/shared/geo/haversine';

// 'unknown' until the system has been asked what the current permission is
export type LocationPermission = 'unknown' | 'undetermined' | 'granted' | 'denied';

// The plain-language explanation shown before the system prompt (PRD 4.2)
export type ExplainerStatus = 'pending' | 'accepted' | 'dismissed';

export type PermissionResult = {
  permission: Exclude<LocationPermission, 'unknown'>;
  canAskAgain: boolean;
};

export type LocationFix = LatLon & {
  accuracyM: number | null;
  headingDeg: number | null;
  speedMps: number | null;
  timestampMs: number;
  mocked: boolean;
};

export type LocationState = {
  permission: LocationPermission;
  canAskAgain: boolean;
  explainer: ExplainerStatus;
  fix: LocationFix | null;
  // Origin pin set by hand when location is not available (PRD 4.2 reduced mode)
  manualOrigin: LatLon | null;

  setPermission: (result: PermissionResult) => void;
  acceptExplainer: () => void;
  dismissExplainer: () => void;
  reopenExplainer: () => void;
  // Shows the system prompt through `ask`, but only after the explainer was accepted
  requestPermission: (ask: () => Promise<PermissionResult>) => Promise<void>;
  setFix: (fix: LocationFix) => void;
  setManualOrigin: (origin: LatLon | null) => void;
};

export const locationStateCreator: StateCreator<LocationState> = (set, get) => ({
  permission: 'unknown',
  canAskAgain: true,
  explainer: 'pending',
  fix: null,
  manualOrigin: null,

  setPermission: ({ permission, canAskAgain }) =>
    set((state) => ({
      permission,
      canAskAgain,
      // A fix is only kept while location is allowed
      fix: permission === 'granted' ? state.fix : null,
    })),
  acceptExplainer: () => set({ explainer: 'accepted' }),
  dismissExplainer: () => set({ explainer: 'dismissed' }),
  reopenExplainer: () => set({ explainer: 'pending' }),
  requestPermission: async (ask) => {
    if (get().explainer !== 'accepted') return;
    get().setPermission(await ask());
  },
  setFix: (fix) => {
    if (get().permission !== 'granted') return;
    set({ fix });
  },
  setManualOrigin: (manualOrigin) => set({ manualOrigin }),
});

export const useLocationStore = create<LocationState>()(locationStateCreator);

// Where a trip starts: the live fix when there is one, otherwise the manual pin
export function selectOrigin(state: Pick<LocationState, 'fix' | 'manualOrigin'>): LatLon | null {
  if (state.fix) return { lat: state.fix.lat, lon: state.fix.lon };
  return state.manualOrigin;
}

// The explainer is shown until the rider answers it, and never once location is allowed
export function selectShowExplainer(state: Pick<LocationState, 'permission' | 'explainer'>): boolean {
  const notAllowed = state.permission === 'undetermined' || state.permission === 'denied';
  return notAllowed && state.explainer === 'pending';
}
