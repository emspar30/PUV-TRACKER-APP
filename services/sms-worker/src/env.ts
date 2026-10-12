// DR6: the worker's settings. Read from the process environment, then services/sms-worker/.env, then
// the repository's .env (where EXPO_PUBLIC_SUPABASE_URL stands in for SUPABASE_URL), the first that
// has a value winning. Both .env files are git-ignored. The worker refuses to start without one of
// the required values, and never prints any of them: the service role key bypasses every database rule.
//   SUPABASE_URL               the project URL
//   SUPABASE_SERVICE_ROLE_KEY  the service role key (secret)
//   SMS_PRIMARY_ENCODING       data or text: chosen with the DR5 carrier test (DR5-M5)
//   PORT                       optional, WORKER_DEFAULT_PORT by default

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseEnv } from 'node:util';

import { WORKER_DEFAULT_PORT } from '../../../src/shared/config';
import type { HeatmapEncoding } from '../../../src/shared/sms/pack';

export type WorkerEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
  encoding: HeatmapEncoding;
  port: number;
};

const WORKER_ENV = path.join(__dirname, '..', '.env');
const ROOT_ENV = path.join(__dirname, '..', '..', '..', '.env');
const PORT_MAX = 65535;

function readFile(file: string): Record<string, string | undefined> {
  return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
}

export class EnvError extends Error {}

// sources: the environments to look in, first wins (process.env and the two files by default)
export function readWorkerEnv(sources: Record<string, string | undefined>[] = [process.env, readFile(WORKER_ENV), readFile(ROOT_ENV)]): WorkerEnv {
  const get = (...names: string[]) => {
    for (const source of sources) {
      for (const name of names) {
        const value = source[name]?.trim();
        if (value) return value;
      }
    }
    return undefined;
  };
  const supabaseUrl = get('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = get('SUPABASE_SERVICE_ROLE_KEY');
  const encoding = get('SMS_PRIMARY_ENCODING');
  const portText = get('PORT');

  const missing = [!supabaseUrl && 'SUPABASE_URL', !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY', !encoding && 'SMS_PRIMARY_ENCODING'].filter(Boolean);
  if (missing.length > 0) throw new EnvError(`Missing: ${missing.join(', ')} (see services/sms-worker/README.md)`);
  if (encoding !== 'data' && encoding !== 'text') throw new EnvError('SMS_PRIMARY_ENCODING must be data or text');
  if (!/^https:\/\//.test(supabaseUrl as string)) throw new EnvError('SUPABASE_URL must start with https://');
  const port = portText === undefined ? WORKER_DEFAULT_PORT : Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > PORT_MAX) throw new EnvError('PORT must be a number from 1 to 65535');

  return { supabaseUrl: supabaseUrl as string, serviceRoleKey: serviceRoleKey as string, encoding, port };
}
