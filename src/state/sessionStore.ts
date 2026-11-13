import { AppState } from 'react-native';
import { create } from 'zustand';

import { getSupabase, isSupabaseConfigured, readStoredSession } from '@/services/supabase';
import { isSignedIn, type SessionStatus } from '@/shared/auth/gate';

import { syncUsername } from './usernameStore';

// The backend sign-in state. It holds only what the screens show: whether someone is signed in
// and their email. Nothing from the profile store (which stays on the device) is kept here.

export type { SessionStatus };

type SessionState = {
  status: SessionStatus;
  email: string | null;
  // The signed-in account's id, once the auth library has it; kept only on the phone (accountOwner)
  userId: string | null;
  error: string | null;
  // Whether this account may see and use the live map (every account since 2026-11-13, team
  // accounts only while the server's live_map_team_only is on); null until known
  liveMapAccess: boolean | null;
};

export const useSessionStore = create<SessionState>(() => ({
  status: isSupabaseConfigured() ? 'loading' : 'unconfigured',
  email: null,
  userId: null,
  error: null,
  liveMapAccess: null,
}));

// Asks the database whether the signed-in account may use the live map, so the Map can say why one
// sees no vehicles. Row Level Security still decides what comes back. A server without
// may_use_live_map (before migration 20261113000000) is asked the old team question instead.
const FUNCTION_NOT_FOUND = 'PGRST202';
async function syncLiveMapAccess(): Promise<void> {
  const supabase = getSupabase();
  let { data, error } = await supabase.rpc('may_use_live_map');
  if (error?.code === FUNCTION_NOT_FOUND) ({ data, error } = await supabase.rpc('is_team_account'));
  useSessionStore.setState({ liveMapAccess: error ? null : data === true });
}

let started = false;

// Reads the saved session and follows sign-in and sign-out. Call once when the app starts.
// Never throws: without backend keys, or without a network, the offline features keep working.
// AU1: a session saved on the phone counts as signed in at once, before the library has read it,
// and still counts when the library reports none because the phone is offline (PRD 7.1).
export function startSessionTracking(): void {
  if (started || !isSupabaseConfigured()) return;
  started = true;

  const apply = (event: string | null, session: { user: { id: string; email?: string | null } } | null) => {
    const stored = session ? null : readStoredSession();
    const signedIn = isSignedIn({ event, session: Boolean(session), stored: stored !== null });
    const status = signedIn ? 'signed-in' : 'signed-out';
    const email = signedIn ? (session?.user.email ?? stored?.email ?? null) : null;
    // The same account reported again (the first read, a token refresh) keeps its team answer
    const before = useSessionStore.getState();
    const same = before.status === status && before.email === email;
    // The saved session read before the library has it carries no id; the library's report then does
    const userId = signedIn ? (session?.user.id ?? (same ? before.userId : null)) : null;
    useSessionStore.setState({ status, email, userId, error: null, ...(same ? {} : { liveMapAccess: null }) });
    // SB2: the handle follows the account
    if (signedIn) {
      void syncUsername().catch(() => undefined);
      void syncLiveMapAccess().catch(() => undefined);
    }
  };

  try {
    if (readStoredSession()) apply(null, null);

    const { auth } = getSupabase();
    auth
      .getSession()
      .then(({ data }) => apply(null, data.session))
      .catch((error: unknown) => {
        apply(null, null);
        useSessionStore.setState({ error: error instanceof Error ? error.message : String(error) });
      });

    auth.onAuthStateChange((event, session) => apply(event, session));

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
    apply(null, null);
    useSessionStore.setState({ error: error instanceof Error ? error.message : String(error) });
  }
}
