import { useEffect, useState } from 'react';

import { useLocationPermission } from '@/features/map/useCommuterPosition';
import { askToTurnOnLocation, locationServicesOn } from '@/services/location';
import type { RelayLocation } from '@/shared/relay/gate';
import { selectLocationAllowed, useLocationStore } from '@/state/locationStore';
import { useSettingsStore } from '@/state/settingsStore';

import { SETTINGS_RECHECK_MS } from './nearbyPermission';

export type RelayLocationState = {
  status: RelayLocation;
  // Android stopped asking ("don't ask again"): only Settings can allow it
  blocked: boolean;
  // The consent screen or the permission prompt (Settings when blocked); with the phone's setting
  // off, Android's own "Turn on location" dialog
  turnOn: () => void;
};

// RL2a (Emjay, D9): every relay needs the phone's location, to check that the rider is on the
// multicab's route. A simulated position (Demo & simulation) stands in for it. Otherwise consent and
// the permission (G0), then the phone's location setting, read again every SETTINGS_RECHECK_MS while
// the Relay form is open, so turning it on in the shade takes effect without closing the form.
export function useRelayLocation(): RelayLocationState {
  const simulated = useSettingsStore((state) => state.simulatedLocation);
  const allowed = useLocationStore(selectLocationAllowed);
  const permission = useLocationPermission();
  // Unknown until the first check: counted as on, so the form waits for a fix rather than asking
  const [servicesOn, setServicesOn] = useState<boolean | null>(null);
  const [recheck, setRecheck] = useState(0);
  const watch = !simulated && allowed;

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
    blocked: permission.blocked,
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
