import { AppState, type AppStateStatus } from 'react-native';

// Backlog 124: the session is refreshed only while the app is in front (supabase-js asks React
// Native apps to start and stop its refresh timer; a refresh in the background could get the
// session revoked). The backend is mocked; jest hoists these above the imports.
const mockAuth = {
  getSession: jest.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: jest.fn(),
  startAutoRefresh: jest.fn(async () => undefined),
  stopAutoRefresh: jest.fn(async () => undefined),
};
jest.mock('@/services/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ auth: mockAuth }),
}));
jest.mock('../usernameStore', () => ({ syncUsername: jest.fn(async () => undefined) }));

describe('session refresh follows the app in front (backlog 124)', () => {
  it('starts refreshing in front, stops in the background, and starts again on return', () => {
    let onChange: ((state: AppStateStatus) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onChange = listener as (state: AppStateStatus) => void;
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startSessionTracking } = require('../sessionStore') as typeof import('../sessionStore');
    startSessionTracking();
    expect(mockAuth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(mockAuth.stopAutoRefresh).not.toHaveBeenCalled();

    onChange!('background');
    expect(mockAuth.stopAutoRefresh).toHaveBeenCalledTimes(1);

    onChange!('active');
    expect(mockAuth.startAutoRefresh).toHaveBeenCalledTimes(2);

    // Once only: a second call registers nothing more
    startSessionTracking();
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
  });
});
