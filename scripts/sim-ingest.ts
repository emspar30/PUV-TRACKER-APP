// Development simulator (L1): drives the seeded test vehicles along their stored route with the AF3
// simulation and sends each position through the ingest Edge Function, as a broadcasting phone would.
// It signs in as the team test account from .env (TEST_WRITER_EMAIL and TEST_WRITER_PASSWORD) and
// prints only vehicle ids and results, never a key, password or token.
// Run on the PC with the installed tsx:
//   npx tsx scripts/sim-ingest.ts              R4-TEST-01 and R4-TEST-02 on R4, for 10 minutes
//   npx tsx scripts/sim-ingest.ts --minutes 30
//   npx tsx scripts/sim-ingest.ts --parked     each vehicle stays where it is at the start, speed 0
// At night (21:00 to 04:59 Manila, PRD 10.4) the server shows only stopped vehicles, so moving
// ones vanish from the Live tab by design; --parked keeps them visible for checking the markers.
// Stop it with Ctrl+C. The Live tab shows these vehicles with Settings, Demo data turned off.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseEnv } from 'node:util';

import { createClient } from '@supabase/supabase-js';

import { DEMO_SEED, SIM_INGEST_INTERVAL_S } from '../src/shared/config';
import { demoFleetConfig, planDemoFleet, positionAt } from '../src/shared/demo/simulate';
import type { DirectedLine } from '../src/shared/routing/types';
import { encodePacket } from '../src/shared/telemetry/packet';
import { SEED_LINES } from '../src/data/seed/routes';

const ROUTE = 'R4';
const VEHICLES = ['R4-TEST-01', 'R4-TEST-02'];
const DEFAULT_MINUTES = 10;
const S_PER_MIN = 60;
const MS_PER_S = 1000;
const FULL_TURN_DEG = 360;

const envFile = path.join(__dirname, '..', '.env');
const env: Record<string, string | undefined> = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'TEST_WRITER_EMAIL', 'TEST_WRITER_PASSWORD'];
const missing = required.filter((name) => !env[name]);
if (missing.length > 0) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

const minutesArg = process.argv.indexOf('--minutes');
const minutes = minutesArg >= 0 ? Number(process.argv[minutesArg + 1]) : DEFAULT_MINUTES;
const parked = process.argv.includes('--parked');

const lines: DirectedLine[] = SEED_LINES.filter((line) => line.routeCode === ROUTE).map((line) => ({
  id: `${line.routeId}`,
  routeCode: line.routeCode,
  direction: line.direction,
  directionMode: line.directionMode,
  name: line.routeName,
  color: line.routeColor,
  coordinates: line.coordinates,
  fare: { baseFare: line.baseFare, baseKm: line.baseKm, perKmRate: line.perKmRate },
}));

async function main() {
  const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL!, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: true },
  });
  const signIn = await supabase.auth.signInWithPassword({ email: env.TEST_WRITER_EMAIL!, password: env.TEST_WRITER_PASSWORD! });
  if (signIn.error) {
    console.error(`Sign-in failed: ${signIn.error.message}`);
    process.exit(1);
  }

  // The AF3 plans, one per test vehicle, without the silent spell (these vehicles always send)
  const plans = planDemoFleet(lines, [], demoFleetConfig(DEMO_SEED), { routeCodes: [ROUTE], perRoute: VEHICLES.length });
  const endMs = Date.now() + minutes * S_PER_MIN * MS_PER_S;
  const startS = Math.floor(Date.now() / MS_PER_S);
  console.log(`Sending ${VEHICLES.join(', ')} on ${ROUTE}${parked ? ' (parked)' : ''} every ${SIM_INGEST_INTERVAL_S} s for ${minutes} min. Ctrl+C stops.`);

  const send = async () => {
    const nowS = Math.floor(Date.now() / MS_PER_S);
    const results = await Promise.all(
      VEHICLES.map(async (vehicleId, index) => {
        const at = positionAt(plans[index % plans.length], parked ? startS : nowS);
        const packet = {
          vehicle_id: vehicleId,
          lat: at.lat,
          lon: at.lon,
          speed: parked ? 0 : Math.round(at.speedKmh * 10) / 10,
          heading: Math.floor(at.headingDeg) % FULL_TURN_DEG,
          seats: at.seats,
          ts: nowS,
        };
        const { data, error } = await supabase.functions.invoke('ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: encodePacket(packet),
        });
        return `${vehicleId} ${error ? `error: ${error.message}` : (data?.status ?? 'unexpected')}`;
      }),
    );
    console.log(`${new Date().toISOString().slice(11, 19)}  ${results.join('  ')}`);
  };

  await send();
  const timer = setInterval(() => {
    if (Date.now() >= endMs) {
      clearInterval(timer);
      // Local only, so the app signed in with the same test account stays signed in
      void supabase.auth.signOut({ scope: 'local' }).then(() => console.log('Done.'));
      return;
    }
    void send();
  }, SIM_INGEST_INTERVAL_S * MS_PER_S);
}

void main();
