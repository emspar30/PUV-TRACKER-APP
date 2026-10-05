// Stands in for the Supabase implementations until SB1: there is no live data, so every screen says
// "No data", never "no vehicles". Pure: no React Native or Expo imports, and no network.

import type { CheckinsRepository, EnergyRepository, VehiclesRepository } from './types';

export const noLiveVehicles: VehiclesRepository = {
  source: 'none',
  subscribe: (_routeCode, listener) => {
    listener([]);
    return () => undefined;
  },
};

export const noLiveCheckins: CheckinsRepository = {
  source: 'none',
  waitingCount: () => null,
};

// No backend: no wallet to show, and tracking (of no vehicles) has nothing to pay or end
export const noLiveEnergy: EnergyRepository = {
  source: 'none',
  refresh: async () => null,
  startTracking: async () => ({ ok: true, endsAtMs: Number.POSITIVE_INFINITY }),
};
