import { useCallback, useEffect, useState } from 'react';

import { prepareOfflineTiles, type OfflineTiles } from './tiles';

export type OfflineTilesState =
  | { status: 'preparing' }
  | { status: 'ready'; tiles: OfflineTiles }
  | { status: 'error'; message: string };

const PREPARING: OfflineTilesState = { status: 'preparing' };

export function useOfflineTiles(): { state: OfflineTilesState; retry: () => void } {
  const [state, setState] = useState<OfflineTilesState>(PREPARING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    prepareOfflineTiles()
      .then((tiles) => {
        if (!cancelled) setState({ status: 'ready', tiles });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState(PREPARING);
    setAttempt((count) => count + 1);
  }, []);

  return { state, retry };
}
