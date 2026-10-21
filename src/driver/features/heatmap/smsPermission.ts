import { PermissionsAndroid, Platform } from 'react-native';

// DR5: receiving heatmap texts needs RECEIVE_SMS (data SMS too). On Android 13 and later an app
// installed from a file (not a store) may find it blocked as a "restricted setting": the request is
// then refused without a prompt, and the user must allow restricted settings in the app's info page
// first (the provisioning screen says how).
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
