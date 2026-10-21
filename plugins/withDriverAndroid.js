// The driver app's native additions, so the commuter and gateway apps never get them. Added to the
// plugins list by app.config.js for APP_VARIANT=driver only.
// DR4: the beacon (modules/tunton-beacon): Bluetooth advertising permissions, the foreground service
// (type connectedDevice, PRD 9.2) and the receiver that restarts it after a reboot.
// DR5: the heatmap SMS receiver (modules/tunton-sms) and RECEIVE_SMS. One receiver, two filters: data
// SMS on DATA_SMS_PORT and text SMS (the receiver keeps only heatmap texts). Only the system may call
// it (BROADCAST_SMS).

const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const BEACON = 'expo.modules.tuntonbeacon';
const SMS = 'expo.modules.tuntonsms';
// The same as DATA_SMS_PORT in src/shared/config (a test checks the two agree): a plugin runs in
// plain Node and cannot import the TypeScript config
const DATA_SMS_PORT = '8901';

const PERMISSIONS = [
  { name: 'android.permission.BLUETOOTH', maxSdkVersion: '30' },
  { name: 'android.permission.BLUETOOTH_ADMIN', maxSdkVersion: '30' },
  { name: 'android.permission.BLUETOOTH_ADVERTISE' },
  { name: 'android.permission.FOREGROUND_SERVICE' },
  { name: 'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE' },
  { name: 'android.permission.RECEIVE_BOOT_COMPLETED' },
  { name: 'android.permission.RECEIVE_SMS' },
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

function smsReceiver() {
  return {
    $: {
      'android:name': `${SMS}.SmsReceiver`,
      'android:exported': 'true',
      'android:permission': 'android.permission.BROADCAST_SMS',
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.DATA_SMS_RECEIVED' } }],
        data: [{ $: { 'android:scheme': 'sms', 'android:host': '*', 'android:port': DATA_SMS_PORT } }],
      },
      {
        action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } }],
      },
    ],
  };
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
  application.receiver = application.receiver.filter((entry) => entry.$['android:name'] !== `${SMS}.SmsReceiver`);
  application.receiver.push(smsReceiver());
}

function withDriverAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    addPermissions(mod.modResults.manifest);
    addComponents(AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults));
    return mod;
  });
}

module.exports = withDriverAndroid;
module.exports.DATA_SMS_PORT = DATA_SMS_PORT;
