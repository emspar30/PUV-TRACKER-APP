import { useEffect } from 'react';
import { AppState } from 'react-native';

import { addHeatmapSmsListener } from '../../../../modules/tunton-sms';
import { drainAndApply, ensureInboxConfigured } from './inbox';

// DR5: keeps the heatmap up to date while the driver app runs: drains the native inbox on start,
// on each new message and on return to the screen. Mounted once, on the home screen.
export function useHeatmapInbox(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const drain = () => {
      drainAndApply().catch(() => {
        // The messages stay in the native inbox (or were refused); the next drain tries again
      });
    };
    ensureInboxConfigured()
      .catch(() => {
        // The module is not in this build; the home screen shows the heatmap as never updated
      })
      .finally(drain);
    const arrived = addHeatmapSmsListener(drain);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') drain();
    });
    return () => {
      arrived?.remove();
      foreground.remove();
    };
  }, [enabled]);
}
