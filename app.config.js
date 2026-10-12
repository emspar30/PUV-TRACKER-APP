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

// Permissions only the driver or gateway app may hold (SMS, BLE advertising, QR camera)
const DRIVER_SIDE_ONLY = [
  'android.permission.SEND_SMS',
  'android.permission.RECEIVE_SMS',
  'android.permission.READ_SMS',
  'android.permission.BLUETOOTH_ADVERTISE',
  'android.permission.CAMERA',
];

// No app records audio: expo-camera (QR scanning in the driver and gateway apps) is configured
// without it in app.json, and this blocks it in case a library adds it anyway
const NEVER = ['android.permission.RECORD_AUDIO'];

// DR5: the driver app only receives SMS and the gateway app only sends; neither reads the phone's
// own messages. Their plugins add the one each needs; these block the rest in case a library adds them.
const DRIVER_SMS_BLOCKED = ['android.permission.SEND_SMS', 'android.permission.READ_SMS'];
const GATEWAY_SMS_BLOCKED = ['android.permission.RECEIVE_SMS', 'android.permission.READ_SMS'];

// The commuter app is exactly app.json (com.tunton.app, src/app), except that the driver-side
// permissions are blocked as well as background location. The driver and gateway apps have no
// location at all: the system tracks vehicles, not drivers (PRD 3.2, 9.1), and the gateway only texts.
const SETTINGS = {
  commuter: {
    blocked: ['android.permission.ACCESS_BACKGROUND_LOCATION', ...DRIVER_SIDE_ONLY, ...NEVER],
  },
  driver: {
    name: 'Tunton Driver',
    package: 'com.tunton.driver',
    scheme: 'tunton-driver',
    routerRoot: 'src/driver/app',
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    blocked: [...LOCATION, ...DRIVER_SMS_BLOCKED, ...NEVER],
    plugin: './plugins/withDriverAndroid',
  },
  gateway: {
    name: 'Tunton Gateway',
    package: 'com.tunton.gateway',
    scheme: 'tunton-gateway',
    routerRoot: 'src/gateway/app',
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    blocked: [...LOCATION, ...GATEWAY_SMS_BLOCKED, ...NEVER],
    plugin: './plugins/withGatewayAndroid',
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
    android: {
      ...android,
      package: settings.package ?? android.package,
      permissions: settings.permissions ?? android.permissions,
      blockedPermissions: settings.blocked,
    },
    plugins: settings.plugin ? [...(config.plugins ?? []), settings.plugin] : config.plugins,
    extra: {
      ...extra,
      appVariant: variant,
      // Read by the Expo CLI (extra.router.root) to choose the route folder; absent = src/app
      router: settings.routerRoot ? { ...extra.router, root: settings.routerRoot } : extra.router,
    },
  };
};
