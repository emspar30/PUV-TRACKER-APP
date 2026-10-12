// The driver app's native additions, so the commuter and gateway apps never get them. Added to the
// plugins list by app.config.js for APP_VARIANT=driver only.
// DR4: the beacon (modules/tunton-beacon): Bluetooth advertising permissions, the foreground service
// (type connectedDevice, PRD 9.2) and the receiver that restarts it after a reboot.
// DR5 adds the SMS receivers and RECEIVE_SMS here.

const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const BEACON = 'expo.modules.tuntonbeacon';

const PERMISSIONS = [
  { name: 'android.permission.BLUETOOTH', maxSdkVersion: '30' },
  { name: 'android.permission.BLUETOOTH_ADMIN', maxSdkVersion: '30' },
  { name: 'android.permission.BLUETOOTH_ADVERTISE' },
  { name: 'android.permission.FOREGROUND_SERVICE' },
  { name: 'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE' },
  { name: 'android.permission.RECEIVE_BOOT_COMPLETED' },
];

function addPermissions(manifest) {
  manifest['uses-permission'] = manifest['uses-permission'] ?? [];
  for (const { name, maxSdkVersion } of PERMISSIONS) {
    if (manifest['uses-permission'].some((entry) => entry.$['android:name'] === name)) continue;
    const $ = { 'android:name': name };
    if (maxSdkVersion) $['android:maxSdkVersion'] = maxSdkVersion;
    manifest['uses-permission'].push({ $ });
  }
}

function addComponents(application) {
  application.service = (application.service ?? []).filter((entry) => entry.$['android:name'] !== `${BEACON}.BeaconAdvertiserService`);
  application.service.push({
    $: {
      'android:name': `${BEACON}.BeaconAdvertiserService`,
      'android:exported': 'false',
      'android:foregroundServiceType': 'connectedDevice',
    },
  });
  application.receiver = (application.receiver ?? []).filter((entry) => entry.$['android:name'] !== `${BEACON}.BootReceiver`);
  application.receiver.push({
    $: { 'android:name': `${BEACON}.BootReceiver`, 'android:exported': 'true' },
    'intent-filter': [
      {
        action: [
          { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
          { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
        ],
      },
    ],
  });
}

module.exports = function withDriverAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    addPermissions(mod.modResults.manifest);
    addComponents(AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults));
    return mod;
  });
};
