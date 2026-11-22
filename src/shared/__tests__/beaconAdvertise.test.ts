// Phase 5: the driver beacon's advertising settings, and that the native module knows every value.

import fs from 'node:fs';
import path from 'node:path';

import { advertiseSettings } from '../beacon/advertise';
import { BEACON_LOW_POWER } from '../config';

const SERVICE = fs.readFileSync(
  path.join(__dirname, '../../../modules/tunton-beacon/android/src/main/java/expo/modules/tuntonbeacon/BeaconAdvertiserService.kt'),
  'utf8',
);

describe('beacon advertising settings', () => {
  it('keeps the tested settings as the default until the low-power retest passes', () => {
    expect(BEACON_LOW_POWER).toBe(false);
    expect(advertiseSettings(false)).toEqual({ mode: 'balanced', txPower: 'medium' });
  });

  it('offers about 1 s at low power as the setting to retest', () => {
    expect(advertiseSettings(true)).toEqual({ mode: 'low_power', txPower: 'low' });
  });

  it('uses only values the native module maps (no native change needed to switch)', () => {
    for (const lowPower of [false, true]) {
      const { mode, txPower } = advertiseSettings(lowPower);
      if (mode !== 'balanced') expect(SERVICE).toContain(`"${mode}" ->`);
      if (txPower !== 'medium') expect(SERVICE).toContain(`"${txPower}" ->`);
    }
    // balanced and medium are the native defaults (the else branches)
    expect(SERVICE).toContain('else -> AdvertisingSetParameters.INTERVAL_MEDIUM');
    expect(SERVICE).toContain('else -> AdvertisingSetParameters.TX_POWER_MEDIUM');
  });
});
