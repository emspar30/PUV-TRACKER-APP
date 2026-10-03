import { useEffect } from 'react';
import { AppState } from 'react-native';

import { checkLocationPermission, watchLocation } from '@/services/location';
import { useLocationStore } from '@/state/locationStore';

// Keeps the location store in step with the system permission and, while location
// is allowed, with the device position. Foreground only.
export function useLocationTracking(): void {
  const permission = useLocationStore((state) => state.permission);
  const setPermission = useLocationStore((state) => state.setPermission);
  const setFix = useLocationStore((state) => state.setFix);

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
    if (permission !== 'granted') return;

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
  }, [permission, setFix]);
}
