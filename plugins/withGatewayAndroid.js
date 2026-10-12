// The gateway app's native additions, so no other app gets them. Added to the plugins list by
// app.config.js for APP_VARIANT=gateway only.
// DR5 (carrier test): SEND_SMS, and READ_PHONE_STATE to list the SIMs and choose which one sends
// (modules/tunton-sms). DR7 adds the gateway service, its boot receiver and the development-only
// cleartext rule for localhost.

const { withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = ['android.permission.SEND_SMS', 'android.permission.READ_PHONE_STATE'];

function addPermissions(manifest) {
  manifest['uses-permission'] = manifest['uses-permission'] ?? [];
  for (const name of PERMISSIONS) {
    if (manifest['uses-permission'].some((entry) => entry.$['android:name'] === name)) continue;
    manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

module.exports = function withGatewayAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    addPermissions(mod.modResults.manifest);
    return mod;
  });
};
