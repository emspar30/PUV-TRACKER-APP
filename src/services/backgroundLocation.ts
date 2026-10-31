import * as TaskManager from 'expo-task-manager';

import { useBackgroundRelayStore } from '@/state/backgroundRelayStore';
import { useLocationStore } from '@/state/locationStore';
import { strings } from '@/strings';

import { backgroundLocationGranted, startLocationTask, stopLocationTask, toFix, type RawLocation } from './location';

export { askBackgroundLocation, backgroundLocationGranted } from './location';

// B1 (PRD 8.5, D5): while a relay is queued or running, positions keep coming with the app in the
// background, through a location foreground service with a visible notification. The task only
// feeds the location store, so the relay's own rules (the queue, acceptFix, the send rule, the
// outbox, RL1's ends) work on them unchanged. Defined here, at the top level of a module the app
// root imports, as TaskManager requires.

export const BACKGROUND_RELAY_TASK = 'tunton-relay-location';

type TaskData = { locations?: RawLocation[] };

TaskManager.defineTask<TaskData>(BACKGROUND_RELAY_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const newest = data.locations[data.locations.length - 1];
  useLocationStore.getState().setFix(toFix(newest));
  useBackgroundRelayStore.getState().set({ lastRunMs: Date.now() });
});

// Starts the service with its notification; false when background location is not allowed, so the
// relay stays foreground-only (PRD 4.2)
export async function startBackgroundRelay(routeCode: string): Promise<boolean> {
  if (!(await backgroundLocationGranted())) return false;
  return startLocationTask(BACKGROUND_RELAY_TASK, {
    title: strings.report.background.notificationTitle(routeCode),
    body: strings.report.background.notificationBody,
  });
}

export async function stopBackgroundRelay(): Promise<void> {
  await stopLocationTask(BACKGROUND_RELAY_TASK);
}
