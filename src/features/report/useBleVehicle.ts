import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { verifyBeaconCode } from '@/services/beacon';

import { addBeaconListener, addScanStoppedListener, getSupport, isScanAvailable, startScan, stopScan } from '../../../modules/tunton-beacon';
import { createBleSession, type BleScanner, type BleView } from './bleSession';
import { SETTINGS_RECHECK_MS, useNearbyPermission, type NearbyPermission } from './nearbyPermission';

export type { BleVehicle } from '@/services/beacon';
export type { BleView } from './bleSession';

// B4 slot, filled in DR8: while the Relay panel is open (and the app is in front), the phone listens
// for the multicab's beacon; when one multicab is present and the server accepts its code, the
// panel uses that route and vehicle instead of the manual pickers. The scan stops when the panel
// closes, the app goes to the background, or after ARMED_SCAN_MIN.
export type BleState = {
  nearby: NearbyPermission;
  // Null while the scan may not run (see nearby.status)
  view: BleView | null;
};

const nativeScanner: BleScanner = {
  start: startScan,
  stop: stopScan,
  onReading: addBeaconListener,
  onStopped: addScanStoppedListener,
};

export function useForeground(): boolean {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  return foreground;
}

const readBluetoothOn = () => getSupport().bluetoothOn;

// Backlog 118: whether Bluetooth is on, read again every SETTINGS_RECHECK_MS while watched
function useBluetoothOn(watch: boolean): boolean {
  const subscribe = useCallback(
    (changed: () => void) => {
      if (!watch) return () => undefined;
      const timer = setInterval(changed, SETTINGS_RECHECK_MS);
      return () => clearInterval(timer);
    },
    [watch],
  );
  return useSyncExternalStore(subscribe, readBluetoothOn);
}

// wanted: false with demo data (its multicabs are made up), so nothing is scanned or checked. A build
// without the scanner asks for nothing either: its manifest lacks Nearby devices, which Android
// would then report as refused for good
// RL2c: the queue listens without keeping a multicab it no longer hears, for up to RELAY_QUEUE_MAX_MIN.
// B1: with the background relay running, it keeps listening when the app is in the background (the
// scan filters on the beacon UUID, which Android keeps delivering with the screen off)
export type BleOptions = { sticky: boolean; durationMin: number; background?: boolean };

export function useBleVehicle(wanted: boolean, options?: BleOptions): BleState {
  const nearby = useNearbyPermission(wanted && isScanAvailable());
  const foreground = useForeground();
  const scan = nearby.status === 'granted' && (foreground || options?.background === true);
  const [view, setView] = useState<BleView | null>(null);
  // Bluetooth turned on or off starts a new session: a scan refused for Bluetooth off never starts
  // by itself, and Android ends a running scan when Bluetooth goes off
  const bluetoothOn = useBluetoothOn(scan);
  const sticky = options?.sticky;
  const durationMin = options?.durationMin;

  useEffect(() => {
    if (!scan) return undefined;
    const session = createBleSession({ scanner: nativeScanner, verify: verifyBeaconCode, now: Date.now, onChange: setView, sticky, durationMin });
    void session.start();
    return () => {
      session.dispose();
      // A later scan starts from nothing, not from this one's multicab
      setView(null);
    };
  }, [scan, bluetoothOn, sticky, durationMin]);

  return { nearby, view: scan ? view : null };
}
