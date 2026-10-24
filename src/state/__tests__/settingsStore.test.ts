// AF2: the "Demo data" setting is on by default, kept on the device, and survives a restart.

const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));

type Store = typeof import('../settingsStore').useSettingsStore;

function restart(): Store {
  let store: Store | undefined;
  jest.isolateModules(() => {
    store = (jest.requireActual('../settingsStore') as typeof import('../settingsStore')).useSettingsStore;
  });
  if (!store) throw new Error('store not loaded');
  return store;
}

afterEach(() => {
  mockSaved.clear();
});

describe('settings store: Demo data', () => {
  it('is on by default (Emjay, 2026-10-04)', () => {
    expect(restart().getState().demoData).toBe(true);
  });

  it('a switch to off survives a restart and keeps the theme', () => {
    const first = restart();
    first.getState().setTheme('dark');
    first.getState().setDemoData(false);
    const second = restart().getState();
    expect(second.demoData).toBe(false);
    expect(second.theme).toBe('dark');
  });

  it('a phone from before AF2 (theme only) gets the default', () => {
    mockSaved.set('settings', JSON.stringify({ state: { theme: 'dark' }, version: 0 }));
    expect(restart().getState().demoData).toBe(true);
  });

  it('ignores a damaged value', () => {
    mockSaved.set('settings', JSON.stringify({ state: { theme: 'dark', demoData: 'yes' }, version: 0 }));
    expect(restart().getState().demoData).toBe(true);
  });
});


// CA1.1: the Map opens on the route last picked
describe('settings store: the Map route', () => {
  it('is All routes (null) by default', () => {
    expect(restart().getState().mapRoute).toBeNull();
  });

  it('a picked route survives a restart, and All routes again too', () => {
    restart().getState().setMapRoute('R1');
    expect(restart().getState().mapRoute).toBe('R1');
    restart().getState().setMapRoute(null);
    expect(restart().getState().mapRoute).toBeNull();
  });

  it('ignores a damaged value', () => {
    mockSaved.set('settings', JSON.stringify({ state: { mapRoute: 4 }, version: 0 }));
    expect(restart().getState().mapRoute).toBeNull();
  });
});

// RL2a (Emjay, D9): the Relay form's "Show me on the live map" starts off and keeps the last choice
describe('settings store: the relay live map switch', () => {
  it('is off by default', () => {
    expect(restart().getState().relayLiveMap).toBe(false);
  });

  it('a switch to on survives a restart, and back to off too', () => {
    restart().getState().setRelayLiveMap(true);
    expect(restart().getState().relayLiveMap).toBe(true);
    restart().getState().setRelayLiveMap(false);
    expect(restart().getState().relayLiveMap).toBe(false);
  });

  it('ignores a damaged value', () => {
    mockSaved.set('settings', JSON.stringify({ state: { relayLiveMap: 'yes' }, version: 0 }));
    expect(restart().getState().relayLiveMap).toBe(false);
  });
});
