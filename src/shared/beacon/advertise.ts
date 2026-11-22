// Phase 5 (owner, 2026-11-22): the driver beacon's advertising mode and transmit power. The default
// settings stay until the lower-power ones pass a retest in a real multicab (BEACON_LOW_POWER).
// Pure: no React Native or Expo imports.

import {
  BEACON_ADVERTISE_MODE,
  BEACON_ADVERTISE_MODE_LOW_POWER,
  BEACON_TX_POWER,
  BEACON_TX_POWER_LOW_POWER,
  type BeaconAdvertiseMode,
  type BeaconTxPower,
} from '../config';

export type AdvertiseSettings = { mode: BeaconAdvertiseMode; txPower: BeaconTxPower };

export function advertiseSettings(lowPower: boolean): AdvertiseSettings {
  return lowPower
    ? { mode: BEACON_ADVERTISE_MODE_LOW_POWER, txPower: BEACON_TX_POWER_LOW_POWER }
    : { mode: BEACON_ADVERTISE_MODE, txPower: BEACON_TX_POWER };
}
