// Screens read live data only through these interfaces (AF2). Each has a demo implementation on the
// phone now (src/data/demo) and a Supabase implementation later (SB1, L1, C1), with no change to the
// screens. Until then the "none" implementation stands in: it has no data, so screens say "No data".
// Pure types: no React Native or Expo imports.

import type { EnergyKind } from '../../shared/backend/rules';
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

// One line of the Energy history; spends are negative
export type EnergyEntry = { kind: EnergyKind; amount: number; atMs: number };

// The wallet as the server sees it. `enabled` false means tracking is free (D1).
// nextRefillMs: when the next passive refill is due (the countdown); null while the wallet is full
export type EnergySnapshot = { balance: number; enabled: boolean; history: readonly EnergyEntry[]; nextRefillMs: number | null };

export type TrackingStart =
  | { ok: true; endsAtMs: number }
  | { ok: false; reason: 'not_enough_energy' | 'sign_in' | 'error'; message?: string };

// SB2: Tracking Energy (PRD 19, D1 and D14). Demo keeps a ledger on the phone; live calls the
// SB1 functions, which own every rule.
export type EnergyRepository = {
  source: LiveSource;
  // Books the passive refill when it is due, then reads the wallet; null when unknown (signed out)
  refresh(): Promise<EnergySnapshot | null>;
  // Starts a tracking session for one PUV; the same request key never pays twice
  startTracking(requestKey: string): Promise<TrackingStart>;
};

export type Repositories = {
  vehicles: VehiclesRepository;
  checkins: CheckinsRepository;
};
