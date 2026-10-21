// The demo Energy wallet (SB2, Demo data on): a ledger kept in memory on this phone, run by the same
// rules as the server (src/shared/backend/rules). It sends nothing. The passive refill is booked when
// due. CA1.1: a fresh demo wallet starts full (the welcome Energy), and check-ins spend from it. Tracking costs Energy here only while ENERGY_ENABLED_DEMO is on (off by default, D1). Pure: no React Native or Expo imports.

import {
  chargeCheckIn,
  energyBalance,
  energyEarn,
  nextPassiveRefillMs,
  passiveRefillDue,
  REFILL_CLOCK_KINDS,
  startTracking,
  type EarnKind,
  type LedgerRow,
} from '../../shared/backend/rules';
import { ENERGY_ENABLED_DEMO, ENERGY_HISTORY_LIMIT, ENERGY_WALLET_CAP, ENERGY_WELCOME, TRACKING_SESSION_MIN } from '../../shared/config';
import type { EnergyRepository } from '../repositories/types';

const MS_PER_MIN = 60000;

// The demo reports earn through `earn`, as post_report does on the server; the demo check-ins pay
// through `chargeCheckIn`, as check_in_routes does
export type DemoEnergy = EnergyRepository & {
  // Books one earning by the shared rules; returns the amount booked (0 when capped or repeated)
  earn(kind: Exclude<EarnKind, 'passive'>, requestKey: string): number;
  // CA1.1: spends a check-in for `routeCount` routes; false when the wallet does not have it
  chargeCheckIn(routeCount: number, requestKey: string): boolean;
};

export function createDemoEnergy(now: () => number = Date.now, enabled = ENERGY_ENABLED_DEMO): DemoEnergy {
  const ledger: LedgerRow[] = [{ kind: 'welcome', amount: Math.min(ENERGY_WELCOME, ENERGY_WALLET_CAP), atMs: now(), requestKey: 'welcome-energy' }];

  const book = (row: LedgerRow) => {
    if (row.amount !== 0) ledger.push(row);
  };

  return {
    source: 'demo',

    async refresh() {
      const atMs = now();
      if (passiveRefillDue(ledger, atMs)) {
        const requestKey = `passive-${atMs}`;
        book({ kind: 'passive', amount: energyEarn(ledger, 'passive', atMs, requestKey), atMs, requestKey });
      }
      const history = ledger
        .slice(-ENERGY_HISTORY_LIMIT)
        .reverse()
        .map(({ kind, amount, atMs: at }) => ({ kind, amount, atMs: at }));
      const balance = energyBalance(ledger);
      const passives = ledger.filter((row) => REFILL_CLOCK_KINDS.includes(row.kind)).map((row) => row.atMs);
      const lastPassive = passives.length > 0 ? Math.max(...passives) : null;
      return { balance, enabled, history, nextRefillMs: nextPassiveRefillMs(lastPassive, balance, atMs) };
    },

    earn(kind, requestKey) {
      const atMs = now();
      const amount = energyEarn(ledger, kind, atMs, requestKey);
      book({ kind, amount, atMs, requestKey });
      return amount;
    },

    chargeCheckIn(routeCount, requestKey) {
      const result = chargeCheckIn(ledger, enabled, routeCount, requestKey);
      if (!result.ok) return false;
      book({ kind: 'checkin', amount: -result.cost, atMs: now(), requestKey });
      return true;
    },

    async startTracking(requestKey) {
      const atMs = now();
      const result = startTracking(ledger, enabled, requestKey);
      if (!result.ok) return { ok: false, reason: result.reason };
      book({ kind: 'tracking', amount: -result.cost, atMs, requestKey });
      return { ok: true, endsAtMs: atMs + TRACKING_SESSION_MIN * MS_PER_MIN };
    },
  };
}
