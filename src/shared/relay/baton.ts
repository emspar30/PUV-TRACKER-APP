// BT1 (PRD 8.3): Primary and Secondary relay riders, the "baton". The server decides
// (relay_heartbeat in migration 20261102000001); this is the same rule in TypeScript, for the tests and
// for the rider's eligibility. Only the Primary's positions move a multicab's marker. The Primary is
// kept while it heartbeats; one silent for RELAY_LIVENESS_S is replaced by the best live rider:
// eligible first, then riders who did not change destination, then the most distance left, then who
// joined first. Pure.

import { PRIMARY_MIN_BATTERY_PCT, RELAY_LIVENESS_S } from '../config';

const MS_PER_S = 1000;

export type BatonRole = 'primary' | 'secondary';

export type BatonRider = {
  userId: string;
  leftM: number;
  eligible: boolean;
  movedBack: boolean;
  joinedMs: number;
  lastSeenMs: number;
  role: BatonRole;
};

// May lead: battery at PRIMARY_MIN_BATTERY_PCT or more (unknown counts as enough), not in battery
// saver, location on
export function batonEligible(batteryPct: number | null, lowPower: boolean, locationOn: boolean): boolean {
  return locationOn && !lowPower && (batteryPct === null || batteryPct >= PRIMARY_MIN_BATTERY_PCT);
}

const live = (rider: BatonRider, nowMs: number) => nowMs - rider.lastSeenMs < RELAY_LIVENESS_S * MS_PER_S;

// The order riders take the lead in
export function batonOrder(riders: readonly BatonRider[]): BatonRider[] {
  return [...riders].sort(
    (a, b) =>
      Number(b.eligible) - Number(a.eligible) || Number(a.movedBack) - Number(b.movedBack) || b.leftM - a.leftM || a.joinedMs - b.joinedMs,
  );
}

// The riders with their roles after a heartbeat at nowMs
export function batonRoles(riders: readonly BatonRider[], nowMs: number): BatonRider[] {
  if (riders.some((rider) => rider.role === 'primary' && live(rider, nowMs))) return [...riders];
  const chosen = batonOrder(riders.filter((rider) => live(rider, nowMs)))[0]?.userId ?? null;
  return riders.map((rider) => ({ ...rider, role: rider.userId === chosen ? 'primary' : 'secondary' }));
}
