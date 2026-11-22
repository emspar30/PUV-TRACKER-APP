// Two-factor sign-in for the admin console: which step follows the password.

import { adminMfaStep, idleExpired, mayAddFactor, mayRemoveFactor, nextFactorName, totpCode } from '../auth/adminMfa';
import { ADMIN_IDLE_SIGNOUT_MIN, ADMIN_MAX_AUTHENTICATORS } from '../config';

describe('admin two-factor sign-in', () => {
  it('opens the console only once the session has the second factor', () => {
    expect(adminMfaStep('aal2', 1)).toBe('console');
    expect(adminMfaStep('aal1', 1)).toBe('verify');
    expect(adminMfaStep('aal1', 0)).toBe('enroll');
    expect(adminMfaStep(null, 0)).toBe('enroll');
  });

  it('takes a 6-digit code, with or without a space', () => {
    expect(totpCode('123456')).toBe('123456');
    expect(totpCode(' 123 456 ')).toBe('123456');
    expect(totpCode('12345')).toBeNull();
    expect(totpCode('12a456')).toBeNull();
  });

  it('names each authenticator differently, filling the lowest free number', () => {
    expect(nextFactorName([])).toBe('Tunton admin');
    expect(nextFactorName(['Tunton admin'])).toBe('Tunton admin 2');
    expect(nextFactorName(['Tunton admin', 'Tunton admin 3'])).toBe('Tunton admin 2');
    expect(nextFactorName(['Tunton admin 2'])).toBe('Tunton admin');
  });

  it('allows backups up to the limit, and never removes the last authenticator', () => {
    expect(mayAddFactor(1)).toBe(true);
    expect(mayAddFactor(ADMIN_MAX_AUTHENTICATORS)).toBe(false);
    expect(mayRemoveFactor(1)).toBe(false);
    expect(mayRemoveFactor(2)).toBe(true);
  });

  it('signs out an idle console after ADMIN_IDLE_SIGNOUT_MIN', () => {
    const limit = ADMIN_IDLE_SIGNOUT_MIN * 60_000;
    expect(idleExpired(0, limit - 1)).toBe(false);
    expect(idleExpired(0, limit)).toBe(true);
  });
});
