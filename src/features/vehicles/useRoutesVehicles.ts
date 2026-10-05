import { useEffect, useState } from 'react';

import type { VehiclesRepository } from '@/data/repositories/types';
import type { VehicleSnapshot } from '@/shared/telemetry/vehicle';

type State = { key: string; byRoute: Record<string, readonly VehicleSnapshot[]>; nowMs: number };

// The vehicles of several routes at once (My Rides ranks the routes that serve a trip). Empty while
// paused or with no routes; a new set of routes never shows the previous set's vehicles.
export function useRoutesVehicles(repository: VehiclesRepository, routeCodes: readonly string[], paused: boolean) {
  const key = paused ? '' : [...routeCodes].sort().join(',');
  const [state, setState] = useState<State>({ key: '', byRoute: {}, nowMs: 0 });

  useEffect(() => {
    if (!key) return undefined;
    const stops = key.split(',').map((code) =>
      repository.subscribe(code, (vehicles) =>
        setState((current) => ({
          key,
          byRoute: { ...(current.key === key ? current.byRoute : {}), [code]: vehicles },
          nowMs: Date.now(),
        })),
      ),
    );
    return () => stops.forEach((stop) => stop());
  }, [repository, key]);

  const current = state.key === key && key !== '' ? state : null;
  return {
    vehicles: current ? Object.values(current.byRoute).flat() : [],
    nowMs: current?.nowMs ?? 0,
  };
}
