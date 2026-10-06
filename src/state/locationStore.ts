import Storage from 'expo-sqlite/kv-store';
import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LatLon } from '@/shared/geo/haversine';
import { giveConsent, mayRequestPermission, mayUseLocation, NO_CONSENT, withdrawConsent, type ConsentRecord } from '@/shared/location/consent';

// 'unknown' until the system has been asked what the current permission is
export type LocationPermission = 'unknown' | 'undetermined' | 'granted' | 'denied';

// The plain-language explanation shown before the system prompt (PRD 4.2). It stays 'idle' (not
// shown) until the user first taps "Locate me": it is asked in context, never at app start.
export type ExplainerStatus = 'idle' | 'pending' | 'accepted' | 'dismissed';

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
  // G0: the privacy notice agreed to (kept on the phone); nothing about location works without it
  consent: ConsentRecord;
  permission: LocationPermission;
  canAskAgain: boolean;
  explainer: ExplainerStatus;
  fix: LocationFix | null;
  // Origin pin set by hand when location is not available (PRD 4.2 reduced mode)
  manualOrigin: LatLon | null;

  agree: (atMs: number) => void;
  // Withdrawing drops the fix and stops its use; the Android permission is the user's to revoke
  withdraw: (atMs: number) => void;
  setPermission: (result: PermissionResult) => void;
  acceptExplainer: () => void;
  dismissExplainer: () => void;
  // Shows the explainer (the "Locate me" tap)
  reopenExplainer: () => void;
  // Shows the system prompt through `ask`, but only after consent and the explainer
  requestPermission: (ask: () => Promise<PermissionResult>) => Promise<void>;
  setFix: (fix: LocationFix) => void;
  setManualOrigin: (origin: LatLon | null) => void;
};

export const locationStateCreator: StateCreator<LocationState> = (set, get) => ({
  consent: NO_CONSENT,
  permission: 'unknown',
  canAskAgain: true,
  explainer: 'idle',
  fix: null,
  manualOrigin: null,

  agree: (atMs) => set({ consent: giveConsent(atMs) }),
  // The "location off" notice shows afterwards, with long-press for a start pin (reduced mode)
  withdraw: (atMs) => set({ consent: withdrawConsent(atMs), fix: null, explainer: 'dismissed' }),
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
    if (!mayRequestPermission(get().consent) || get().explainer !== 'accepted') return;
    get().setPermission(await ask());
  },
  setFix: (fix) => {
    if (!mayUseLocation(get().consent, get().permission)) return;
    set({ fix });
  },
  setManualOrigin: (manualOrigin) => set({ manualOrigin }),
});

type StoredLocation = Pick<LocationState, 'consent'>;

const deviceStorage = createJSONStorage<StoredLocation>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

// Only the consent is kept; the permission is read again from Android and a fix is never stored
export const useLocationStore = create<LocationState>()(
  persist(locationStateCreator, { name: 'location', storage: deviceStorage, partialize: ({ consent }) => ({ consent }) }),
);

// Consent and the Android permission together
export function selectLocationAllowed(state: Pick<LocationState, 'consent' | 'permission'>): boolean {
  return mayUseLocation(state.consent, state.permission);
}

// Where a trip starts: the live fix when there is one, otherwise the manual pin
export function selectOrigin(state: Pick<LocationState, 'fix' | 'manualOrigin'>): LatLon | null {
  if (state.fix) return { lat: state.fix.lat, lon: state.fix.lon };
  return state.manualOrigin;
}

// The explainer is shown after a "Locate me" tap until the rider answers it, and never once location is allowed
export function selectShowExplainer(state: Pick<LocationState, 'permission' | 'explainer'>): boolean {
  const notAllowed = state.permission === 'undetermined' || state.permission === 'denied';
  return notAllowed && state.explainer === 'pending';
}
