// DR4: the beacon's status in words, and the module wrapper where no native module is built in (Jest).

import { strings } from '@/strings';

import { beaconOptions, describeBeacon } from '../features/beacon/beacon';
import { getStatus, getSupport, isBeaconAvailable, isProvisioned, NOT_AVAILABLE, provision, type BeaconStatus } from '../../../modules/tunton-beacon';
import { BEACON_PAYLOAD_VERSION, BEACON_SERVICE_UUID, BEACON_SLOT_S } from '@/shared/config';

const status = (overrides: Partial<BeaconStatus>): BeaconStatus => ({ ...NOT_AVAILABLE, lastError: null, ...overrides });

describe('beacon status in words (DR4)', () => {
  it('says the beacon is on while advertising', () => {
    expect(describeBeacon(status({ enabled: true, advertising: true }))).toEqual({ tone: 'ok', label: strings.driver.beaconOn });
  });

  it('says it is starting, or off, without an error', () => {
    expect(describeBeacon(status({ enabled: true }))).toEqual({ tone: 'warn', label: strings.driver.beaconStarting });
    expect(describeBeacon(status({ enabled: false }))).toEqual({ tone: 'warn', label: strings.driver.beaconOff });
  });

  it('names the problem in plain words', () => {
    expect(describeBeacon(status({ enabled: true, lastError: 'bluetooth_off' })).label).toBe(strings.driver.beaconError.bluetooth_off);
    expect(describeBeacon(status({ enabled: true, lastError: 'not_supported' })).label).toBe(strings.driver.beaconError.not_supported);
    expect(describeBeacon(status({ enabled: true, lastError: 'advertise_failed_3' }))).toEqual({ tone: 'bad', label: strings.driver.beaconError.other });
  });

  it('starts the beacon with the settings from shared/config', () => {
    expect(beaconOptions()).toMatchObject({ serviceUuid: BEACON_SERVICE_UUID, version: BEACON_PAYLOAD_VERSION, slotSeconds: BEACON_SLOT_S });
  });
});

describe('beacon module without native code (DR4)', () => {
  it('reports "not available" instead of throwing', async () => {
    expect(isBeaconAvailable()).toBe(false);
    expect(isProvisioned()).toBe(false);
    expect(getStatus()).toEqual(NOT_AVAILABLE);
    expect(getSupport()).toEqual({ bluetooth: false, bluetoothOn: false, advertising: null });
    expect(describeBeacon(getStatus()).label).toBe(strings.driver.beaconError.not_available);
    expect(() => provision(1, 'a'.repeat(64), 'b'.repeat(64))).toThrow(/not in this build/);
  });
});
