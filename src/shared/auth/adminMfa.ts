// Two-factor sign-in for the admin console (owner, 2026-11-22): after the password, the admin enters a
// 6-digit code from an authenticator app (TOTP). The database accepts admin actions only from a
// session that passed it (is_admin() checks the token's aal claim, migration
// 20261122000002_admin_mfa.sql). Pure: the console reads Supabase's answers and passes them in.
// Also (2026-11-22, weak-point fixes): backup authenticators on other phones, and signing out an idle
// console.

import { ADMIN_IDLE_SIGNOUT_MIN, ADMIN_MAX_AUTHENTICATORS } from '../config';

export type AdminMfaStep = 'console' | 'enroll' | 'verify';

const CODE_RE = /^\d{6}$/;

// What the console shows after the password: the console once the session has the second factor
// (aal2), the code prompt when an authenticator app is already set up, else its first-time setup
export function adminMfaStep(currentLevel: string | null, verifiedTotpFactors: number): AdminMfaStep {
  if (currentLevel === 'aal2') return 'console';
  return verifiedTotpFactors > 0 ? 'verify' : 'enroll';
}

// The code as typed ("123 456" gives "123456"), or null if it is not 6 digits
export function totpCode(raw: string): string | null {
  const code = raw.replace(/\s+/g, '');
  return CODE_RE.test(code) ? code : null;
}

const MS_PER_MIN = 60_000;
export const FIRST_FACTOR_NAME = 'Tunton admin';

// A name for the next authenticator: Supabase needs each of an account's factors named differently.
// "Tunton admin", then "Tunton admin 2", "Tunton admin 3" (the lowest number not taken)
export function nextFactorName(taken: readonly string[]): string {
  if (!taken.includes(FIRST_FACTOR_NAME)) return FIRST_FACTOR_NAME;
  const firstBackup = 2;
  for (let n = firstBackup; ; n += 1) {
    const name = `${FIRST_FACTOR_NAME} ${n}`;
    if (!taken.includes(name)) return name;
  }
}

// Another authenticator may be added while fewer than ADMIN_MAX_AUTHENTICATORS are set up
export function mayAddFactor(verified: number): boolean {
  return verified < ADMIN_MAX_AUTHENTICATORS;
}

// One may be removed only while another stays, so the console is never left without a second factor
export function mayRemoveFactor(verified: number): boolean {
  return verified > 1;
}

// The console has had no click, key press, scroll or touch for ADMIN_IDLE_SIGNOUT_MIN
export function idleExpired(lastActiveMs: number, nowMs: number): boolean {
  return nowMs - lastActiveMs >= ADMIN_IDLE_SIGNOUT_MIN * MS_PER_MIN;
}
