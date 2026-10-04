import { useMemo } from 'react';

import { DEMO_SEED, DEMO_STRESS_DEV } from '@/shared/config';
import { useSettingsStore } from '@/state/settingsStore';

import { useRouteData } from '../RouteDataProvider';
import { selectRepositories } from './select';
import type { Repositories } from './types';

// The live data sources for the screens, chosen by the "Demo data" setting (AF2)
export function useRepositories(): Repositories {
  const demo = useSettingsStore((state) => state.demoData);
  const { lines, stops } = useRouteData();
  return useMemo(
    () => selectRepositories({ demo, seed: DEMO_SEED, lines, stops, stress: __DEV__ && DEMO_STRESS_DEV }),
    [demo, lines, stops],
  );
}
