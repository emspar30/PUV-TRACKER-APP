// AU1: an account is needed, so a signed-in commuter must stay signed in when the phone is offline
// (PRD 7.1). Offline, once the access token is over an hour old, the auth library cannot refresh it:
// getSession() and the INITIAL_SESSION event report no session, while the saved one is kept.

type AuthCallback = (event: string, session: { user: { email?: string } } | null) => void;

let mockStored: { email: string | null } | null = null;
let mockGetSession: () => Promise<{ data: { session: { user: { email?: string } } | null } }>;
let mockListener: AuthCallback | null = null;

jest.mock('@/services/supabase', () => ({
  isSupabaseConfigured: () => true,
  readStoredSession: () => mockStored,
  getSupabase: () => ({
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: AuthCallback) => {
        mockListener = callback;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
    },
    rpc: () => Promise.resolve({ data: false, error: null }),
  }),
}));

jest.mock('../usernameStore', () => ({ syncUsername: () => Promise.resolve() }));

type Module = typeof import('../sessionStore');

// A fresh app start
function start(): Module {
  let loaded: Module | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual('../sessionStore') as Module;
  });
  if (!loaded) throw new Error('store not loaded');
  loaded.startSessionTracking();
  return loaded;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  mockStored = null;
  mockListener = null;
  mockGetSession = () => Promise.resolve({ data: { session: null } });
});

describe('AU1 session store', () => {
  it('a saved session counts as signed in at once, before the library has read it', () => {
    mockStored = { email: 'rider@example.com' };
    mockGetSession = () => new Promise(() => undefined);
    const { useSessionStore } = start();
    expect(useSessionStore.getState()).toMatchObject({ status: 'signed-in', email: 'rider@example.com' });
  });

  it('offline with an expired token: no session reported, still signed in', async () => {
    mockStored = { email: 'rider@example.com' };
    const { useSessionStore } = start();
    await flush();
    mockListener?.('INITIAL_SESSION', null);
    expect(useSessionStore.getState()).toMatchObject({ status: 'signed-in', email: 'rider@example.com' });
  });

  it('a failed read with a saved session stays signed in', async () => {
    mockStored = { email: 'rider@example.com' };
    mockGetSession = () => Promise.reject(new Error('Network request failed'));
    const { useSessionStore } = start();
    await flush();
    expect(useSessionStore.getState().status).toBe('signed-in');
  });

  it('nothing saved is signed out, so the gate asks for sign-in', async () => {
    const { useSessionStore } = start();
    await flush();
    expect(useSessionStore.getState()).toMatchObject({ status: 'signed-out', email: null });
  });

  it('a live session is signed in with its email', async () => {
    mockGetSession = () => Promise.resolve({ data: { session: { user: { email: 'team@example.com' } } } });
    const { useSessionStore } = start();
    await flush();
    expect(useSessionStore.getState()).toMatchObject({ status: 'signed-in', email: 'team@example.com' });
  });

  it('signing out signs out, even while the saved session is being removed', async () => {
    mockStored = { email: 'rider@example.com' };
    const { useSessionStore } = start();
    await flush();
    mockListener?.('SIGNED_OUT', null);
    expect(useSessionStore.getState()).toMatchObject({ status: 'signed-out', email: null });
  });
});
