// DR3: set up (or re-key) the gateway phone (PRD 9.6; docs/IMPLEMENTATION_PLAN_DRIVER.md 11.3).
//   npx tsx scripts/provision-gateway.ts --gateway GW-01 --phone 09171234567 --worker-url https://<tunnel>
//   npx tsx scripts/provision-gateway.ts --gateway GW-01 --phone 09171234567 --worker-url http://localhost:8787   (development over USB)
// Makes a new access token (the old one, if any, stops working at once), stores only its SHA-256,
// asks for the phone's admin PIN, and shows the setup QR in this terminal for the gateway app to scan.
// Provision the gateway before the driver phones: their QR carries the gateway's number.

import { createHash, randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';

import { PROVISIONING_QR_TTL_MIN } from '../src/shared/config';
import { normalizePhNumber } from '../src/shared/driver/phone';
import { encodeProvisioning, parseProvisioning, type GatewayProvisioning } from '../src/shared/driver/provisioning';

import { adminClient, askAdminPin, expiresAt, fail, showQr } from './admin-common';

async function main() {
  const { values } = parseArgs({
    options: { gateway: { type: 'string' }, phone: { type: 'string' }, 'worker-url': { type: 'string' } },
  });
  const gatewayId = values.gateway ?? '';
  const phone = normalizePhNumber(values.phone ?? '');
  const workerUrl = values['worker-url'] ?? '';
  if (!/^GW-\d{2}$/.test(gatewayId)) fail('--gateway must look like GW-01');
  if (!phone) fail('--phone must be the gateway SIM, a Philippine mobile number such as 09171234567');

  const supabase = adminClient();
  const { adminPinHash, adminPinSalt } = await askAdminPin();
  // 32 random bytes as base64url: 43 characters
  const token = randomBytes(32).toString('base64url');
  const { exp, label } = expiresAt(PROVISIONING_QR_TTL_MIN);
  const payload: GatewayProvisioning = { v: 1, kind: 'gateway', exp, adminPinHash, adminPinSalt, gatewayId, workerUrl, token };

  // Check the code the app will read before anything changes in the database
  const check = parseProvisioning(encodeProvisioning(payload), 'gateway', Date.now());
  if (!check.ok) fail(check.reason === 'insecure_url' ? '--worker-url must be https:// (or http://localhost for development)' : `Setup code invalid: ${check.reason}`);

  const hash = createHash('sha256').update(token).digest('hex');
  const { error } = await supabase.rpc('admin_provision_gateway', { gateway: gatewayId, hash, phone });
  if (error) fail(`Could not save the gateway: ${error.message}`);

  console.log(`\nGateway ${gatewayId} (${phone}) saved. Scan this with Tunton Gateway, Set up. Valid until ${label} (Manila).\n`);
  showQr(encodeProvisioning(payload));
  console.log('\nClose this terminal window once it is scanned: the code holds the access token.');
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
