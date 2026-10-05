// The one switch (AF2): Demo data on gives the demo implementations; off gives the live database
// vehicles (L1) when Supabase is set up, else the "none" stand-ins. Pure: no React Native or Expo imports.

import type { DirectedLine, RouteStop } from '../../shared/routing/types';
import { createDemoVehicles, type DemoClock } from '../demo/demoVehicles';
import { noLiveCheckins, noLiveEnergy, noLiveReports, noLiveVehicles } from './noLiveData';
import type { CheckinsRepository, EnergyRepository, ReportsRepository, Repositories, VehiclesRepository } from './types';

export type RepositoryInput = {
  demo: boolean;
  seed: number;
  lines: readonly DirectedLine[];
  stops: readonly RouteStop[];
  stress?: boolean;
  clock?: DemoClock;
  // The live vehicles repository, or null when Supabase is not set up
  live?: VehiclesRepository | null;
};

export function selectRepositories({ demo, seed, lines, stops, stress, clock, live }: RepositoryInput): Repositories {
  if (!demo) return { vehicles: live ?? noLiveVehicles };
  return { vehicles: createDemoVehicles(lines, stops, { seed, stress, clock }) };
}

// SB2: the Energy wallet follows the same switch. It is chosen once per switch position (not per
// screen), so the top bar, Profile and the Map share one demo ledger.
export function selectEnergy(demo: boolean, demoEnergy: EnergyRepository, live: EnergyRepository | null): EnergyRepository {
  if (demo) return demoEnergy;
  return live ?? noLiveEnergy;
}

// C1 and RP1 follow the same switch, with the same module-level instances as the wallet
export type CrowdRepositories = { checkins: CheckinsRepository; reports: ReportsRepository };

export function selectCrowd(demo: boolean, demoCrowd: CrowdRepositories, live: CrowdRepositories | null): CrowdRepositories {
  if (demo) return demoCrowd;
  return live ?? { checkins: noLiveCheckins, reports: noLiveReports };
}
