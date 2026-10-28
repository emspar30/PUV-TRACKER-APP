import { useEffect, useState } from 'react';

import { useLocationPermission } from '@/features/map/useCommuterPosition';
import { SETTINGS_RECHECK_MS } from '@/features/report/nearbyPermission';
import { askToTurnOnLocation, locationServicesOn } from '@/services/location';
import type { RelayLocation } from '@/shared/relay/gate';
import { selectLocationAllowed, useLocationStore } from '@/state/locationStore';
import { useSettingsStore } from '@/state/settingsStore';

export type TrackLocation = {
  // 'on' with a simulated position (Demo & simulation), else the permission, then the phone's
  // location setting
  status: RelayLocation;
  // The consent screen or the permission prompt (Settings when blocked); with the phone's setting
  // off, Android's own "Turn on location" dialog
  turnOn: () => void;
};

// Emjay, 2026-10-26: tracking works out when the multicab reaches the commuter, so it needs the
// phone's location (or a simulated one). Without it the Track button is greyed out, with a button
// under it that turns location on. The phone's setting is read again every SETTINGS_RECHECK_MS while
// watched (the Map tab in front), so turning it on in the shade enables Track at once.
export function useTrackLocation(watched: boolean): TrackLocation {
  const simulated = useSettingsStore((state) => state.simulatedLocation);
  const allowed = useLocationStore(selectLocationAllowed);
  const permission = useLocationPermission();
  // Unknown until the first check: counted as on, so Track does not flicker grey on opening
  const [servicesOn, setServicesOn] = useState<boolean | null>(null);
  const [recheck, setRecheck] = useState(0);
  const watch = watched && !simulated && allowed;

  useEffect(() => {
    if (!watch) return undefined;
    const timer = setInterval(() => setRecheck((count) => count + 1), SETTINGS_RECHECK_MS);
    return () => clearInterval(timer);
  }, [watch]);

  useEffect(() => {
    if (!watch) return undefined;
    let current = true;
    void locationServicesOn().then((on) => {
      if (current) setServicesOn(on);
    });
    return () => {
      current = false;
    };
  }, [watch, recheck]);

  const status: RelayLocation = simulated ? 'on' : !allowed ? 'needs_permission' : servicesOn === false ? 'off' : 'on';
  return {
    status,
    turnOn: () => {
      if (status === 'needs_permission') {
        permission.request();
        return;
      }
      void askToTurnOnLocation().then((on) => {
        if (on) setServicesOn(true);
      });
    },
  };
}
