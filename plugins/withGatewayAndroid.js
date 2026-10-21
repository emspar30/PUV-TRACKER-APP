// The gateway app's native additions, so no other app gets them. Added to the plugins list by
// app.config.js for APP_VARIANT=gateway only.
// DR5 (carrier test): SEND_SMS, and READ_PHONE_STATE to list the SIMs and choose which one sends
// (modules/tunton-sms).
// DR7: the sending service (GatewayService, a foreground service of type specialUse: Android 15 limits
// dataSync to about 6 hours a day and keeps it from starting at boot; Android 14 needs the subtype
// property below), the receiver that restarts it after a reboot, a wake lock for its loop with the
// screen off, and the battery-optimisation prompt. Development builds already allow plain HTTP to
// localhost (Expo's debug manifest), for `adb reverse`; preview and release builds need HTTPS.

const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SMS = 'expo.modules.tuntonsms';

const PERMISSIONS = [
  'android.permission.SEND_SMS',
  'android.permission.READ_PHONE_STATE',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
];

const SPECIAL_USE_SUBTYPE =
  'Dedicated SMS gateway for a transit pilot: sends waiting-passenger counts to driver phones by SMS all day, on a team phone that stays on the charger.';

function addPermissions(manifest) {
  manifest['uses-permission'] = manifest['uses-permission'] ?? [];
  for (const name of PERMISSIONS) {
    if (manifest['uses-permission'].some((entry) => entry.$['android:name'] === name)) continue;
    manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function addComponents(application) {
  application.service = (application.service ?? []).filter((entry) => entry.$['android:name'] !== `${SMS}.GatewayService`);
  application.service.push({
    $: {
      'android:name': `${SMS}.GatewayService`,
      'android:exported': 'false',
      'android:foregroundServiceType': 'specialUse',
    },
    property: [{ $: { 'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE', 'android:value': SPECIAL_USE_SUBTYPE } }],
  });
  application.receiver = (application.receiver ?? []).filter((entry) => entry.$['android:name'] !== `${SMS}.GatewayBootReceiver`);
  application.receiver.push({
    $: { 'android:name': `${SMS}.GatewayBootReceiver`, 'android:exported': 'true' },
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

module.exports = function withGatewayAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    addPermissions(mod.modResults.manifest);
    addComponents(AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults));
    return mod;
  });
};
