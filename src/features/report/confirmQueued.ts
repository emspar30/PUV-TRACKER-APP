import { askBackgroundLocation, backgroundLocationGranted, startBackgroundRelay } from '@/services/backgroundLocation';
import { useBackgroundRelayStore } from '@/state/backgroundRelayStore';
import { showDialog } from '@/state/dialogStore';
import { strings } from '@/strings';

// RL2c, B1: after Send, "Relay queued". Without background location, once per app session, it also
// explains why "Allow all the time" keeps the relay going in other apps, before Android's settings
// open (Android 11 and newer ask there). Declining keeps the relay in the foreground (PRD 4.2).
export async function confirmQueued(destinationName: string, routeCode: string): Promise<void> {
  const t = strings.report;
  const background = useBackgroundRelayStore.getState();
  if (background.asked || (await backgroundLocationGranted())) {
    showDialog({ tone: 'success', title: t.queue.queuedTitle, body: t.queue.queuedBody(destinationName) });
    return;
  }
  background.set({ asked: true });
  showDialog({
    tone: 'primary',
    title: t.background.askTitle,
    body: `${t.queue.queuedBody(destinationName)}\n\n${t.background.askBody}`,
    actions: [
      {
        label: t.background.askAllow,
        onPress: () => {
          void askBackgroundLocation().then(async (granted) => {
            if (!granted) return;
            const running = await startBackgroundRelay(routeCode);
            useBackgroundRelayStore.getState().set({ running, lastRunMs: running ? Date.now() : null });
          });
        },
      },
      { label: t.background.askLater, variant: 'secondary' },
    ],
  });
}
