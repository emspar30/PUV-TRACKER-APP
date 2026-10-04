// Screens read live data only through these interfaces (AF2). Each has a demo implementation on the
// phone now (src/data/demo) and a Supabase implementation later (SB1, L1, C1), with no change to the
// screens. Until then the "none" implementation stands in: it has no data, so screens say "No data".
// Pure types: no React Native or Expo imports.

import type { VehicleSnapshot } from '../../shared/telemetry/vehicle';

// Where the data comes from. Every screen that shows "demo" data shows the "Demo" chip.
// 'live' reads the database (L1); 'none' has no data, so screens say "No data".
export type LiveSource = 'demo' | 'live' | 'none';

export type Unsubscribe = () => void;

export type VehiclesRepository = {
  source: LiveSource;
  // Calls the listener at once and whenever the route's vehicles change, until unsubscribed
  subscribe(routeCode: string, listener: (vehicles: readonly VehicleSnapshot[]) => void): Unsubscribe;
};

export type CheckinsRepository = {
  source: LiveSource;
  // People waiting at a station, or null when unknown ("No data"). Demo counts arrive in AF7.
  waitingCount(routeCode: string, stationCode: string): number | null;
};

export type Repositories = {
  vehicles: VehiclesRepository;
  checkins: CheckinsRepository;
};
