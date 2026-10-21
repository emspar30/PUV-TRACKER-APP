import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Linking } from 'react-native';

import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { askLocationPermission, checkLocationPermission } from '@/services/location';
import type { Place } from '@/shared/checkin/geofence';
import { DEMO_COMMUTER_STOP_CODE } from '@/shared/config';
import { boundsContainPoint } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { fixAgeS } from '@/shared/location/accuracyGate';
import { mayRequestPermission } from '@/shared/location/consent';
import { selectLocationAllowed, useLocationStore, type LocationFix } from '@/state/locationStore';
import { simulatedPosition } from '@/shared/demo/simulatedPosition';
import { useSettingsStore } from '@/state/settingsStore';

export type CommuterPosition = LatLon & {
  // gps: the phone's fix (G0); simulated: a stop chosen in Demo settings; pin: a long-press on the map
  source: 'gps' | 'simulated' | 'pin';
  // The stop code when simulated
  stopCode: string | null;
};

// Where the commuter is, for tracking ETAs and My Rides' starting point (G0). The simulated stop
// wins when switched on (the emulator has no real fix); then the GPS fix inside the map area; then
// the pin set by long-press while location is off. Null when none is known.
export function useCommuterPosition(): CommuterPosition | null {
  const { stops } = useRouteData();
  const simulated = useSettingsStore((state) => state.simulatedLocation);
  const simulatedStop = useSettingsStore((state) => state.simulatedStop);
  const simulatedPoint = useSettingsStore((state) => state.simulatedPoint);
  const fix = useLocationStore((state) => state.fix);
  const pin = useLocationStore((state) => state.manualOrigin);

  return useMemo(() => {
    if (simulated) {
      // CA1.1: a pinned spot, else the stop (one from older route data falls back to the default)
      const at = simulatedPosition(stops, simulatedStop, simulatedPoint, DEMO_COMMUTER_STOP_CODE);
      if (at) return { lat: at.lat, lon: at.lon, source: 'simulated', stopCode: at.stopCode };
    }
    if (fix && boundsContainPoint(TILESET.bounds, fix)) return { lat: fix.lat, lon: fix.lon, source: 'gps', stopCode: null };
    if (pin) return { lat: pin.lat, lon: pin.lon, source: 'pin', stopCode: null };
    return null;
  }, [simulated, simulatedStop, simulatedPoint, stops, fix, pin]);
}

// What the check-in and report gates see (G0): a GPS position carries the fix's accuracy, mock flag
// and age at `nowMs`; a simulated stop and a pin carry none
export function placeOf(commuter: CommuterPosition | null, fix: LocationFix | null, nowMs: number): Place | null {
  if (!commuter) return null;
  if (commuter.source !== 'gps' || !fix) return { ...commuter, accuracyM: null };
  return { ...commuter, accuracyM: fix.accuracyM, mocked: fix.mocked, ageS: fixAgeS(fix.timestampMs, nowMs) };
}

// The location permission as the introduction shows it (G0). The introduction's own text is the
// explanation, so after the consent screen it asks the system directly; Android's "don't ask
// again" opens Settings instead.
export function useLocationPermission() {
  const permission = useLocationStore((state) => state.permission);
  const consented = useLocationStore((state) => mayRequestPermission(state.consent));
  const allowed = useLocationStore(selectLocationAllowed);
  const canAskAgain = useLocationStore((state) => state.canAskAgain);
  const acceptExplainer = useLocationStore((state) => state.acceptExplainer);
  const requestPermission = useLocationStore((state) => state.requestPermission);
  const setPermission = useLocationStore((state) => state.setPermission);
  // Read the current permission once, without asking
  useEffect(() => {
    if (permission === 'unknown') void checkLocationPermission().then(setPermission);
  }, [permission, setPermission]);
  return {
    granted: allowed,
    blocked: permission === 'denied' && !canAskAgain,
    request: () => {
      if (!consented) {
        router.push({ pathname: '/consent', params: { next: 'ask' } });
        return;
      }
      if (permission === 'denied' && !canAskAgain) {
        void Linking.openSettings();
        return;
      }
      acceptExplainer();
      void requestPermission(askLocationPermission);
    },
  };
}
