// Stands in for the Supabase implementations until SB1: there is no live data, so every screen says
// "No data", never "no vehicles". Pure: no React Native or Expo imports, and no network.

import type { CheckinsRepository, EnergyRepository, ReportsRepository, VehiclesRepository } from './types';

export const noLiveVehicles: VehiclesRepository = {
  source: 'none',
  subscribe: (_routeCode, listener) => {
    listener([]);
    return () => undefined;
  },
};

// No backend: no counts, and nowhere to check in or report
export const noLiveCheckins: CheckinsRepository = {
  source: 'none',
  waitingCounts: async () => null,
  checkIn: async () => ({ ok: false, reason: 'error' }),
  end: async () => undefined,
};

export const noLiveReports: ReportsRepository = {
  source: 'none',
  post: async () => ({ ok: false, reason: 'error' }),
  recent: async () => null,
  flag: async () => ({ ok: false, reason: 'error' }),
};

// No backend: no wallet to show, and tracking (of no vehicles) has nothing to pay or end
export const noLiveEnergy: EnergyRepository = {
  source: 'none',
  refresh: async () => null,
  startTracking: async () => ({ ok: true, endsAtMs: Number.POSITIVE_INFINITY }),
};
