// Stands in for the Supabase implementations until SB1: there is no live data, so every screen says
// "No data", never "no vehicles". Pure: no React Native or Expo imports, and no network.

import type { CheckinsRepository, VehiclesRepository } from './types';

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
