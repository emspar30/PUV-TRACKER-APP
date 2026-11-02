import { addNetworkStateListener } from 'expo-network';
import { Wifi, WifiOff } from 'lucide-react-native';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { serverReachable } from '@/services/connection';
import { CONNECTION_PROBE_S } from '@/shared/config';
import { setOnline, useConnectionStore } from '@/state/connectionStore';
import { refreshEnergy } from '@/state/energyStore';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

const MS_PER_S = 1000;

// PRD 14: checks the server every CONNECTION_PROBE_S and on return to the app, so the top bar can
// say live updates are paused. Demo data is checked too: the phone's connection is real either way,
// and Tunie and the Crowdsource feed need it. A toast says when the connection drops and when it
// comes back (not on the first answer).
// Emjay, 2026-11-02: Android's network changes are heard at once (expo-network), so airplane mode
// or a lost signal shows the banner in about a second rather than at the next check. Losing the
// network is offline straight away; any other change asks the server, since Wi-Fi without internet
// still says connected.
export function useConnectionProbe(): void {
  useEffect(() => {
    let cancelled = false;
    const apply = (online: boolean | null) => {
      if (cancelled) return;
      const before = useConnectionStore.getState().online;
      setOnline(online);
      if (before === true && online === false) showToast({ icon: WifiOff, title: strings.connection.lostTitle, body: strings.connection.lostBody });
      if (before === false && online === true) {
        showToast({ icon: Wifi, title: strings.connection.backTitle });
        // The wallet read while offline is stale: the server's balance is read again
        void refreshEnergy();
      }
    };
    const check = () => {
      void serverReachable().then(apply);
    };
    check();
    const timer = setInterval(check, CONNECTION_PROBE_S * MS_PER_S);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const network = addNetworkStateListener((event) => {
      if (event.isConnected === false) apply(false);
      else check();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
      network.remove();
    };
  }, []);
}
