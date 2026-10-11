import * as fs from 'node:fs';
import * as path from 'node:path';

import { aaptPermissions, checkPermissions, manifestPermissions } from '../variants/permissions';

const RULES = {
  required: ['android.permission.POST_NOTIFICATIONS'],
  allowed: ['android.permission.INTERNET', '{package}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'],
  forbidden: ['android.permission.ACCESS_FINE_LOCATION'],
};
const PKG = 'com.tunton.driver';

describe('checkPermissions (DR1)', () => {
  it('passes a reviewed list, with {package} expanded', () => {
    const found = ['android.permission.POST_NOTIFICATIONS', 'android.permission.INTERNET', 'com.tunton.driver.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'];
    expect(checkPermissions(found, RULES, PKG)).toEqual({ ok: true, forbidden: [], missing: [], unreviewed: [] });
  });

  it('fails on a forbidden permission, even if it is also allowed', () => {
    const result = checkPermissions(['android.permission.POST_NOTIFICATIONS', 'android.permission.ACCESS_FINE_LOCATION'], { ...RULES, allowed: [...RULES.allowed, 'android.permission.ACCESS_FINE_LOCATION'] }, PKG);
    expect(result.ok).toBe(false);
    expect(result.forbidden).toEqual(['android.permission.ACCESS_FINE_LOCATION']);
    expect(result.unreviewed).toEqual([]);
  });

  it('fails on a missing required permission', () => {
    expect(checkPermissions(['android.permission.INTERNET'], RULES, PKG)).toMatchObject({ ok: false, missing: ['android.permission.POST_NOTIFICATIONS'] });
  });

  it('fails on a permission nobody has reviewed', () => {
    expect(checkPermissions(['android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE'], RULES, PKG)).toMatchObject({
      ok: false,
      unreviewed: ['android.permission.VIBRATE'],
    });
  });

  it('does not let another package stand in for {package}', () => {
    const result = checkPermissions(['android.permission.POST_NOTIFICATIONS', 'com.tunton.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'], RULES, PKG);
    expect(result.unreviewed).toEqual(['com.tunton.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION']);
  });
});

describe('reading permission lists', () => {
  it('reads a merged manifest and skips the removed ones', () => {
    const xml = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
      <uses-permission android:name="android.permission.INTERNET" />
      <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove" />
      <uses-permission
          android:name="android.permission.POST_NOTIFICATIONS" />
      <uses-permission-sdk-23 android:name="android.permission.CAMERA" />
      <uses-permission android:name="android.permission.INTERNET" />
    </manifest>`;
    expect(manifestPermissions(xml).sort()).toEqual(['android.permission.CAMERA', 'android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS']);
  });

  it('reads aapt2 output', () => {
    const output = "package: com.tunton.driver\nuses-permission: name='android.permission.INTERNET'\nuses-permission: name='android.permission.BLUETOOTH' maxSdkVersion='30'\n";
    expect(aaptPermissions(output)).toEqual(['android.permission.INTERNET', 'android.permission.BLUETOOTH']);
  });

  it('keeps the rules file well formed: three variants, nothing both allowed and forbidden', () => {
    const file = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'scripts', 'variant-permissions.json'), 'utf8'));
    expect(Object.keys(file).filter((key) => !key.startsWith('_')).sort()).toEqual(['commuter', 'driver', 'gateway']);
    for (const variant of ['commuter', 'driver', 'gateway']) {
      const { required, allowed, forbidden } = file[variant];
      const both = [...required, ...allowed].filter((name: string) => forbidden.includes(name));
      expect(both).toEqual([]);
    }
  });
});
