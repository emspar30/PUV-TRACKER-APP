// DR3: set up a driver phone for one multicab (PRD 9.5; docs/IMPLEMENTATION_PLAN_DRIVER.md 11.1).
//   npx tsx scripts/provision-driver.ts --vehicle R4-001 --plate "ABC 123" --route R4 --phone 09171234567
// Options: --short-id N (the beacon id; default: the vehicle's, else the next free one),
//          --replace (retire the vehicle's current phone first: a new or reset phone),
//          --gateway-number 0917... (repeatable; adds to the gateway numbers in the database),
//          --note "text" (stored with the device, at most 200 characters).
// Creates or updates the vehicle, gives it a new beacon secret, creates the device with a new SMS key
// (both straight into Vault), asks for the phone's admin PIN, and shows the setup QR in this terminal.

import { parseArgs } from 'node:util';

import { PROVISIONING_QR_TTL_MIN } from '../src/shared/config';
import { normalizePhNumber } from '../src/shared/driver/phone';
import { encodeProvisioning, parseProvisioning, type DriverProvisioning } from '../src/shared/driver/provisioning';

import { adminClient, askAdminPin, expiresAt, fail, randomHex32, showQr } from './admin-common';

type Provisioned = { device_id: string; short_id: number; gateway_numbers: string[] };

async function main() {
  const { values } = parseArgs({
    options: {
      vehicle: { type: 'string' },
      plate: { type: 'string' },
      route: { type: 'string' },
      phone: { type: 'string' },
      'short-id': { type: 'string' },
      replace: { type: 'boolean', default: false },
      'gateway-number': { type: 'string', multiple: true },
      note: { type: 'string' },
    },
  });
  const vehicle = values.vehicle ?? '';
  const plate = (values.plate ?? '').trim();
  const route = values.route ?? '';
  const phone = normalizePhNumber(values.phone ?? '');
  const shortId = values['short-id'] === undefined ? null : Number(values['short-id']);
  if (!/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(vehicle)) fail('--vehicle must be capital letters, digits and dashes, such as R4-001');
  if (plate.length === 0 || plate.length > 16) fail('--plate must be 1 to 16 characters');
  if (!/^R\d{1,2}$/.test(route)) fail('--route must look like R4');
  if (!phone) fail("--phone must be the driver phone's SIM, a Philippine mobile number such as 09171234567");
  if (shortId !== null && !(Number.isInteger(shortId) && shortId >= 1 && shortId <= 65535)) fail('--short-id must be 1 to 65535');
  const extraNumbers = (values['gateway-number'] ?? []).map((raw) => normalizePhNumber(raw) ?? fail(`Not a mobile number: ${raw}`));

  const supabase = adminClient();

  // The QR must name at least one gateway number: check before anything changes
  const gateways = await supabase.from('gateways').select('phone_e164').eq('active', true).not('phone_e164', 'is', null);
  if (gateways.error) fail(`Could not read the gateways: ${gateways.error.message}`);
  if (gateways.data.length === 0 && extraNumbers.length === 0) {
    fail('No gateway yet: run provision-gateway.ts first, or pass --gateway-number for a test.');
  }

  const current = await supabase.from('driver_devices').select('device_id').eq('vehicle_id', vehicle).eq('active', true);
  if (current.error) fail(`Could not read the driver phones: ${current.error.message}`);
  if (current.data.length > 0 && !values.replace) {
    fail(`${vehicle} already has phone ${current.data[0].device_id}. Use --replace to retire it and set up a new one.`);
  }

  const { adminPinHash, adminPinSalt } = await askAdminPin();

  for (const { device_id } of current.data) {
    const retired = await supabase.rpc('admin_retire_device', { device: device_id, new_beacon_secret: null });
    if (retired.error) fail(`Could not retire ${device_id}: ${retired.error.message}`);
    console.log(`Retired ${device_id}.`);
  }

  const beaconSecret = randomHex32();
  const smsKey = randomHex32();
  const result = await supabase
    .rpc('admin_provision_driver', {
      vehicle,
      plate,
      route,
      phone,
      wanted_short_id: shortId,
      beacon_secret: beaconSecret,
      sms_key: smsKey,
      note: values.note ?? null,
    })
    .single<Provisioned>();
  if (result.error) fail(`Could not set up the phone: ${result.error.message}`);
  const { device_id: deviceId, short_id: provisionedShortId, gateway_numbers: dbNumbers } = result.data;

  const { exp, label } = expiresAt(PROVISIONING_QR_TTL_MIN);
  const payload: DriverProvisioning = {
    v: 1,
    kind: 'driver',
    exp,
    adminPinHash,
    adminPinSalt,
    deviceId,
    vehicleId: vehicle,
    shortId: provisionedShortId,
    routeCode: route,
    plate,
    beaconSecret,
    smsKey,
    gatewayNumbers: [...new Set([...dbNumbers, ...extraNumbers])],
  };
  const check = parseProvisioning(encodeProvisioning(payload), 'driver', Date.now());
  if (!check.ok) fail(`Setup code invalid (${check.reason}); the device ${deviceId} was created: retire it with retire-device.ts.`);

  console.log(`\n${deviceId} set up for ${vehicle} (${plate}, ${route}), beacon id ${provisionedShortId}, texts from ${payload.gatewayNumbers.join(', ')}.`);
  console.log(`Scan this with Tunton Driver. Valid until ${label} (Manila).\n`);
  showQr(encodeProvisioning(payload));
  console.log('\nClose this terminal window once it is scanned: the code holds the phone\'s secrets.');
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
