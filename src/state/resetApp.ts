import { useCheckInStore } from './checkinStore';
import { useDestinationsStore } from './destinationsStore';
import { useHintsStore } from './hintsStore';
import { useProfileStore } from './profileStore';
import { useRidesStore } from './ridesStore';
import { useSettingsStore } from './settingsStore';
import { useTrustStore } from './trustStore';
import { useUsernameStore } from './usernameStore';

// Demo settings, "Reset app": every store on this phone back to its first-launch state, so the app
// starts again with the introduction. Signing out is done by the screen, which talks to the backend.
export function resetApp(): void {
  useCheckInStore.setState(useCheckInStore.getInitialState(), true);
  useDestinationsStore.setState(useDestinationsStore.getInitialState(), true);
  useHintsStore.setState(useHintsStore.getInitialState(), true);
  useRidesStore.setState(useRidesStore.getInitialState(), true);
  useTrustStore.setState(useTrustStore.getInitialState(), true);
  useUsernameStore.setState(useUsernameStore.getInitialState(), true);
  useSettingsStore.getState().resetSettings();
  // Last, so the introduction opens with everything above already cleared
  useProfileStore.setState(useProfileStore.getInitialState(), true);
}
