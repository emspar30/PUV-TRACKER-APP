import { DRIVER_REQUEST_TIMEOUT_MS } from '@/shared/config';
import { encodeProvisioning, parseProvisioning, type DriverProvisioning } from '@/shared/driver/provisioning';

// DRG4: the driver app's only calls to the cloud (PRD 6.2's setup exception, 9.5): the
// driver-registration Edge Function, with a plain fetch and the publishable key. The driver app has
// no Supabase library and no account. Every call answers { ok: true, ... } or { ok: false, error }:
// the function's refusal (too_soon, wrong_code, ...), or offline (no answer), not_configured (a
// build without the project's address) or server_error. A too_soon refusal also says how many seconds
// are left (retryAfterS), when the server knows.

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string; retryAfterS?: number };

const BASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const FUNCTION_PATH = '/functions/v1/driver-registration';

export async function callRegistration<T>(body: Record<string, unknown>): Promise<ApiResult<T>> {
  if (!BASE_URL || !KEY) return { ok: false, error: 'not_configured' };
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), DRIVER_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${FUNCTION_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (parsed && parsed.ok === true) return parsed as { ok: true } & T;
    const error = parsed && typeof parsed.error === 'string' ? parsed.error : 'server_error';
    const retryAfterS = parsed && typeof parsed.retryAfterS === 'number' && parsed.retryAfterS > 0 ? parsed.retryAfterS : undefined;
    return retryAfterS === undefined ? { ok: false, error } : { ok: false, error, retryAfterS };
  } catch {
    return { ok: false, error: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

export const startCheck = (phone: string) => callRegistration<{ phone: string; codeValidS: number; resendAfterS: number }>({ action: 'start', phone });

export const verifyCheck = (phone: string, code: string) =>
  callRegistration<{ check: string; uploads: { id: string; vehicle: string }; submitWithinS: number }>({ action: 'verify', phone, code });

export const submitRegistration = (check: string, plate: string, route: string) =>
  callRegistration<{ plate: string; route: string; token: string }>({ action: 'submit', check, plate, route });

export const registrationStatus = (token: string) => callRegistration<{ status: string; reason: string | null }>({ action: 'status', token });

// The collected setup goes through the same parser as a scanned setup QR, so the phone takes nothing
// a QR could not carry
export async function collectSetup(token: string): Promise<ApiResult<{ setup: DriverProvisioning }>> {
  const result = await callRegistration<{ setup: unknown }>({ action: 'collect', token });
  if (!result.ok) return result;
  try {
    const parsed = parseProvisioning(encodeProvisioning(result.setup as DriverProvisioning), 'driver', Date.now());
    return parsed.ok ? { ok: true, setup: parsed.payload } : { ok: false, error: 'server_error' };
  } catch {
    return { ok: false, error: 'server_error' };
  }
}
