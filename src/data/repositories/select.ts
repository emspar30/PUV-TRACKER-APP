// The one switch (AF2): Demo data on gives the demo implementations; off gives the live database
// vehicles (L1) when Supabase is set up, else the "none" stand-ins. Pure: no React Native or Expo imports.

import type { DirectedLine, RouteStop } from '../../shared/routing/types';
import { createDemoVehicles, type DemoClock } from '../demo/demoVehicles';
import { noLiveCheckins, noLiveVehicles } from './noLiveData';
import type { Repositories, VehiclesRepository } from './types';

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
  if (!demo) return { vehicles: live ?? noLiveVehicles, checkins: noLiveCheckins };
  return {
    vehicles: createDemoVehicles(lines, stops, { seed, stress, clock }),
    // Demo waiting counts arrive in AF7; until then Check-in shows "No data" and no Demo chip
    checkins: noLiveCheckins,
  };
}
