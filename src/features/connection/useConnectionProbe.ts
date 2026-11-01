import { Wifi, WifiOff } from 'lucide-react-native';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { serverReachable } from '@/services/connection';
import { CONNECTION_PROBE_S } from '@/shared/config';
import { setOnline, useConnectionStore } from '@/state/connectionStore';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

const MS_PER_S = 1000;

// PRD 14: checks the server every CONNECTION_PROBE_S and on return to the app, so the top bar can
// say live updates are paused. Demo data is checked too: the phone's connection is real either way,
// and Tunie and the Crowdsource feed need it. A toast says when the connection drops and when it
// comes back (not on the first answer).
export function useConnectionProbe(): void {
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void serverReachable().then((online) => {
        if (cancelled) return;
        const before = useConnectionStore.getState().online;
        setOnline(online);
        if (before === true && online === false) showToast({ icon: WifiOff, title: strings.connection.lostTitle, body: strings.connection.lostBody });
        if (before === false && online === true) showToast({ icon: Wifi, title: strings.connection.backTitle });
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
}
