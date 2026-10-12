// DR5: a development setup code for a driver phone, for the heatmap tests (DR5-M1 to M6) before the
// SMS worker exists. Nothing is written to the database: the vehicle, beacon id and secrets are made
// up here, so the beacon's codes validate nowhere and the worker never texts this phone. It prints the
// SMS key (a development key, never a real phone's) for the gateway's carrier test and sms-sign.ts.
//   npx tsx scripts/dev-driver-qr.ts --route R4 --gateway-number 09171234567
// Options: --plate "TEST 001", --key <64 hex> (default: a new random key).
// Set the phone up again with provision-driver.ts before it carries passengers.

import { parseArgs } from 'node:util';

import { PROVISIONING_QR_TTL_MIN } from '../src/shared/config';
import { normalizePhNumber } from '../src/shared/driver/phone';
import { encodeProvisioning, parseProvisioning, type DriverProvisioning } from '../src/shared/driver/provisioning';

import { askAdminPin, expiresAt, fail, randomHex32, showQr } from './admin-common';

// Beacon ids from here up are never given to a real vehicle (provision-driver.ts counts up from 1)
const DEV_SHORT_ID = 65000;

async function main() {
  const { values } = parseArgs({
    options: {
      route: { type: 'string' },
      plate: { type: 'string', default: 'TEST 001' },
      'gateway-number': { type: 'string', multiple: true },
      key: { type: 'string' },
    },
  });
  const route = values.route ?? '';
  const plate = (values.plate ?? '').trim();
  const numbers = (values['gateway-number'] ?? []).map((raw) => normalizePhNumber(raw));
  const smsKey = (values.key ?? randomHex32()).toLowerCase();
  if (!/^R\d{1,2}$/.test(route)) fail('--route must look like R4');
  if (plate.length === 0 || plate.length > 16) fail('--plate must be 1 to 16 characters');
  if (numbers.length === 0 || numbers.some((number) => number === null)) {
    fail('--gateway-number must be a Philippine mobile number such as 09171234567 (the phone that sends the test texts)');
  }
  if (!/^[0-9a-f]{64}$/.test(smsKey)) fail('--key must be 64 hex characters');

  const { adminPinHash, adminPinSalt } = await askAdminPin();
  const { exp, label } = expiresAt(PROVISIONING_QR_TTL_MIN);
  const payload: DriverProvisioning = {
    v: 1,
    kind: 'driver',
    exp,
    adminPinHash,
    adminPinSalt,
    deviceId: 'DRV-9000',
    vehicleId: `DEV-${route}`,
    shortId: DEV_SHORT_ID,
    routeCode: route,
    plate,
    beaconSecret: randomHex32(),
    smsKey,
    gatewayNumbers: numbers as string[],
  };
  const check = parseProvisioning(encodeProvisioning(payload), 'driver', Date.now());
  if (!check.ok) fail(`Setup code invalid (${check.reason}).`);

  console.log(`\nDevelopment setup code for ${route} (${plate}), texts from ${payload.gatewayNumbers.join(', ')}. Nothing was saved.`);
  console.log(`SMS key (development only): ${smsKey}`);
  console.log(`Scan this with Tunton Driver. Valid until ${label} (Manila).\n`);
  showQr(encodeProvisioning(payload));
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
