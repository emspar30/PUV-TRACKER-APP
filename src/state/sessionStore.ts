import { AppState } from 'react-native';
import { create } from 'zustand';

import { getSupabase, isSupabaseConfigured } from '@/services/supabase';

import { syncUsername } from './usernameStore';

// The backend sign-in state. It holds only what the screens show: whether someone is signed in
// and their email. Nothing from the profile store (which stays on the device) is kept here.

export type SessionStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in';

type SessionState = {
  status: SessionStatus;
  email: string | null;
  error: string | null;
  // Whether this account may see live vehicles (team accounts only in v0); null until known
  teamAccount: boolean | null;
};

export const useSessionStore = create<SessionState>(() => ({
  status: isSupabaseConfigured() ? 'loading' : 'unconfigured',
  email: null,
  error: null,
  teamAccount: null,
}));

// Asks the database whether the signed-in account is on the team list, so the Live tab can say why
// a non-team account sees no vehicles. Row Level Security still decides what comes back.
async function syncTeamAccount(): Promise<void> {
  const { data, error } = await getSupabase().rpc('is_team_account');
  useSessionStore.setState({ teamAccount: error ? null : data === true });
}

let started = false;

// Reads the saved session and follows sign-in and sign-out. Call once when the app starts.
// Never throws: without backend keys, or without a network, the offline features keep working.
export function startSessionTracking(): void {
  if (started || !isSupabaseConfigured()) return;
  started = true;

  try {
    const { auth } = getSupabase();
    const apply = (email: string | null | undefined, signedIn: boolean) => {
      useSessionStore.setState({ status: signedIn ? 'signed-in' : 'signed-out', email: email ?? null, error: null, teamAccount: null });
      // SB2: the handle follows the account
      if (signedIn) {
        void syncUsername();
        void syncTeamAccount().catch(() => undefined);
      }
    };

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

    // Backlog 124: outside a browser supabase-js refreshes the session on a timer that never stops,
    // so it also fires in the background, where Android may freeze the app or cut its network mid
    // request. The server then has rotated the refresh token, the phone still holds the old one, the
    // next try counts as reuse and the session is revoked (the HONOR was signed out overnight). As
    // supabase-js asks of React Native apps: refresh only while the app is in front.
    const followForeground = (state: string) => {
      if (state === 'active') void auth.startAutoRefresh();
      else void auth.stopAutoRefresh();
    };
    followForeground(AppState.currentState);
    AppState.addEventListener('change', followForeground);
  } catch (error) {
    useSessionStore.setState({ status: 'signed-out', error: error instanceof Error ? error.message : String(error) });
  }
}
