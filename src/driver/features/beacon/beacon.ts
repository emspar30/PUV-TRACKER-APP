import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import {
  BEACON_ADVERTISE_MODE,
  BEACON_PAYLOAD_VERSION,
  BEACON_SERVICE_UUID,
  BEACON_SLOT_S,
  BEACON_TX_POWER,
} from '@/shared/config';
import { strings } from '@/strings';

import { addStatusListener, getStatus, type BeaconOptions, type BeaconStatus } from '../../../../modules/tunton-beacon';

// DR4: the driver app's side of the beacon. The settings come from shared/config, the one place for
// them; the native module stores them so the beacon can restart after a reboot without JavaScript.

const STATUS_POLL_MS = 5000;
const ANDROID_12 = 31;
const ANDROID_13 = 33;

export function beaconOptions(): BeaconOptions {
  return {
    serviceUuid: BEACON_SERVICE_UUID,
    version: BEACON_PAYLOAD_VERSION,
    slotSeconds: BEACON_SLOT_S,
    mode: BEACON_ADVERTISE_MODE,
    txPower: BEACON_TX_POWER,
    notificationTitle: strings.driver.notification.title,
    notificationText: strings.driver.notification.text,
  };
}

// The beacon's status, live: from the module's events, and polled in case an event was missed
export function useBeaconStatus(): BeaconStatus {
  const [status, setStatus] = useState<BeaconStatus>(getStatus);
  useEffect(() => {
    const subscription = addStatusListener(setStatus);
    const timer = setInterval(() => setStatus(getStatus()), STATUS_POLL_MS);
    return () => {
      subscription?.remove();
      clearInterval(timer);
    };
  }, []);
  return status;
}

export type BeaconSummary = { tone: 'ok' | 'warn' | 'bad'; label: string };

export function describeBeacon(status: BeaconStatus): BeaconSummary {
  const text = strings.driver;
  if (status.advertising) return { tone: 'ok', label: text.beaconOn };
  if (status.enabled && !status.lastError) return { tone: 'warn', label: text.beaconStarting };
  if (!status.enabled && status.lastError === null) return { tone: 'warn', label: text.beaconOff };
  const errors = text.beaconError as Record<string, string>;
  return { tone: 'bad', label: errors[status.lastError ?? ''] ?? errors.other };
}

// Nearby devices (Android 12+) is required; notifications (Android 13+) only show the beacon is on
export async function requestBeaconPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const version = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  if (version >= ANDROID_13) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  if (version < ANDROID_12) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
