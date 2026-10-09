// The avatar is picked once and kept across restarts (PRD 19, D3). A restart is simulated by
// loading a fresh copy of the store module over the same saved key-value data.

const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));

type Store = typeof import('../profileStore').useProfileStore;

// A new app start: the module is loaded again and reads what was saved
function restart(): Store {
  let store: Store | undefined;
  jest.isolateModules(() => {
    store = (jest.requireActual('../profileStore') as typeof import('../profileStore')).useProfileStore;
  });
  if (!store) throw new Error('store not loaded');
  return store;
}

const MALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const FEMALE = [10, 11, 12, 13, 14, 15];

afterEach(() => {
  mockSaved.clear();
  jest.restoreAllMocks();
});

describe('profile store: the avatar is picked once', () => {
  it('a fresh install has no avatar assigned and no gender answer', () => {
    const state = restart().getState();
    expect(state.avatarAssigned).toBe(false);
    expect(state.gender).toBeNull();
  });

  it('a stated gender picks from its set; the pick survives a restart and later answers', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const first = restart();
    first.getState().setGender('female');
    first.getState().assignAvatar();
    const picked = first.getState().avatarId;
    expect(FEMALE).toContain(picked);

    const second = restart();
    expect(second.getState().avatarId).toBe(picked);
    expect(second.getState().gender).toBe('female');

    // Changing the answer, and asking again, never re-rolls
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    second.getState().setGender('male');
    second.getState().assignAvatar();
    expect(second.getState().avatarId).toBe(picked);
    expect(restart().getState().avatarId).toBe(picked);
  });

  it('only Shuffle changes it, within the set of the current answer', () => {
    const store = restart();
    store.getState().setGender('male');
    store.getState().assignAvatar();
    const before = store.getState().avatarId;
    store.getState().shuffleAvatar();
    const after = store.getState().avatarId;
    expect(after).not.toBe(before);
    expect(MALE).toContain(after);
    expect(restart().getState().avatarId).toBe(after);
  });

  it('skipping the question picks from all sixteen', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const store = restart();
    store.getState().assignAvatar();
    expect(store.getState().avatarId).toBe(15);
  });

  it('a phone from before onboarding v2 keeps its hand-picked avatar', () => {
    mockSaved.set('profile', JSON.stringify({ state: { classification: 'student', avatarId: 7, onboarded: true }, version: 0 }));
    const store = restart();
    expect(store.getState().avatarAssigned).toBe(true);
    store.getState().setGender('male');
    store.getState().assignAvatar();
    expect(store.getState().avatarId).toBe(7);
  });

  it('ignores a stored gender this version does not know', () => {
    mockSaved.set('profile', JSON.stringify({ state: { gender: 'other', avatarId: 3, avatarAssigned: true }, version: 0 }));
    expect(restart().getState().gender).toBeNull();
  });
});
