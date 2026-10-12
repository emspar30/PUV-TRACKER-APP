// DR1: app.config.js turns app.json into three apps. The commuter app must stay what it was;
// the driver and gateway apps get their own package, screens and plugin, and no location.

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.join(__dirname, '..', '..', '..');

type ExpoConfig = {
  name: string;
  scheme: string;
  plugins: (string | [string, unknown])[];
  android: { package: string; permissions: string[]; blockedPermissions?: string[] };
  extra: { appVariant?: string; router?: { root?: string } };
};

const base: ExpoConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
const makeConfig = jest.requireActual<(input: { config: ExpoConfig }) => ExpoConfig>(path.join(ROOT, 'app.config.js'));

function configFor(variant: string | undefined): ExpoConfig {
  const saved = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    // A deep copy, so one variant cannot change the base another one sees
    return makeConfig({ config: JSON.parse(JSON.stringify(base)) });
  } finally {
    if (saved === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = saved;
  }
}

const LOCATION = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
];
const DRIVER_SIDE_ONLY = [
  'android.permission.SEND_SMS',
  'android.permission.RECEIVE_SMS',
  'android.permission.READ_SMS',
  'android.permission.BLUETOOTH_ADVERTISE',
  'android.permission.CAMERA',
];
const pluginNames = (config: ExpoConfig) => config.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));

describe('app variants (DR1)', () => {
  it('defaults to the commuter app when APP_VARIANT is not set', () => {
    expect(configFor(undefined).extra.appVariant).toBe('commuter');
  });

  it('keeps the commuter app as app.json, apart from the variant tag and the blocked driver-side permissions', () => {
    const commuter = configFor('commuter');
    const { blockedPermissions, ...android } = commuter.android;
    const { blockedPermissions: baseBlocked, ...baseAndroid } = base.android;
    const { appVariant, ...extra } = commuter.extra;

    expect(appVariant).toBe('commuter');
    expect({ ...commuter, android, extra }).toEqual({ ...base, android: baseAndroid });
    expect(blockedPermissions).toEqual(expect.arrayContaining([...(baseBlocked ?? []), ...DRIVER_SIDE_ONLY]));
    expect(commuter.extra.router?.root).toBeUndefined();
  });

  it.each([
    ['driver', 'Tunton Driver', 'com.tunton.driver', 'tunton-driver', 'src/driver/app', './plugins/withDriverAndroid'],
    ['gateway', 'Tunton Gateway', 'com.tunton.gateway', 'tunton-gateway', 'src/gateway/app', './plugins/withGatewayAndroid'],
  ])('builds the %s app as its own app with its own screens', (variant, name, androidPackage, scheme, root, plugin) => {
    const config = configFor(variant);
    expect(config.name).toBe(name);
    expect(config.android.package).toBe(androidPackage);
    expect(config.scheme).toBe(scheme);
    expect(config.extra.router?.root).toBe(root);
    expect(config.extra.appVariant).toBe(variant);
    expect(pluginNames(config)).toEqual([...pluginNames(base), plugin]);
  });

  it.each(['driver', 'gateway'])('blocks every location permission in the %s app (PRD 3.2, 9.1)', (variant) => {
    expect(configFor(variant).android.blockedPermissions).toEqual(expect.arrayContaining(LOCATION));
  });

  it.each(['commuter', 'driver', 'gateway'])('blocks the microphone in the %s app (DR4: the camera only scans QR codes)', (variant) => {
    expect(configFor(variant).android.blockedPermissions).toContain('android.permission.RECORD_AUDIO');
    const camera = configFor(variant).plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-camera');
    expect(camera).toEqual(['expo-camera', { recordAudioAndroid: false }]);
  });

  it('gives every variant the same native plugins, so the native modules link the same way', () => {
    const shared = pluginNames(base);
    for (const variant of ['commuter', 'driver', 'gateway']) {
      expect(pluginNames(configFor(variant)).slice(0, shared.length)).toEqual(shared);
    }
  });

  it('refuses an unknown variant', () => {
    expect(() => configFor('drivers')).toThrow(/Unknown APP_VARIANT/);
  });
});
