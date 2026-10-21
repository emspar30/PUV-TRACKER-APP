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
  // Preferences (restyle): seats-only on the Map, and the arrival alert switched on when tracking
  // starts (CA1.1: the Map's default route was removed; it opens on All routes)
  seatFilter: boolean;
  arrivalAlert: boolean;
  // CA1.1: the route last picked on the Map, so it opens there again; null for All routes
  mapRoute: string | null;
  // ST2-C3: stop dots on the My Rides map (hidden to move round the map freely)
  rideStops: boolean;
  // Demo settings: stand at a stop instead of using GPS (for the emulator, which has no real fix)
  simulatedLocation: boolean;
  simulatedStop: string;
  // CA1.1: a spot pinned on the map instead of a stop; null when a stop is used
  simulatedPoint: { lat: number; lon: number } | null;
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
  setSeatFilter: (on: boolean) => void;
  setArrivalAlert: (on: boolean) => void;
  setMapRoute: (code: string | null) => void;
  setRideStops: (on: boolean) => void;
  setSimulatedLocation: (on: boolean) => void;
  setSimulatedStop: (code: string) => void;
  setSimulatedPoint: (point: { lat: number; lon: number } | null) => void;
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
  seatFilter: false,
  arrivalAlert: false,
  mapRoute: null,
  rideStops: true,
  simulatedLocation: false,
  simulatedStop: DEMO_COMMUTER_STOP_CODE,
  simulatedPoint: null,
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
      setSeatFilter: (seatFilter) => set({ seatFilter }),
      setArrivalAlert: (arrivalAlert) => set({ arrivalAlert }),
      setMapRoute: (mapRoute) => set({ mapRoute }),
      setRideStops: (rideStops) => set({ rideStops }),
      // The simulated stop and the fake GPS source are one or the other
      setSimulatedLocation: (simulatedLocation) => set(simulatedLocation ? { simulatedLocation, fakeGps: false } : { simulatedLocation }),
      // A stop picked replaces a pinned spot
      setSimulatedStop: (simulatedStop) => set({ simulatedStop, simulatedPoint: null }),
      // CA1.1: a pinned spot; it turns simulated location on unless fake GPS is already standing there
      setSimulatedPoint: (simulatedPoint) =>
        set((state) => (state.simulatedLocation || state.fakeGps ? { simulatedPoint } : { simulatedPoint, simulatedLocation: true, fakeGps: false })),
      setFakeGps: (fakeGps) => set(fakeGps ? { fakeGps, simulatedLocation: false } : { fakeGps }),
      setFake: (fake) => set(fake),
      resetSettings: () => set(DEFAULTS),
    }),
    {
      name: 'settings',
      storage: deviceStorage,
      partialize: ({ theme, demoData, mapLabels, seatFilter, arrivalAlert, mapRoute, rideStops, simulatedLocation, simulatedStop, simulatedPoint }) => ({
        theme,
        demoData,
        mapLabels,
        seatFilter,
        arrivalAlert,
        mapRoute,
        rideStops,
        simulatedLocation,
        simulatedStop,
        simulatedPoint,
      }),
      // Ignore a stored value this version does not know
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<StoredSettings>;
        return {
          ...current,
          theme: stored.theme && SCHEMES.includes(stored.theme) ? stored.theme : current.theme,
          demoData: bool(stored.demoData, current.demoData),
          mapLabels: bool(stored.mapLabels, current.mapLabels),
          seatFilter: bool(stored.seatFilter, current.seatFilter),
          arrivalAlert: bool(stored.arrivalAlert, current.arrivalAlert),
          mapRoute: typeof stored.mapRoute === 'string' || stored.mapRoute === null ? stored.mapRoute : current.mapRoute,
          rideStops: bool(stored.rideStops, current.rideStops),
          simulatedLocation: bool(stored.simulatedLocation, current.simulatedLocation),
          simulatedStop: typeof stored.simulatedStop === 'string' ? stored.simulatedStop : current.simulatedStop,
          simulatedPoint:
            stored.simulatedPoint && Number.isFinite(stored.simulatedPoint.lat) && Number.isFinite(stored.simulatedPoint.lon)
              ? { lat: stored.simulatedPoint.lat, lon: stored.simulatedPoint.lon }
              : current.simulatedPoint,
        };
      },
    },
  ),
);
