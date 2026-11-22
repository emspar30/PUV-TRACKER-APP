import { useEffect } from 'react';

import { askBackgroundLocation, backgroundLocationGranted, startBackgroundWatch, stopBackgroundWatch } from '@/services/backgroundLocation';
import { backgroundWatch, watchKey } from '@/shared/alerts/backgroundWatch';
import { useBackgroundRelayStore } from '@/state/backgroundRelayStore';
import { showDialog } from '@/state/dialogStore';
import { useRelayStore } from '@/state/relayStore';
import { useTrackingStore } from '@/state/trackingStore';
import { strings } from '@/strings';

import { useActiveCheckIn } from '../checkin/useActiveCheckIn';
import { prepareRideAlerts } from './rideAlerts';

// Background alerts (owner, 2026-11-23): while the rider tracks a multicab or is checked in, a
// location foreground service with its own notice keeps Tunton running in other apps and with the
// screen off, so the track alerts (2 minutes, 1 km to 100 m, arrived) and "Did you board?" reach the
// notification shade. It stops when tracking and the check-in end, and stands down during a relay
// (whose service does the same). It needs location "Allow all the time": asked once per app session
// (the same question as the relay's), and without it the alerts stay as before (while Tunton is
// open). Mounted once, in the tabs layout.
export function useBackgroundWatch(): void {
  const relaying = useRelayStore((store) => store.session !== null || store.queued !== null);
  const trackedRoute = useTrackingStore((store) => store.routeCode);
  const checkIn = useActiveCheckIn();
  const watch = backgroundWatch({ relaying, trackedRoute, checkInStation: checkIn?.stationCode ?? null });
  const key = watchKey(watch);

  useEffect(() => {
    if (key === null) {
      void stopBackgroundWatch();
      return undefined;
    }
    let cancelled = false;
    const [kind, code] = key.split(':') as ['tracking' | 'checkin', string];
    const t = strings.alerts.background;
    const notice = kind === 'tracking' ? { title: t.trackingTitle(code), body: t.trackingBody } : { title: t.checkinTitle(code), body: t.checkinBody };
    const run = async () => {
      void prepareRideAlerts();
      // A new watch gets the new notice
      await stopBackgroundWatch();
      if (cancelled) return;
      if (await backgroundLocationGranted()) {
        await startBackgroundWatch(notice);
        return;
      }
      const asked = useBackgroundRelayStore.getState();
      if (asked.asked) return;
      asked.set({ asked: true });
      showDialog({
        tone: 'primary',
        title: t.askTitle,
        body: t.askBody,
        actions: [
          {
            label: strings.report.background.askAllow,
            onPress: () => {
              void askBackgroundLocation().then(async (granted) => {
                if (granted && !cancelled) await startBackgroundWatch(notice);
              });
            },
          },
          { label: strings.report.background.askLater, variant: 'secondary' },
        ],
      });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [key]);
}

// The hook as a component, so the tabs layout mounts it after its own early returns
export function BackgroundWatch(): null {
  useBackgroundWatch();
  return null;
}
