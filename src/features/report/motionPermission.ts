import { PermissionsAndroid } from 'react-native';

import { motionAvailable } from '../../../modules/tunton-motion';

const ACTIVITY_RECOGNITION = 'android.permission.ACTIVITY_RECOGNITION' as const;

let asked = false;

// V1b (D6): Android's "Physical activity" permission, asked once per app session at the first relay.
// A refusal is final for the session: the relay is then verified by speed alone, as before V1b.
export async function allowMotion(): Promise<boolean> {
  if (motionAvailable()) return true;
  if (asked) return false;
  asked = true;
  try {
    const result = await PermissionsAndroid.request(ACTIVITY_RECOGNITION);
    return result === PermissionsAndroid.RESULTS.GRANTED && motionAvailable();
  } catch {
    return false;
  }
}
