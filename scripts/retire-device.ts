// DR3: retire a driver phone: lost, stolen, replaced, or the pilot is over (runbook 11.5).
//   npx tsx scripts/retire-device.ts DRV-0001
// The phone gets no more heatmap texts, its queued texts expire, its SMS key is overwritten in Vault,
// and its vehicle gets a new beacon secret that nobody holds, so beacon codes from the old phone stop
// validating at once. Set up a replacement with provision-driver.ts (it makes another new secret).

import { adminClient, askYes, fail, randomHex32 } from './admin-common';

async function main() {
  const device = process.argv[2] ?? '';
  if (!/^DRV-\d{4}$/.test(device)) fail('Usage: npx tsx scripts/retire-device.ts DRV-0001');

  const supabase = adminClient();
  const found = await supabase.from('driver_devices').select('vehicle_id, active').eq('device_id', device).maybeSingle();
  if (found.error) fail(`Could not read ${device}: ${found.error.message}`);
  if (!found.data) fail(`${device} does not exist.`);
  if (!found.data.active) fail(`${device} is already retired.`);

  if (!(await askYes(`Retire ${device} (vehicle ${found.data.vehicle_id})? It stops receiving texts at once.`))) fail('Nothing changed.');

  const { data, error } = await supabase.rpc('admin_retire_device', { device, new_beacon_secret: randomHex32() });
  if (error) fail(`Could not retire ${device}: ${error.message}`);
  if (!data) fail(`${device} was not active; nothing changed.`);
  console.log(`${device} retired; vehicle ${found.data.vehicle_id} has a new beacon secret.`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
