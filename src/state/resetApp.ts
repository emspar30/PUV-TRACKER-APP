import { useAssistantStore } from './assistantStore';
import { useCheckInStore } from './checkinStore';
import { useCountsStore } from './countsStore';
import { useDestinationsStore } from './destinationsStore';
import { useHintsStore } from './hintsStore';
import { useHistoryStore } from './historyStore';
import { useLocationStore } from './locationStore';
import { useProfileStore } from './profileStore';
import { useRidesStore } from './ridesStore';
import { useSettingsStore } from './settingsStore';
import { useTourStore } from './tourStore';
import { useTrustStore } from './trustStore';
import { useUsernameStore } from './usernameStore';

// Demo settings, "Reset app": every store on this phone back to its first-launch state, so the app
// starts again with the introduction. Signing out is done by the screen, which talks to the backend.
export function resetApp(): void {
  // CA1.1: Ask Tunton's conversation and layout
  useAssistantStore.setState(useAssistantStore.getInitialState(), true);
  useCheckInStore.setState(useCheckInStore.getInitialState(), true);
  useCountsStore.setState(useCountsStore.getInitialState(), true);
  useDestinationsStore.setState(useDestinationsStore.getInitialState(), true);
  useHintsStore.setState(useHintsStore.getInitialState(), true);
  useHistoryStore.setState(useHistoryStore.getInitialState(), true);
  // G0: the location consent too; the permission is read again from Android, and the manual pin goes
  useLocationStore.setState({ consent: useLocationStore.getInitialState().consent, fix: null, explainer: 'idle', manualOrigin: null });
  useRidesStore.setState(useRidesStore.getInitialState(), true);
  useTrustStore.setState(useTrustStore.getInitialState(), true);
  useUsernameStore.setState(useUsernameStore.getInitialState(), true);
  useSettingsStore.getState().resetSettings();
  // ST2-D: the tips tour shows again after the introduction
  useTourStore.setState({ done: false, step: null });
  // Last, so the introduction opens with everything above already cleared
  useProfileStore.setState(useProfileStore.getInitialState(), true);
}
