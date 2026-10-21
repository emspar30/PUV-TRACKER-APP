import { entryRoute, isSignedIn, sessionStorageKey, storedSessionOf, type SessionStatus } from '../auth/gate';

const STATUSES: SessionStatus[] = ['unconfigured', 'loading', 'signed-out', 'signed-in'];

describe('AU1 entry gate', () => {
  it('shows the introduction first, whatever the session', () => {
    for (const status of ['loading', 'signed-out', 'signed-in'] as const) {
      expect(entryRoute({ onboarded: false, status, dev: false })).toBe('onboarding');
      expect(entryRoute({ onboarded: false, status, dev: true })).toBe('onboarding');
    }
  });

  it('after the introduction an account is needed', () => {
    expect(entryRoute({ onboarded: true, status: 'signed-out', dev: false })).toBe('signIn');
    expect(entryRoute({ onboarded: true, status: 'signed-out', dev: true })).toBe('signIn');
    expect(entryRoute({ onboarded: true, status: 'signed-in', dev: false })).toBe('app');
  });

  it('never sends anyone to sign in while the saved session is still being read', () => {
    expect(entryRoute({ onboarded: true, status: 'loading', dev: false })).toBe('wait');
    for (const onboarded of [false, true]) {
      for (const dev of [false, true]) expect(entryRoute({ onboarded, status: 'loading', dev })).not.toBe('signIn');
    }
  });

  it('lets a development build without backend keys through, and stops a release build', () => {
    expect(entryRoute({ onboarded: true, status: 'unconfigured', dev: true })).toBe('app');
    expect(entryRoute({ onboarded: false, status: 'unconfigured', dev: true })).toBe('onboarding');
    expect(entryRoute({ onboarded: true, status: 'unconfigured', dev: false })).toBe('noBackend');
    expect(entryRoute({ onboarded: false, status: 'unconfigured', dev: false })).toBe('noBackend');
  });

  it('opens the app only to a signed-in account or a development build with no backend', () => {
    for (const status of STATUSES) {
      for (const onboarded of [false, true]) {
        for (const dev of [false, true]) {
          const route = entryRoute({ onboarded, status, dev });
          if (route === 'app') expect(status === 'signed-in' || (status === 'unconfigured' && dev)).toBe(true);
        }
      }
    }
  });
});

describe('AU1 signed in offline', () => {
  it('a live session is signed in', () => {
    expect(isSignedIn({ event: null, session: true, stored: true })).toBe(true);
    expect(isSignedIn({ event: 'TOKEN_REFRESHED', session: true, stored: true })).toBe(true);
  });

  it('offline with an expired token: no session reported, but the saved one still counts', () => {
    // getSession() and INITIAL_SESSION both report null when the refresh fails for want of a network
    expect(isSignedIn({ event: null, session: false, stored: true })).toBe(true);
    expect(isSignedIn({ event: 'INITIAL_SESSION', session: false, stored: true })).toBe(true);
  });

  it('nothing saved means signed out', () => {
    expect(isSignedIn({ event: null, session: false, stored: false })).toBe(false);
    expect(isSignedIn({ event: 'INITIAL_SESSION', session: false, stored: false })).toBe(false);
  });

  it('signing out always signs out, even if storage has not been cleared yet', () => {
    expect(isSignedIn({ event: 'SIGNED_OUT', session: false, stored: true })).toBe(false);
  });
});

describe('AU1 saved session', () => {
  const saved = (value: unknown) => JSON.stringify(value);

  it('reads the email of a saved session with a refresh token', () => {
    expect(storedSessionOf(saved({ access_token: 'a', refresh_token: 'r', expires_at: 1, user: { email: 'rider@example.com' } }))).toEqual({
      email: 'rider@example.com',
    });
    expect(storedSessionOf(saved({ refresh_token: 'r', user: null }))).toEqual({ email: null });
  });

  it('ignores nothing, broken JSON and a session without a refresh token', () => {
    expect(storedSessionOf(null)).toBeNull();
    expect(storedSessionOf('')).toBeNull();
    expect(storedSessionOf('{not json')).toBeNull();
    expect(storedSessionOf('null')).toBeNull();
    expect(storedSessionOf(saved({ access_token: 'a' }))).toBeNull();
    expect(storedSessionOf(saved({ refresh_token: '' }))).toBeNull();
  });

  it('uses the auth library default key, so sessions saved before AU1 are found', () => {
    expect(sessionStorageKey('https://abcdefgh.supabase.co')).toBe('sb-abcdefgh-auth-token');
    expect(sessionStorageKey('https://abcdefgh.supabase.co/')).toBe('sb-abcdefgh-auth-token');
    expect(sessionStorageKey('http://127.0.0.1:54321')).toBe('sb-127-auth-token');
  });
});
