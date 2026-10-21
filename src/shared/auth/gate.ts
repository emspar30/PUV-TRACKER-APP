// AU1: an account is needed to use the app (PRD 7.1, D6). Who may enter, and whether someone still
// counts as signed in when the phone is offline. Pure: no React Native, Expo or Supabase imports.

// unconfigured: the build has no backend keys, so nobody can sign in
export type SessionStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in';

// What the tabs show: the introduction, the sign-in page, nothing yet (the saved session is still
// being read), the app, or a release build with no backend
export type EntryRoute = 'onboarding' | 'signIn' | 'wait' | 'app' | 'noBackend';

export function entryRoute({ onboarded, status, dev }: { onboarded: boolean; status: SessionStatus; dev: boolean }): EntryRoute {
  // A release build without backend keys cannot sign anyone in; a development build carries on
  if (status === 'unconfigured') {
    if (!dev) return 'noBackend';
    return onboarded ? 'app' : 'onboarding';
  }
  if (!onboarded) return 'onboarding';
  if (status === 'loading') return 'wait';
  return status === 'signed-in' ? 'app' : 'signIn';
}

// A sign-in report from the auth library: the event (null for the first read), whether it came with
// a session, and whether a session is still saved on the phone. Offline, once the access token is
// over an hour old, the library cannot refresh it and reports no session, yet keeps the saved one
// (a refused refresh token, or signing out, removes it). So a saved session still counts.
export type SessionReport = { event: string | null; session: boolean; stored: boolean };

export function isSignedIn(report: SessionReport): boolean {
  if (report.event === 'SIGNED_OUT') return false;
  return report.session || report.stored;
}

export type StoredSession = { email: string | null };

// The session the auth library saved on the phone (its JSON), or null when there is none or it
// cannot be used (no refresh token)
export function storedSessionOf(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { refresh_token: refreshToken, user } = value as { refresh_token?: unknown; user?: { email?: unknown } | null };
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) return null;
    const email = user && typeof user.email === 'string' ? user.email : null;
    return { email };
  } catch {
    return null;
  }
}

// The key the auth library saves the session under: its default, sb-<first part of the host>-auth-token,
// so sessions saved before AU1 are still found
export function sessionStorageKey(supabaseUrl: string): string {
  const host = supabaseUrl.replace(/^[a-z]+:\/\//i, '').split(/[/:?#]/)[0] ?? '';
  return `sb-${host.split('.')[0]}-auth-token`;
}
