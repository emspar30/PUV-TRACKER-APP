import { useEffect, useState } from 'react';

import type { NightPassage, VehiclesRepository } from '@/data/repositories/types';
import { NIGHT_STOPS_REFRESH_S } from '@/shared/config';

const MS_PER_S = 1000;

// NM1: the picked route's night stop view, read now and every NIGHT_STOPS_REFRESH_S while `routeCode`
// is set (the caller passes null by day). null until the first answer, or when it is unknown.
export function useNightPassages(repository: VehiclesRepository, routeCode: string | null): { passages: readonly NightPassage[]; nowMs: number } | null {
  const [state, setState] = useState<{ key: string; passages: readonly NightPassage[]; nowMs: number } | null>(null);

  useEffect(() => {
    if (!routeCode || !repository.nightPassages) return undefined;
    let current = true;
    const key = `${repository.source}:${routeCode}`;
    const load = () => {
      void repository.nightPassages?.(routeCode).then((passages) => {
        if (current && passages) setState({ key, passages, nowMs: Date.now() });
      });
    };
    load();
    const timer = setInterval(load, NIGHT_STOPS_REFRESH_S * MS_PER_S);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [repository, routeCode]);

  return state && routeCode && state.key === `${repository.source}:${routeCode}` ? state : null;
}
