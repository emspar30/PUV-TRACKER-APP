import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEMO_COMMUTER_STOP_CODE, DEMO_MODE_DEFAULT, FAKE_FIX_DEFAULT_ACCURACY_M, MAP_LABELS_DEFAULT } from '@/shared/config';
import type { ThemeScheme } from '@/theme/tokens';

// App settings kept on this device only. Nothing here is sent anywhere.

const SCHEMES: readonly ThemeScheme[] = ['light', 'dark'];

type StoredSettings = {
  theme: ThemeScheme;
  // AF2: simulated live data, always labelled "Demo"
  demoData: boolean;
  // LB1b: city, barangay and street names on the map
  mapLabels: boolean;
  // Preferences (restyle): the route the Map opens with, seats-only on the Map, and the arrival
  // alert switched on when tracking starts
  defaultRoute: string | null;
  seatFilter: boolean;
  arrivalAlert: boolean;
  // ST2-C3: stop dots on the My Rides map (hidden to move round the map freely)
  rideStops: boolean;
  // Demo settings: stand at a stop instead of using GPS (for the emulator, which has no real fix)
  simulatedLocation: boolean;
  simulatedStop: string;
};

// G0: the development fake location source (development builds only, never stored). Its fixes go
// through consent, the permission and the accuracy gates like real ones, at the "Stand at" stop.
type FakeGps = {
  fakeGps: boolean;
  fakeAccuracyM: number;
  fakeMocked: boolean;
  fakeStale: boolean;
};

type SettingsState = StoredSettings &
  FakeGps & {
  setTheme: (theme: ThemeScheme) => void;
  setDemoData: (on: boolean) => void;
  setMapLabels: (on: boolean) => void;
  setDefaultRoute: (code: string | null) => void;
  setSeatFilter: (on: boolean) => void;
  setArrivalAlert: (on: boolean) => void;
  setRideStops: (on: boolean) => void;
  setSimulatedLocation: (on: boolean) => void;
  setSimulatedStop: (code: string) => void;
  setFakeGps: (on: boolean) => void;
  setFake: (fake: Partial<Omit<FakeGps, 'fakeGps'>>) => void;
  // Demo settings, "Reset app": every setting back to its default
  resetSettings: () => void;
};

// Light is the default (plan v2, Revision 2); Demo data is on by default for the prototype (Emjay, 2026-10-04).
// GPS is the default position since G0; the simulated position is switched on in Demo settings.
const DEFAULTS: StoredSettings & FakeGps = {
  theme: 'light',
  demoData: DEMO_MODE_DEFAULT,
  mapLabels: MAP_LABELS_DEFAULT,
  defaultRoute: null,
  seatFilter: false,
  arrivalAlert: false,
  rideStops: true,
  simulatedLocation: false,
  simulatedStop: DEMO_COMMUTER_STOP_CODE,
  fakeGps: false,
  fakeAccuracyM: FAKE_FIX_DEFAULT_ACCURACY_M,
  fakeMocked: false,
  fakeStale: false,
};

const deviceStorage = createJSONStorage<StoredSettings>(() => ({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
}));

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (theme) => set({ theme }),
      setDemoData: (demoData) => set({ demoData }),
      setMapLabels: (mapLabels) => set({ mapLabels }),
      setDefaultRoute: (defaultRoute) => set({ defaultRoute }),
      setSeatFilter: (seatFilter) => set({ seatFilter }),
      setArrivalAlert: (arrivalAlert) => set({ arrivalAlert }),
      setRideStops: (rideStops) => set({ rideStops }),
      // The simulated stop and the fake GPS source are one or the other
      setSimulatedLocation: (simulatedLocation) => set(simulatedLocation ? { simulatedLocation, fakeGps: false } : { simulatedLocation }),
      setSimulatedStop: (simulatedStop) => set({ simulatedStop }),
      setFakeGps: (fakeGps) => set(fakeGps ? { fakeGps, simulatedLocation: false } : { fakeGps }),
      setFake: (fake) => set(fake),
      resetSettings: () => set(DEFAULTS),
    }),
    {
      name: 'settings',
      storage: deviceStorage,
      partialize: ({ theme, demoData, mapLabels, defaultRoute, seatFilter, arrivalAlert, rideStops, simulatedLocation, simulatedStop }) => ({
        theme,
        demoData,
        mapLabels,
        defaultRoute,
        seatFilter,
        arrivalAlert,
        rideStops,
        simulatedLocation,
        simulatedStop,
      }),
      // Ignore a stored value this version does not know
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<StoredSettings>;
        return {
          ...current,
          theme: stored.theme && SCHEMES.includes(stored.theme) ? stored.theme : current.theme,
          demoData: bool(stored.demoData, current.demoData),
          mapLabels: bool(stored.mapLabels, current.mapLabels),
          defaultRoute: typeof stored.defaultRoute === 'string' || stored.defaultRoute === null ? stored.defaultRoute : current.defaultRoute,
          seatFilter: bool(stored.seatFilter, current.seatFilter),
          arrivalAlert: bool(stored.arrivalAlert, current.arrivalAlert),
          rideStops: bool(stored.rideStops, current.rideStops),
          simulatedLocation: bool(stored.simulatedLocation, current.simulatedLocation),
          simulatedStop: typeof stored.simulatedStop === 'string' ? stored.simulatedStop : current.simulatedStop,
        };
      },
    },
  ),
);
