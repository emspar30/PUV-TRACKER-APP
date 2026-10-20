import { useEffect, useState } from 'react';

import { fetchRouteVehicles } from '@/services/liveVehicles';

export type VehicleChoice = { id: string; label: string };

const NONE: readonly VehicleChoice[] = [];

// T1: the multicabs of a route to pick from in the relay (unverified until Bluetooth, D5). Empty
// while loading, on an error, or when not enabled (only team accounts on live data pick one).
export function useVehicleChoices(routeCode: string | null, enabled: boolean): readonly VehicleChoice[] {
  const [loaded, setLoaded] = useState<{ routeCode: string; choices: readonly VehicleChoice[] } | null>(null);

  useEffect(() => {
    if (!enabled || !routeCode) return undefined;
    let cancelled = false;
    fetchRouteVehicles(routeCode)
      .then((choices) => {
        if (!cancelled) setLoaded({ routeCode, choices });
      })
      .catch(() => {
        // No picker: the relay goes without a vehicle, as it does for everyone else
      });
    return () => {
      cancelled = true;
    };
  }, [routeCode, enabled]);

  return enabled && loaded && loaded.routeCode === routeCode ? loaded.choices : NONE;
}
