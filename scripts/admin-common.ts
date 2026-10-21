// DR3: what the admin scripts share (provision-driver, provision-gateway, retire-device). They run on
// Emjay's PC with the service role key from .env, which bypasses every database rule: it is read here
// and never printed, logged or sent anywhere but the project's own URL. No secret is ever printed
// either, except inside the setup QR, which is shown in this terminal only and never saved.

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseEnv } from 'node:util';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import qrcode from 'qrcode-terminal';

import { ADMIN_PIN_DIGITS } from '../src/shared/config';
import { hashAdminPin, isValidPin } from '../src/shared/driver/provisioning';

const ENV_FILE = path.join(__dirname, '..', '.env');

export function adminClient(): SupabaseClient {
  const env: Record<string, string | undefined> = fs.existsSync(ENV_FILE) ? parseEnv(fs.readFileSync(ENV_FILE, 'utf8')) : {};
  const missing = ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !env[name]);
  if (missing.length > 0) fail(`Missing in .env: ${missing.join(', ')}`);
  return createClient(env.EXPO_PUBLIC_SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// 32 random bytes as 64 lower-case hex characters (beacon secrets, SMS keys)
export const randomHex32 = () => randomBytes(32).toString('hex');

// Reads digits without showing them (asterisks instead)
function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const input = process.stdin;
    if (!input.isTTY) fail('Run this in a terminal: it asks for the admin PIN.');
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\u0003') {
          process.stdout.write('\n');
          process.exit(130);
        } else if (char === '\r' || char === '\n') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        } else if (char === '\u0008' || char === '\u007f') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          value += char;
          process.stdout.write('*');
        }
      }
    };
    input.on('data', onData);
  });
}

// Asks for the phone's admin PIN twice (Q12) and returns only its salted hash
export async function askAdminPin(): Promise<{ adminPinHash: string; adminPinSalt: string }> {
  for (;;) {
    const pin = await readHidden(`Admin PIN for this phone (${ADMIN_PIN_DIGITS} digits): `);
    if (!isValidPin(pin)) {
      console.log(`The PIN must be exactly ${ADMIN_PIN_DIGITS} digits.`);
      continue;
    }
    if ((await readHidden('Same PIN again: ')) !== pin) {
      console.log('The two PINs differ. Try again.');
      continue;
    }
    const adminPinSalt = randomBytes(16).toString('hex');
    return { adminPinHash: hashAdminPin(pin, adminPinSalt), adminPinSalt };
  }
}

export function askYes(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(`${question} [y/N] `);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (answer: string) => {
      process.stdin.pause();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

export function showQr(text: string): void {
  qrcode.generate(text, { small: true });
}

export function expiresAt(ttlMin: number, nowMs = Date.now()): { exp: number; label: string } {
  const exp = Math.floor(nowMs / 1000) + ttlMin * 60;
  const label = new Date(exp * 1000).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });
  return { exp, label };
}
