// Driver registration Edge Function (Deno; DRG3, PRD 9.5). The driver app calls it without an account,
// so it is deployed with --no-verify-jwt; every rule is in ../_shared/registrationCore.ts, and the
// limits are enforced again by the database functions it calls. It uses the service role, which stays
// on the server. It never logs a number, code, token or photo.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleDriverRegistration, type CollectedSetup, type RegistrationDeps } from '../_shared/registrationCore.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

const BUCKET = 'driver-registrations';
const CODE_RANGE = 1_000_000;
const CODE_DIGITS = 6;
const TOKEN_BYTES = 32;

// A refusal raised by a database function carries its reason as the message
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

const deps: RegistrationDeps = {
  nowMs: () => Date.now(),
  newCode: () => String(crypto.getRandomValues(new Uint32Array(1))[0] % CODE_RANGE).padStart(CODE_DIGITS, '0'),
  newToken: () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  sha256Hex: async (text) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  },
  startCheck: async (args) => {
    await rpc('registration_check_start', {
      phone: args.phone,
      code: args.code,
      encoding: args.encoding,
      body_text: args.bodyText,
      body_b64: args.bodyB64,
      ttl_min: args.ttlMin,
      sms_ttl_min: args.smsTtlMin,
      resend_min: args.resendMin,
      per_number: args.perNumber,
      per_day: args.perDay,
    });
  },
  verifyCheck: (phone, code, maxTries) => rpc<string | null>('registration_check_verify', { phone, code, max_tries: maxTries }),
  uploadLinks: async (check) => {
    const links: string[] = [];
    for (const name of ['id.jpg', 'vehicle.jpg']) {
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(`${check}/${name}`, { upsert: true });
      if (error) throw new Error(error.message);
      links.push(data.signedUrl);
    }
    return { id: links[0], vehicle: links[1] };
  },
  submit: async (args) => {
    await rpc('registration_submit', {
      check_ref: args.check,
      plate: args.plate,
      route: args.route,
      token_hash: args.tokenHash,
      verified_within_min: args.withinMin,
    });
  },
  status: async (tokenHash, ttlDays) => {
    const rows = await rpc<{ status: string; reason: string | null }[]>('registration_status', { token_hash: tokenHash, setup_ttl_days: ttlDays });
    return rows[0] ?? null;
  },
  hasGatewayNumber: async () => {
    const { data, error } = await admin.from('gateways').select('gateway_id').eq('active', true).not('phone_e164', 'is', null).limit(1);
    if (error) throw new Error(error.message);
    return data.length > 0;
  },
  collect: async (tokenHash, ttlDays) => {
    const rows = await rpc<CollectedSetup[]>('registration_collect', { token_hash: tokenHash, setup_ttl_days: ttlDays });
    return rows[0] ?? null;
  },
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

Deno.serve(async (request) => {
  try {
    const response = await handleDriverRegistration({ method: request.method, body: await request.text() }, deps);
    return new Response(JSON.stringify(response.body), { status: response.status, headers: JSON_HEADERS });
  } catch (error) {
    console.error('driver-registration failed', error instanceof Error ? error.message : 'unknown error');
    return new Response(JSON.stringify({ ok: false, error: 'server_error' }), { status: 500, headers: JSON_HEADERS });
  }
});
