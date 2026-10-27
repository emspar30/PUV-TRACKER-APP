import type { DriverProvisioning } from '@/shared/driver/provisioning';

import { setupFrom, useDriverStore } from '../../state/driverStore';
import { beaconOptions } from '../beacon/beacon';
import { ensureInboxConfigured } from '../heatmap/inbox';
import { getSupport, isBeaconAvailable, provision, startAdvertising } from '../../../../modules/tunton-beacon';

// DR4, DRG4: turning a setup (from the QR, or collected after approval) into a working driver phone
// (PRD 9.5). Shared by the QR screen and the registration screen.

export type SetupBlock = 'cannot_beacon' | 'bluetooth_off';
export type SetupOutcome = 'done' | SetupBlock | 'failed';

// Whether this phone can take a setup now. A collected setup cannot be collected again, so the
// registration screen asks this first.
export function setupBlock(): SetupBlock | null {
  const support = getSupport();
  if (!isBeaconAvailable() || !support.bluetooth || support.advertising === false) return 'cannot_beacon';
  if (!support.bluetoothOn) return 'bluetooth_off';
  return null;
}

// The secrets go into the Android Keystore first (native module), then the setup without its secrets
// is saved, so the phone is set up even if the beacon then fails to start: the home screen starts a
// beacon that should be on and is not.
export async function applySetup(payload: DriverProvisioning): Promise<SetupOutcome> {
  const block = setupBlock();
  if (block) return block;
  try {
    await provision(payload.shortId, payload.beaconSecret, payload.smsKey);
  } catch {
    return 'failed';
  }
  const driver = useDriverStore.getState();
  driver.setSetup(setupFrom(payload, Date.now()));
  driver.setBeaconEnabled(true);
  try {
    await startAdvertising(beaconOptions());
    await ensureInboxConfigured();
  } catch {
    // The home screen restarts the beacon and turns the inbox on
  }
  return 'done';
}
