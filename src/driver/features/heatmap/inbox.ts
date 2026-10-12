import { DRIVER_INBOX_MAX } from '@/shared/config';
import { processInbox } from '@/shared/driver/inbox';
import { HEATMAP_TEXT_PREFIX } from '@/shared/sms/protocol';

import { useDriverStore } from '../../state/driverStore';
import { useHeatmapStore } from '../../state/heatmapStore';
import { getSmsKey, isBeaconAvailable } from '../../../../modules/tunton-beacon';
import { configureInbox, drainInbox, isInboxConfigured, isSmsAvailable } from '../../../../modules/tunton-sms';

// DR5: moves heatmap messages from the native inbox into the heatmap. The native receiver stores
// them even while the app is closed; this drains them when the app starts, when a new one arrives
// and when the app comes back to the screen, then checks and applies each (shared/driver/inbox).
// Runs one at a time, so two drains never apply against the same old state.

let queue: Promise<number> = Promise.resolve(0);

// Turns the native inbox on (idempotent). A phone set up before DR5 has its inbox off until this runs.
export async function ensureInboxConfigured(): Promise<void> {
  if (!isSmsAvailable() || isInboxConfigured()) return;
  await configureInbox(HEATMAP_TEXT_PREFIX, DRIVER_INBOX_MAX);
}

// The number of messages handled (accepted or not)
export function drainAndApply(): Promise<number> {
  queue = queue.then(drainOnce, drainOnce);
  return queue;
}

async function drainOnce(): Promise<number> {
  const setup = useDriverStore.getState().setup;
  if (!setup || !isSmsAvailable() || !isBeaconAvailable()) return 0;
  // Without the key nothing can be checked: leave the messages in the inbox (the phone must be set
  // up again, and the home screen says so)
  const key = await getSmsKey();
  if (!key) return 0;
  const entries = await drainInbox();
  if (entries.length === 0) return 0;
  const store = useHeatmapStore.getState();
  const processed = processInbox(store.ensureRoute(setup.routeCode), entries, { key, gatewayNumbers: setup.gatewayNumbers });
  store.record(processed);
  return entries.length;
}
