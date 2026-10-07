import { useEffect } from 'react';
import { AppState } from 'react-native';

import { serverReachable } from '@/services/connection';
import { CONNECTION_PROBE_S } from '@/shared/config';
import { setOnline } from '@/state/connectionStore';
import { useSettingsStore } from '@/state/settingsStore';

const MS_PER_S = 1000;

// PRD 14: checks the server every CONNECTION_PROBE_S and on return to the app while live data is
// on, so the top bar can say live updates are paused. Demo data sends nothing, so it is not checked.
export function useConnectionProbe(): void {
  const demo = useSettingsStore((state) => state.demoData);

  useEffect(() => {
    if (demo) {
      setOnline(null);
      return undefined;
    }
    let cancelled = false;
    const check = () => {
      void serverReachable().then((online) => {
        if (!cancelled) setOnline(online);
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
  }, [demo]);
}
