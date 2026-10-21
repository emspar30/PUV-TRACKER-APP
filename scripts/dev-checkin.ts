// DR6: a commuter check-in from the PC, for the worker tests without an emulator (DR6-M1, M2, M4).
//   npx tsx scripts/dev-checkin.ts --route R4 --station SMB     (check in, as the team test account)
//   npx tsx scripts/dev-checkin.ts --end                        ("I boarded": end the check-in)
// Signs in as TEST_WRITER_EMAIL from .env (the account the live tests use) and calls the same
// functions as the commuter app (check_in_routes, end_check_in), so it counts like a real check-in
// on the live project until it ends or expires.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs, parseEnv } from 'node:util';

import { createClient } from '@supabase/supabase-js';

import { fail } from './admin-common';

const ENV_FILE = path.join(__dirname, '..', '.env');

async function main() {
  const { values } = parseArgs({ options: { route: { type: 'string' }, station: { type: 'string' }, end: { type: 'boolean', default: false } } });
  const env: Record<string, string | undefined> = fs.existsSync(ENV_FILE) ? parseEnv(fs.readFileSync(ENV_FILE, 'utf8')) : {};
  const names = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'TEST_WRITER_EMAIL', 'TEST_WRITER_PASSWORD'];
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) fail(`Missing in .env: ${missing.join(', ')}`);
  if (!values.end && (!/^R\d{1,2}$/.test(values.route ?? '') || !/^[A-Z0-9]{2,8}$/.test(values.station ?? ''))) {
    fail('Usage: --route R4 --station SMB, or --end');
  }

  const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL as string, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await supabase.auth.signInWithPassword({ email: env.TEST_WRITER_EMAIL as string, password: env.TEST_WRITER_PASSWORD as string });
  if (signIn.error) fail(`Sign-in failed: ${signIn.error.message}`);

  if (values.end) {
    const { error } = await supabase.rpc('end_check_in');
    if (error) fail(`Could not end the check-in: ${error.message}`);
    console.log('Check-in ended.');
  } else {
    const { data, error } = await supabase.rpc('check_in_routes', { routes: [values.route], station: values.station, request_key: randomUUID() });
    if (error) fail(`Could not check in: ${error.message}`);
    console.log(`Checked in at ${values.station} on ${values.route} until ${new Date(data as string).toLocaleTimeString()}.`);
  }
  await supabase.auth.signOut();
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
