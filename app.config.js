// DR1: one codebase, three Android apps (docs/IMPLEMENTATION_PLAN_DRIVER.md, option A).
// APP_VARIANT picks the app: commuter (default), driver or gateway. app.json stays the base config
// (the commuter app); each variant overrides only its name, package, scheme, screens and permissions.
//
// Every variant keeps the same native plugins, because every native module is linked into every
// variant: what keeps an app to its own permissions is blockedPermissions, checked on each built APK
// by scripts/check-apk-permissions.ts. Variant-only native behaviour comes from plugins/with*Android.js.

const VARIANTS = ['commuter', 'driver', 'gateway'];

const LOCATION = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
];

// Permissions only the driver or gateway app may hold (SMS, BLE advertising, and the camera: the
// driver's registration photos and the gateway's setup QR)
const DRIVER_SIDE_ONLY = [
  'android.permission.SEND_SMS',
  'android.permission.RECEIVE_SMS',
  'android.permission.READ_SMS',
  'android.permission.BLUETOOTH_ADVERTISE',
  'android.permission.CAMERA',
];

// DR8: only the commuter app scans for the multicab's beacon (plugins/withCommuterBle.js)
// V1b (D6, 2026-11-02): the commuter app also reads the phone's in-vehicle signal during a relay
const COMMUTER_ONLY = ['android.permission.BLUETOOTH_SCAN', 'android.permission.ACTIVITY_RECOGNITION'];

// No app records audio: expo-camera (registration photos in the driver app, QR scanning in the gateway app) is configured
// without it in app.json, and this blocks it in case a library adds it anyway
const NEVER = ['android.permission.RECORD_AUDIO'];

// DR5: the driver app only receives SMS and the gateway app only sends; neither reads the phone's
// own messages. Their plugins add the one each needs; these block the rest in case a library adds them.
const DRIVER_SMS_BLOCKED = ['android.permission.SEND_SMS', 'android.permission.READ_SMS'];
const GATEWAY_SMS_BLOCKED = ['android.permission.RECEIVE_SMS', 'android.permission.READ_SMS'];

// The commuter app is exactly app.json (com.tunton.app, src/app), except that the driver-side
// permissions are blocked, and DR8's Bluetooth scan plugin. B1 (D5, 2026-10-22): it holds background
// location and a location foreground service, used only while a relay is queued or running. The
// driver and gateway apps have no location at all: the system tracks vehicles, not drivers (PRD 3.2,
// 9.1), and the gateway only texts. Neither scans.
const SETTINGS = {
  commuter: {
    blocked: [...DRIVER_SIDE_ONLY, ...NEVER],
    plugin: './plugins/withCommuterBle',
  },
  driver: {
    name: 'Tunton Driver',
    package: 'com.tunton.driver',
    scheme: 'tunton-driver',
    routerRoot: 'src/driver/app',
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    blocked: [...LOCATION, ...DRIVER_SMS_BLOCKED, ...COMMUTER_ONLY, ...NEVER],
    plugin: './plugins/withDriverAndroid',
    // Backlog 128 (2026-10-28): Android's backup restored an old setup on reinstall, without its
    // Keystore keys, so the phone looked set up but could not sign; the driver app is never backed up
    allowBackup: false,
    // Owner, 2026-10-18: the commuter icon with its colours reversed (light square, dark bus)
    icon: './assets/driver-icon.png',
    adaptiveIcon: {
      backgroundColor: '#eef1f8',
      foregroundImage: './assets/driver-adaptive-foreground.png',
      backgroundImage: './assets/driver-adaptive-background.png',
      monochromeImage: './assets/tunton-adaptive-monochrome.png',
    },
  },
  gateway: {
    name: 'Tunton Gateway',
    package: 'com.tunton.gateway',
    scheme: 'tunton-gateway',
    routerRoot: 'src/gateway/app',
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    blocked: [...LOCATION, ...GATEWAY_SMS_BLOCKED, ...COMMUTER_ONLY, ...NEVER],
    plugin: './plugins/withGatewayAndroid',
    // Owner, 2026-10-18: a "G" (Inter Bold, SIL OFL) in the commuter icon's dark style
    icon: './assets/gateway-icon.png',
    adaptiveIcon: {
      backgroundColor: '#14191e',
      foregroundImage: './assets/gateway-adaptive-foreground.png',
      backgroundImage: './assets/tunton-adaptive-background.png',
      monochromeImage: './assets/gateway-adaptive-monochrome.png',
    },
  },
};

function appVariant() {
  const variant = process.env.APP_VARIANT || 'commuter';
  if (!VARIANTS.includes(variant)) {
    throw new Error(`Unknown APP_VARIANT "${variant}". Use one of: ${VARIANTS.join(', ')}.`);
  }
  return variant;
}

module.exports = ({ config }) => {
  const variant = appVariant();
  const settings = SETTINGS[variant];
  const android = config.android ?? {};
  const extra = config.extra ?? {};

  return {
    ...config,
    name: settings.name ?? config.name,
    scheme: settings.scheme ?? config.scheme,
    icon: settings.icon ?? config.icon,
    android: {
      ...android,
      package: settings.package ?? android.package,
      adaptiveIcon: settings.adaptiveIcon ?? android.adaptiveIcon,
      permissions: settings.permissions ?? android.permissions,
      blockedPermissions: settings.blocked,
      allowBackup: settings.allowBackup ?? android.allowBackup,
    },
    plugins: settings.plugin ? [...(config.plugins ?? []), settings.plugin] : config.plugins,
    extra: {
      ...extra,
      appVariant: variant,
      // Which Expo project builds this (2026-11-13). EAS_PROJECT_ID, set in the shell that runs eas, picks
      // another account's project (the commuter tester APK on emzi00); EAS_BUILD_PROJECT_ID is set by the
      // EAS build server to the project being built. Neither set: app.json's project, as before
      eas: { ...extra.eas, projectId: process.env.EAS_PROJECT_ID || process.env.EAS_BUILD_PROJECT_ID || extra.eas?.projectId },
      // Read by the Expo CLI (extra.router.root) to choose the route folder; absent = src/app
      router: settings.routerRoot ? { ...extra.router, root: settings.routerRoot } : extra.router,
    },
  };
};
