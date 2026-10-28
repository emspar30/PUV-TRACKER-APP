import { useDriverStore } from '../../state/driverStore';
import { useHeatmapStore } from '../../state/heatmapStore';
import { useRegistrationStore } from '../../state/registrationStore';
import { clearProvisioning, isBeaconAvailable } from '../../../../modules/tunton-beacon';
import { disableInbox, isSmsAvailable } from '../../../../modules/tunton-sms';

// Removes this phone's setup (the Keystore secrets, the inbox, the saved setup and heatmap) and any
// registration in progress, so the next screen is registration from the beginning: Admin's "Set up
// again", and "Register again" after the phone was retired
export async function clearSetup(): Promise<void> {
  if (isBeaconAvailable()) await clearProvisioning();
  if (isSmsAvailable()) await disableInbox();
  useDriverStore.getState().resetDriver();
  useHeatmapStore.getState().resetHeatmap();
  useRegistrationStore.getState().resetRegistration();
}
