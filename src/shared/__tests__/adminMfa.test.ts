// Two-factor sign-in for the admin console: which step follows the password.

import { adminMfaStep, totpCode } from '../auth/adminMfa';

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
});
