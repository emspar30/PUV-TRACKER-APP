// The demo Energy wallet (SB2, Demo data on): a ledger kept in memory on this phone, run by the same
// rules as the server (src/shared/backend/rules). It sends nothing. The passive refill is booked when
// due, so a fresh demo wallet starts with one Energy. Tracking costs Energy here (ENERGY_ENABLED_DEMO). Pure: no React Native or Expo imports.

import { energyBalance, energyEarn, nextPassiveRefillMs, passiveRefillDue, startTracking, type LedgerRow } from '../../shared/backend/rules';
import { ENERGY_ENABLED_DEMO, ENERGY_HISTORY_LIMIT, TRACKING_SESSION_MIN } from '../../shared/config';
import type { EnergyRepository } from '../repositories/types';

const MS_PER_MIN = 60000;

export function createDemoEnergy(now: () => number = Date.now, enabled = ENERGY_ENABLED_DEMO): EnergyRepository {
  const ledger: LedgerRow[] = [];

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
      const passives = ledger.filter((row) => row.kind === 'passive').map((row) => row.atMs);
      const lastPassive = passives.length > 0 ? Math.max(...passives) : null;
      return { balance, enabled, history, nextRefillMs: nextPassiveRefillMs(lastPassive, balance, atMs) };
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
