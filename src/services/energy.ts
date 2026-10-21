import type { EnergyLedgerRow, EnergyPort } from '@/data/live/liveEnergy';
import { ENERGY_PASSIVE_INTERVAL_H } from '@/shared/config';

import { getSupabase, hasSession } from './supabase';

// The Supabase side of the Energy repository (SB2). Row Level Security returns only the caller's
// ledger rows; every write goes through the SB1 functions.
export const supabaseEnergyPort: EnergyPort = {
  signedIn: hasSession,

  async refill() {
    const { error } = await getSupabase().rpc('energy_passive_refill');
    return error ? { code: error.code ?? null, message: error.message } : null;
  },

  async read(limit) {
    const supabase = getSupabase();
    const [balance, config, ledger, passive] = await Promise.all([
      supabase.rpc('energy_balance'),
      supabase.from('app_config').select('energy_enabled, energy_passive_interval_h').single(),
      supabase.from('energy_ledger').select('kind, amount, created_at').order('created_at', { ascending: false }).limit(limit),
      supabase.from('energy_ledger').select('created_at').eq('kind', 'passive').order('created_at', { ascending: false }).limit(1),
    ]);
    const error = balance.error ?? config.error ?? ledger.error ?? passive.error;
    if (error) throw new Error(error.message);
    return {
      balance: balance.data as number | string,
      enabled: Boolean(config.data?.energy_enabled),
      passiveIntervalH: Number(config.data?.energy_passive_interval_h ?? ENERGY_PASSIVE_INTERVAL_H),
      lastPassiveAt: (passive.data?.[0]?.created_at as string | undefined) ?? null,
      rows: ledger.data as EnergyLedgerRow[],
    };
  },

  async startTracking(requestKey) {
    const { data, error } = await getSupabase().rpc('start_tracking', { request_key: requestKey });
    if (error) return { code: error.code ?? null, message: error.message };
    return { endsAt: data as string };
  },
};
