import { useMemo } from 'react';

import { supabaseVehiclesPort } from '@/services/liveVehicles';
import { isSupabaseConfigured } from '@/services/supabase';
import { DEMO_SEED, DEMO_STRESS_DEV } from '@/shared/config';
import { useSettingsStore } from '@/state/settingsStore';

import { createLiveVehicles } from './liveVehicles';
import { useRouteData } from '../RouteDataProvider';
import { selectRepositories } from '../repositories/select';
import type { Repositories } from '../repositories/types';

// The live data sources for the screens, chosen by the "Demo data" setting (AF2); with it off, the
// database vehicles (L1) when .env holds the Supabase values
export function useRepositories(): Repositories {
  const demo = useSettingsStore((state) => state.demoData);
  const { lines, stops } = useRouteData();
  return useMemo(() => {
    const live = !demo && isSupabaseConfigured() ? createLiveVehicles(supabaseVehiclesPort, lines) : null;
    return selectRepositories({ demo, seed: DEMO_SEED, lines, stops, stress: __DEV__ && DEMO_STRESS_DEV, live });
  }, [demo, lines, stops]);
}
