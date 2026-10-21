import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { serverReachable } from '@/services/connection';
import { accessOf, type AssistantAccess } from '@/shared/assistant/history';
import { CONNECTION_PROBE_S } from '@/shared/config';
import { useConnectionStore } from '@/state/connectionStore';

const MS_PER_S = 1000;

// CA1.1: whether Ask Tunton can be used: only while the server can be reached. The app's own check
// (PRD 14, live data on) answers at once; while the screen is open it also checks by itself, every
// CONNECTION_PROBE_S and on return to the app, so it works with Demo data too.
export function useAssistantAccess(): AssistantAccess {
  const known = useConnectionStore((state) => state.online);
  const [probe, setProbe] = useState<boolean | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void serverReachable().then((result) => {
        if (!cancelled) setProbe(result);
      });
    };
    check();
    const timer = setInterval(check, CONNECTION_PROBE_S * MS_PER_S);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  // Until this screen's own check answers, the app-wide one (null when it has not run)
  return accessOf(probe !== undefined ? probe : (known ?? undefined), __DEV__);
}
