// AF1: each tab's first-run hint shows until dismissed, then never again, across restarts.
// A restart is simulated by loading a fresh copy of the store module over the same saved data.

const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));

type Store = typeof import('../hintsStore').useHintsStore;

function restart(): Store {
  let store: Store | undefined;
  jest.isolateModules(() => {
    store = (jest.requireActual('../hintsStore') as typeof import('../hintsStore')).useHintsStore;
  });
  if (!store) throw new Error('store not loaded');
  return store;
}

afterEach(() => {
  mockSaved.clear();
});

describe('hints store', () => {
  it('a fresh install shows every hint', () => {
    expect(restart().getState().seen).toEqual({ live: false, checkin: false, ride: false });
  });

  it('a dismissed hint stays dismissed after a restart; the others still show', () => {
    restart().getState().dismiss('checkin');
    expect(restart().getState().seen).toEqual({ live: false, checkin: true, ride: false });
  });

  it('treats a damaged or unknown stored value as not seen', () => {
    mockSaved.set('hints', JSON.stringify({ state: { seen: { live: 'yes', ride: true, extra: true } }, version: 0 }));
    expect(restart().getState().seen).toEqual({ live: false, checkin: false, ride: true });
  });
});
