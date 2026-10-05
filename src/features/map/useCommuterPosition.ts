import { useEffect, useMemo } from 'react';
import { Linking } from 'react-native';

import { TILESET } from '@/data/map/tileset';
import { useRouteData } from '@/data/RouteDataProvider';
import { askLocationPermission, checkLocationPermission } from '@/services/location';
import { boundsContainPoint } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { useLocationStore } from '@/state/locationStore';
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
  const fix = useLocationStore((state) => state.fix);
  const pin = useLocationStore((state) => state.manualOrigin);

  return useMemo(() => {
    if (simulated) {
      const stop = stops.find((candidate) => candidate.code === simulatedStop);
      if (stop) return { lat: stop.lat, lon: stop.lon, source: 'simulated', stopCode: stop.code };
    }
    if (fix && boundsContainPoint(TILESET.bounds, fix)) return { lat: fix.lat, lon: fix.lon, source: 'gps', stopCode: null };
    if (pin) return { lat: pin.lat, lon: pin.lon, source: 'pin', stopCode: null };
    return null;
  }, [simulated, simulatedStop, stops, fix, pin]);
}

// The location permission as the introduction shows it (G0). The introduction's own text is the
// explanation, so it asks the system directly; Android's "don't ask again" opens Settings instead.
export function useLocationPermission() {
  const permission = useLocationStore((state) => state.permission);
  const canAskAgain = useLocationStore((state) => state.canAskAgain);
  const acceptExplainer = useLocationStore((state) => state.acceptExplainer);
  const requestPermission = useLocationStore((state) => state.requestPermission);
  const setPermission = useLocationStore((state) => state.setPermission);
  // Read the current permission once, without asking
  useEffect(() => {
    if (permission === 'unknown') void checkLocationPermission().then(setPermission);
  }, [permission, setPermission]);
  return {
    granted: permission === 'granted',
    blocked: permission === 'denied' && !canAskAgain,
    request: () => {
      if (permission === 'denied' && !canAskAgain) {
        void Linking.openSettings();
        return;
      }
      acceptExplainer();
      void requestPermission(askLocationPermission);
    },
  };
}
