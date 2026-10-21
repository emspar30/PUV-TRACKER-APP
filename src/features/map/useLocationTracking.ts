import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useRouteData } from '@/data/RouteDataProvider';
import { checkLocationPermission, watchFakeLocation, watchLocation } from '@/services/location';
import { DEMO_COMMUTER_STOP_CODE } from '@/shared/config';
import { selectLocationAllowed, useLocationStore } from '@/state/locationStore';
import { simulatedPosition } from '@/shared/demo/simulatedPosition';
import { useSettingsStore } from '@/state/settingsStore';

// Keeps the location store in step with the system permission and, while location is allowed
// (consent and the permission, G0), with the device position. Foreground only. In development
// builds the fake source can stand in for the GPS.
export function useLocationTracking(): void {
  const allowed = useLocationStore(selectLocationAllowed);
  const setPermission = useLocationStore((state) => state.setPermission);
  const setFix = useLocationStore((state) => state.setFix);
  const { stops } = useRouteData();
  const fakeGps = useSettingsStore((state) => __DEV__ && state.fakeGps);
  const fakeStop = useSettingsStore((state) => state.simulatedStop);
  const fakePinned = useSettingsStore((state) => state.simulatedPoint);
  const fakeAccuracyM = useSettingsStore((state) => state.fakeAccuracyM);
  const fakeMocked = useSettingsStore((state) => state.fakeMocked);
  const fakeStale = useSettingsStore((state) => state.fakeStale);
  // CA1.1: a pinned spot, else the stop
  const fakePoint = simulatedPosition(stops, fakeStop, fakePinned, DEMO_COMMUTER_STOP_CODE);
  const fakeLat = fakePoint?.lat;
  const fakeLon = fakePoint?.lon;

  // Read the permission at start, and again whenever the app returns from the
  // background (the rider may have changed it in Settings)
  useEffect(() => {
    let active = true;
    const refresh = () => {
      checkLocationPermission()
        .then((result) => {
          if (active) setPermission(result);
        })
        .catch(() => {
          // Leave the last known permission in place
        });
    };

    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [setPermission]);

  useEffect(() => {
    if (!allowed) return;
    if (fakeGps && fakeLat !== undefined && fakeLon !== undefined) {
      return watchFakeLocation({ lat: fakeLat, lon: fakeLon }, { accuracyM: fakeAccuracyM, mocked: fakeMocked, stale: fakeStale }, setFix);
    }

    let stop: (() => void) | null = null;
    let cancelled = false;
    watchLocation(setFix)
      .then((remove) => {
        if (cancelled) remove();
        else stop = remove;
      })
      .catch(() => {
        // Location services are off or unavailable: the map stays in reduced mode
      });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [allowed, setFix, fakeGps, fakeLat, fakeLon, fakeAccuracyM, fakeMocked, fakeStale]);
}
