import { create } from 'zustand';

import { getSupabase, isSupabaseConfigured } from '@/services/supabase';

// The backend sign-in state. It holds only what the screens show: whether someone is signed in
// and their email. Nothing from the profile store (which stays on the device) is kept here.

export type SessionStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in';

type SessionState = {
  status: SessionStatus;
  email: string | null;
  error: string | null;
};

export const useSessionStore = create<SessionState>(() => ({
  status: isSupabaseConfigured() ? 'loading' : 'unconfigured',
  email: null,
  error: null,
}));

let started = false;

// Reads the saved session and follows sign-in and sign-out. Call once when the app starts.
// Never throws: without backend keys, or without a network, the offline features keep working.
export function startSessionTracking(): void {
  if (started || !isSupabaseConfigured()) return;
  started = true;

  try {
    const { auth } = getSupabase();
    const apply = (email: string | null | undefined, signedIn: boolean) =>
      useSessionStore.setState({ status: signedIn ? 'signed-in' : 'signed-out', email: email ?? null, error: null });

    auth
      .getSession()
      .then(({ data }) => apply(data.session?.user.email, Boolean(data.session)))
      .catch((error: unknown) =>
        useSessionStore.setState({
          status: 'signed-out',
          error: error instanceof Error ? error.message : String(error),
        }),
      );

    auth.onAuthStateChange((_event, session) => apply(session?.user.email, Boolean(session)));
  } catch (error) {
    useSessionStore.setState({ status: 'signed-out', error: error instanceof Error ? error.message : String(error) });
  }
}
