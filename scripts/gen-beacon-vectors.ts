// DR2: writes tests/fixtures/beacon-vectors.json, the beacon test vectors shared by Jest
// (src/shared/beacon/code.ts), Kotlin (the driver phone, DR4) and SQL (verify_beacon, DR8).
//   npx tsx scripts/gen-beacon-vectors.ts
// The secrets are made up and derived from fixed text, so the output is the same every run; they
// are test values only and never used by a real vehicle. The output is committed; rerun only if the
// payload format changes (then BEACON_PAYLOAD_VERSION changes too).

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { encodeBeacon, payloadToHex } from '../src/shared/beacon/code';
import { BEACON_PAYLOAD_VERSION, BEACON_SLOT_S } from '../src/shared/config';

// [shortId, slot]: the edges of both fields, slots either side of the 16-bit wrap, and 2026-like slots
const CASES: [number, number][] = [
  [1, 0],
  [1, 1],
  [2, 65535],
  [255, 65536],
  [256, 65537],
  [513, 131071],
  [4660, 29600000],
  [4660, 29600001],
  [65535, 29600002],
  [42, 29627000],
  [7, 12345678],
  [100, 4294967295],
];

const vectors = CASES.map(([shortId, slot], index) => {
  const secretHex = createHash('sha256').update(`tunton-beacon-test-vector-${index}`).digest('hex');
  return { secretHex, shortId, slot, payloadHex: payloadToHex(encodeBeacon({ shortId, slot }, secretHex)) };
});

const out = {
  _comment:
    'Beacon test vectors (docs/IMPLEMENTATION_PLAN_DRIVER.md 6.1). Test secrets only. payload = version | shortId | slot & 0xFFFF | first 4 bytes of HMAC-SHA256(secret, version | shortId | slot as uint32), big-endian. Written by scripts/gen-beacon-vectors.ts.',
  version: BEACON_PAYLOAD_VERSION,
  slotSeconds: BEACON_SLOT_S,
  vectors,
};

const file = path.join(__dirname, '..', 'tests', 'fixtures', 'beacon-vectors.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${vectors.length} vectors to ${path.relative(process.cwd(), file)}`);
