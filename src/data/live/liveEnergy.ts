// The live Energy wallet (SB2): the SB1 functions own every rule (caps, daily limits, the wallet,
// what tracking costs), so this side only calls them and turns their answers into what the screens
// show. Pure: the network sits behind EnergyPort.

import { nextPassiveRefillMs, type EnergyKind } from '../../shared/backend/rules';
import { ENERGY_HISTORY_LIMIT } from '../../shared/config';
import type { EnergyRepository } from '../repositories/types';

export type EnergyLedgerRow = { kind: EnergyKind; amount: number | string; created_at: string };

// A failed call: the Postgres error code the function raised, and its message
export type PortFailure = { code: string | null; message: string };

export type EnergyPort = {
  signedIn(): Promise<boolean>;
  // energy_passive_refill(); books nothing when it is not due
  refill(): Promise<PortFailure | null>;
  // energy_balance(), app_config (energy_enabled, energy_passive_interval_h), the caller's newest
  // energy_ledger rows and the time of their last passive refill (or the welcome Energy, CA1.1)
  read(limit: number): Promise<{
    balance: number | string;
    enabled: boolean;
    passiveIntervalH: number;
    lastPassiveAt: string | null;
    rows: EnergyLedgerRow[];
  }>;
  // start_tracking(request_key): the session end time, or the error
  startTracking(requestKey: string): Promise<{ endsAt: string } | PortFailure>;
};

// The error codes the SB1 functions raise
const NOT_SIGNED_IN = '28000';
const NOT_ENOUGH = 'P0001';

export function createLiveEnergy(port: EnergyPort, now: () => number = Date.now): EnergyRepository {
  return {
    source: 'live',

    async refresh() {
      if (!(await port.signedIn())) return null;
      // A refill that fails (offline) must not hide the balance the server already holds
      await port.refill();
      const { balance, enabled, passiveIntervalH, lastPassiveAt, rows } = await port.read(ENERGY_HISTORY_LIMIT);
      const wallet = Number(balance);
      const lastPassive = lastPassiveAt === null ? null : Date.parse(lastPassiveAt);
      return {
        balance: wallet,
        enabled,
        nextRefillMs: nextPassiveRefillMs(lastPassive, wallet, now(), passiveIntervalH),
        history: rows.map((row) => ({ kind: row.kind, amount: Number(row.amount), atMs: Date.parse(row.created_at) })),
      };
    },

    async startTracking(requestKey) {
      if (!(await port.signedIn())) return { ok: false, reason: 'sign_in' };
      try {
        const result = await port.startTracking(requestKey);
        if ('endsAt' in result) return { ok: true, endsAtMs: Date.parse(result.endsAt) };
        if (result.code === NOT_SIGNED_IN) return { ok: false, reason: 'sign_in' };
        if (result.code === NOT_ENOUGH) return { ok: false, reason: 'not_enough_energy' };
        return { ok: false, reason: 'error', message: result.message };
      } catch (error) {
        return { ok: false, reason: 'error', message: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
