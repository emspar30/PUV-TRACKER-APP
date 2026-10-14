// The commuter app's native additions (DR8), so the driver and gateway apps never get them. Added to
// the plugins list by app.config.js for APP_VARIANT=commuter only.
// Bluetooth scanning for the multicab's beacon (modules/tunton-beacon, BeaconScanner):
// - BLUETOOTH_SCAN (Nearby devices, Android 12+) WITHOUT usesPermissionFlags="neverForLocation": with
//   that flag Android filters beacons out of the scan results. Results then also need the location
//   permission, which the commuter app already asks for with consent (G0).
// - BLUETOOTH and BLUETOOTH_ADMIN up to Android 11, where scanning needed them (and location).
// No advertising and no connecting: the commuter phone only listens.

const { withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = [
  { name: 'android.permission.BLUETOOTH', maxSdkVersion: '30' },
  { name: 'android.permission.BLUETOOTH_ADMIN', maxSdkVersion: '30' },
  { name: 'android.permission.BLUETOOTH_SCAN' },
];

// Adds each permission once; an entry a library already added is replaced, so a neverForLocation
// flag or a different maxSdkVersion from elsewhere cannot stay
function addPermissions(manifest) {
  const names = PERMISSIONS.map(({ name }) => name);
  manifest['uses-permission'] = (manifest['uses-permission'] ?? []).filter((entry) => !names.includes(entry.$['android:name']));
  for (const { name, maxSdkVersion } of PERMISSIONS) {
    const $ = { 'android:name': name };
    if (maxSdkVersion) $['android:maxSdkVersion'] = maxSdkVersion;
    manifest['uses-permission'].push({ $ });
  }
  return manifest;
}

function withCommuterBle(config) {
  return withAndroidManifest(config, (mod) => {
    addPermissions(mod.modResults.manifest);
    return mod;
  });
}

module.exports = withCommuterBle;
module.exports.addPermissions = addPermissions;
