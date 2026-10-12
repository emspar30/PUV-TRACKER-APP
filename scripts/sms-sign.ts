// DR5: print a signed heatmap message for the driver-phone tests (DR5-M1 to M4), signed the way the
// SMS worker will sign it (DR6). Use a development key only (from dev-driver-qr.ts), never a real
// phone's: this script reads no database and the key is typed on the command line.
//   npx tsx scripts/sms-sign.ts --route R4 --seq 12 --key <64 hex> SMB:3,ZAM:0
// Options: --minutes-ago N (sign it as if sent N minutes ago, for the stale_time test).
// Prints the text (send it with `adb emu sms send <gateway number> "<text>"` on an emulator, or from
// the gateway phone) and the same message as data-SMS hex with its size.

import { parseArgs } from 'node:util';

import { SMS_SEQ_MODULUS } from '../src/shared/config';
import { buildTestHeatmap, parseNodeList } from '../src/shared/sms/testMessage';

const MS_PER_MIN = 60_000;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      route: { type: 'string' },
      seq: { type: 'string' },
      key: { type: 'string' },
      'minutes-ago': { type: 'string', default: '0' },
    },
  });
  const route = values.route ?? '';
  const seq = Number(values.seq);
  const key = (values.key ?? '').toLowerCase();
  const minutesAgo = Number(values['minutes-ago']);
  const nodes = parseNodeList(positionals.join(','));
  if (!/^R\d{1,2}$/.test(route)) fail('--route must look like R4');
  if (!Number.isInteger(seq) || seq < 0 || seq >= SMS_SEQ_MODULUS) fail(`--seq must be 0 to ${SMS_SEQ_MODULUS - 1}`);
  if (!/^[0-9a-f]{64}$/.test(key)) fail('--key must be 64 hex characters (the development key from dev-driver-qr.ts)');
  if (!Number.isFinite(minutesAgo)) fail('--minutes-ago must be a number');
  if (!nodes) fail('Give the stops as CODE:count,CODE:count, such as SMB:3,ZAM:0');

  const message = buildTestHeatmap(route, seq, nodes, Date.now() - minutesAgo * MS_PER_MIN, key);
  console.log(message.text);
  console.log(`\n${message.septets} septets as text; as data SMS (${message.bytes} bytes): ${message.dataHex}`);
}

main();
