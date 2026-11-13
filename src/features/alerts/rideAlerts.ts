import * as Notifications from 'expo-notifications';
import { Vibration } from 'react-native';

import { GET_OFF_BUZZ_MAX_S, RIDE_ALERT_VIBRATION_MS } from '@/shared/config';
import { strings } from '@/strings';

// Tester note (2026-11-13; PRD S6): ride alerts reach the phone's lock screen and notification shade,
// so a rider who dozed off, or put the phone away, still gets them. Local notifications only: made
// on the phone, nothing is sent to or through a server, and no push token is asked for. With the app
// in front, the in-app toast or dialog shows instead and the notification only goes to the shade.

const CHANNEL_ID = 'ride-alerts';
const MS_PER_S = 1000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let channelReady: Promise<void> | null = null;

// Android needs the channel before it asks for the permission (Android 13 and newer)
function ensureChannel(): Promise<void> {
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: strings.alerts.channelName,
    description: strings.alerts.channelDescription,
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [...RIDE_ALERT_VIBRATION_MS],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  }).then(() => undefined);
  return channelReady;
}

// Asks for the notification permission once a relay or tracking starts, where the reason is plain.
// A rider who says no still gets the in-app alerts.
export async function prepareRideAlerts(): Promise<void> {
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted && current.canAskAgain) await Notifications.requestPermissionsAsync();
  } catch {
    // No notifications on this phone: the in-app alerts remain
  }
}

// One alert on the lock screen and in the shade, with the channel's vibration
export async function notifyRide(title: string, body: string | null): Promise<void> {
  try {
    await ensureChannel();
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body: body ?? undefined, priority: Notifications.AndroidNotificationPriority.MAX },
      trigger: { channelId: CHANNEL_ID },
    });
  } catch {
    // The in-app alert is shown anyway
  }
}

// The ride alerts' buzz, once
export function buzzOnce(): void {
  Vibration.vibrate([...RIDE_ALERT_VIBRATION_MS]);
}

let buzzTimer: ReturnType<typeof setTimeout> | null = null;

// The get-off buzz repeats until stopBuzz (the rider's "Got it"), for at most GET_OFF_BUZZ_MAX_S
export function buzzUntilStopped(): void {
  stopBuzz();
  Vibration.vibrate([...RIDE_ALERT_VIBRATION_MS], true);
  buzzTimer = setTimeout(stopBuzz, GET_OFF_BUZZ_MAX_S * MS_PER_S);
}

export function stopBuzz(): void {
  if (buzzTimer) clearTimeout(buzzTimer);
  buzzTimer = null;
  Vibration.cancel();
}
