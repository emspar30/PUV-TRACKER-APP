import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { create } from 'zustand';

import { locationServicesOn } from '@/services/location';
import { mayUseLocation } from '@/shared/location/consent';
import { useLocationStore } from '@/state/locationStore';

// DR8: may the Relay panel scan for the multicab's beacon? Android 12+ asks for Nearby devices,
// after the panel's own explainer (PRD 4.2). Scan results also need the location permission (given
// with the G0 consent) and the location setting on, on every Android version.
//   off             the scan is not wanted (demo data)
//   checking        asking Android
//   needs_location  no location consent or permission yet
//   location_off    the phone's location setting is off
//   explain         show the explainer before the system prompt
//   declined        "Not now", or the prompt was refused: the manual pickers, as before
//   blocked         refused for good: only Settings can allow it
//   granted         scan
export type NearbyStatus = 'off' | 'checking' | 'needs_location' | 'location_off' | 'explain' | 'declined' | 'blocked' | 'granted';

export type NearbyPermission = {
  status: NearbyStatus;
  // Explainer "Continue": the system prompt
  accept: () => Promise<void>;
  // Explainer "Not now"
  decline: () => void;
  // Show the explainer again after "Not now"
  reconsider: () => void;
};

const ANDROID_12 = 31;

// The answer is kept while the app runs, so the panel does not ask again each time it opens
const useNearbyAnswer = create<{ answer: 'declined' | 'blocked' | null; setAnswer: (answer: 'declined' | 'blocked' | null) => void }>((set) => ({
  answer: null,
  setAnswer: (answer) => set({ answer }),
}));

function needsRuntimePermission(): boolean {
  const version = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  return Platform.OS === 'android' && version >= ANDROID_12;
}

export function useNearbyPermission(wanted: boolean): NearbyPermission {
  const locationOk = useLocationStore((state) => mayUseLocation(state.consent, state.permission));
  const answer = useNearbyAnswer((state) => state.answer);
  const setAnswer = useNearbyAnswer((state) => state.setAnswer);
  const [system, setSystem] = useState<'checking' | 'location_off' | 'granted' | 'not_granted'>('checking');

  useEffect(() => {
    if (!wanted || !locationOk) return undefined;
    let current = true;
    void (async () => {
      const on = await locationServicesOn();
      const granted = on && (!needsRuntimePermission() || (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN)));
      if (current) setSystem(!on ? 'location_off' : granted ? 'granted' : 'not_granted');
    })();
    return () => {
      current = false;
    };
  }, [wanted, locationOk]);

  const status: NearbyStatus = !wanted
    ? 'off'
    : !locationOk
      ? 'needs_location'
      : system === 'not_granted'
        ? (answer ?? 'explain')
        : system;

  return {
    status,
    accept: async () => {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        setAnswer(null);
        setSystem('granted');
      } else {
        setAnswer(result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'declined');
      }
    },
    decline: () => setAnswer('declined'),
    reconsider: () => setAnswer(null),
  };
}
