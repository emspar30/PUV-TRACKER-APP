// Two-factor sign-in for the admin console (owner, 2026-11-22): after the password, the admin enters a
// 6-digit code from an authenticator app (TOTP). The database accepts admin actions only from a
// session that passed it (is_admin() checks the token's aal claim, migration
// 20261122000002_admin_mfa.sql). Pure: the console reads Supabase's answers and passes them in.

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
