import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { loadRouteNetwork, type RouteNetwork } from '@/data/db/routeRepository';

type RouteNetworkState = { network: RouteNetwork | null; failed: boolean };

// Route data from the local database, read once per screen
export function useRouteNetwork(): RouteNetworkState {
  const db = useSQLiteContext();
  const [state, setState] = useState<RouteNetworkState>({ network: null, failed: false });

  useEffect(() => {
    let active = true;
    loadRouteNetwork(db)
      .then((network) => {
        if (active) setState({ network, failed: false });
      })
      .catch(() => {
        if (active) setState({ network: null, failed: true });
      });
    return () => {
      active = false;
    };
  }, [db]);

  return state;
}
