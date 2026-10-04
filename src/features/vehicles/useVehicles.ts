import { useEffect, useState } from 'react';

import type { VehiclesRepository } from '@/data/repositories/types';
import type { VehicleSnapshot } from '@/shared/telemetry/vehicle';

export type VehiclesState = { vehicles: readonly VehicleSnapshot[]; nowMs: number };

const NONE: VehiclesState = { vehicles: [], nowMs: 0 };

// The vehicles on the selected route, refreshed by the repository. None while no route is selected (UX3).
export function useVehicles(repository: VehiclesRepository, routeCode: string | null): VehiclesState {
  // Tagged with its route and source, so a newly picked route never shows the previous one's vehicles
  const [state, setState] = useState<VehiclesState & { routeCode: string | null; repository: VehiclesRepository | null }>({
    ...NONE,
    routeCode: null,
    repository: null,
  });

  useEffect(() => {
    if (!routeCode) return undefined;
    return repository.subscribe(routeCode, (vehicles) => setState({ vehicles, nowMs: Date.now(), routeCode, repository }));
  }, [repository, routeCode]);

  return routeCode && state.routeCode === routeCode && state.repository === repository ? state : NONE;
}
