import { AppState, type AppStateStatus } from 'react-native';

// The session store against a mocked auth library (jest hoists the mocks above the imports).
// AU1: an account is needed, so a signed-in commuter must stay signed in when the phone is offline
// (PRD 7.1). Offline, once the access token is over an hour old, the auth library cannot refresh it:
// getSession() and the INITIAL_SESSION event report no session, while the saved one is kept.
// Backlog 124: the session is refreshed only while the app is in front (supabase-js asks React
// Native apps to start and stop its refresh timer; a refresh in the background could get the
// session revoked).

type AuthCallback = (event: string, session: { user: { email?: string } } | null) => void;

let mockStored: { email: string | null } | null = null;
let mockGetSession: () => Promise<{ data: { session: { user: { email?: string } } | null } }>;
let mockListener: AuthCallback | null = null;
const mockAuth = {
  getSession: () => mockGetSession(),
  onAuthStateChange: (callback: AuthCallback) => {
    mockListener = callback;
    return { data: { subscription: { unsubscribe: () => undefined } } };
  },
  startAutoRefresh: jest.fn(async () => undefined),
  stopAutoRefresh: jest.fn(async () => undefined),
};

jest.mock('@/services/supabase', () => ({
  isSupabaseConfigured: () => true,
  readStoredSession: () => mockStored,
  getSupabase: () => ({
    auth: mockAuth,
    rpc: () => Promise.resolve({ data: false, error: null }),
  }),
}));

jest.mock('../usernameStore', () => ({ syncUsername: () => Promise.resolve() }));

type Module = typeof import('../sessionStore');

// A fresh app start: the module is loaded again, so its once-only guard is reset
function load(): Module {
  let loaded: Module | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual('../sessionStore') as Module;
  });
  if (!loaded) throw new Error('store not loaded');
  return loaded;
}

function start(): Module {
  const loaded = load();
  loaded.startSessionTracking();
  return loaded;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  mockStored = null;
  mockListener = null;
  mockGetSession = () => Promise.resolve({ data: { session: null } });
  mockAuth.startAutoRefresh.mockClear();
  mockAuth.stopAutoRefresh.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
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

describe('session refresh follows the app in front (backlog 124)', () => {
  it('starts refreshing in front, stops in the background, and starts again on return', () => {
    const { startSessionTracking } = load();
    let onChange: ((state: AppStateStatus) => void) | null = null;
    const addListener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onChange = listener as (state: AppStateStatus) => void;
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    // jest-expo's AppState.addEventListener is already a mock, so spyOn returns it with the calls
    // the AU1 tests above made; count from here
    addListener.mockClear();
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });

    startSessionTracking();
    expect(mockAuth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(mockAuth.stopAutoRefresh).not.toHaveBeenCalled();

    onChange!('background');
    expect(mockAuth.stopAutoRefresh).toHaveBeenCalledTimes(1);

    onChange!('active');
    expect(mockAuth.startAutoRefresh).toHaveBeenCalledTimes(2);

    // Once only: a second call registers nothing more
    startSessionTracking();
    expect(addListener).toHaveBeenCalledTimes(1);
  });

  it('a saved session offline still refreshes only in front (AU1 with backlog 124)', async () => {
    mockStored = { email: 'rider@example.com' };
    const { useSessionStore, startSessionTracking } = load();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: () => undefined }) as ReturnType<typeof AppState.addEventListener>);
    Object.defineProperty(AppState, 'currentState', { value: 'background', configurable: true });
    startSessionTracking();
    await flush();
    expect(useSessionStore.getState().status).toBe('signed-in');
    expect(mockAuth.startAutoRefresh).not.toHaveBeenCalled();
    expect(mockAuth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });
});
