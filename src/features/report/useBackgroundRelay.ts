import { BatteryWarning } from 'lucide-react-native';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { startBackgroundRelay, stopBackgroundRelay } from '@/services/backgroundLocation';
import { BACKGROUND_RELAY_GAP_MIN } from '@/shared/config';
import { useBackgroundRelayStore } from '@/state/backgroundRelayStore';
import { showDialog } from '@/state/dialogStore';
import { useRelayStore } from '@/state/relayStore';
import { strings } from '@/strings';
import { fieldLog } from '@/state/fieldLogStore';

const MS_PER_MIN = 60_000;

// B1 (PRD 8.5): the foreground service runs while a relay is queued or running, and stops with its
// end, however it ends. Without background location it does not start, and the relay keeps to the
// foreground as before. Health check: back in the app during a relay, a gap of more than
// BACKGROUND_RELAY_GAP_MIN since the last background position means the phone stopped Tunton; the
// rider gets the vendor guide once per app session.
export function useBackgroundRelay(): void {
  const routeCode = useRelayStore((store) => store.session?.routeCode ?? store.queued?.queue.routeCode ?? null);
  const setBackground = useBackgroundRelayStore((store) => store.set);

  useEffect(() => {
    if (!routeCode) {
      void stopBackgroundRelay();
      setBackground({ running: false, lastRunMs: null });
      return undefined;
    }
    let cancelled = false;
    void startBackgroundRelay(routeCode).then((running) => {
      if (!cancelled) setBackground({ running, lastRunMs: running ? Date.now() : null });
    });
    return () => {
      cancelled = true;
    };
  }, [routeCode, setBackground]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const { running, lastRunMs, guideShown } = useBackgroundRelayStore.getState();
      if (!running || lastRunMs === null) return;
      const gapMs = Date.now() - lastRunMs;
      if (gapMs <= BACKGROUND_RELAY_GAP_MIN * MS_PER_MIN) return;
      // S10: every gap is noted; the guide shows once
      fieldLog('gap', Math.round(gapMs / MS_PER_MIN));
      if (guideShown) return;
      useBackgroundRelayStore.getState().set({ guideShown: true });
      const t = strings.report.background;
      showDialog({ tone: 'warning', icon: BatteryWarning, title: t.stoppedTitle, body: [t.stoppedBody, ...t.vendorSteps].join('\n\n') });
    });
    return () => subscription.remove();
  }, []);
}
