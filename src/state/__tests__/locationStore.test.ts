import { createStore } from 'zustand/vanilla';

import {
  locationStateCreator,
  selectLocationAllowed,
  selectOrigin,
  selectShowExplainer,
  type LocationFix,
  type PermissionResult,
} from '../locationStore';

// The store keeps the consent on the phone; jest hoists this above the imports
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined },
}));

const GRANTED: PermissionResult = { permission: 'granted', canAskAgain: true };
const DENIED: PermissionResult = { permission: 'denied', canAskAgain: true };
const UNDETERMINED: PermissionResult = { permission: 'undetermined', canAskAgain: true };

const FIX: LocationFix = {
  lat: 8.947459,
  lon: 125.541426,
  accuracyM: 12,
  headingDeg: null,
  speedMps: null,
  timestampMs: 1,
  mocked: false,
};

const T0 = Date.UTC(2026, 9, 6, 2, 0, 0);

// Most tests start after the G0 consent; the consent tests start before it
const unconsented = () => createStore(locationStateCreator);
const newStore = () => {
  const store = unconsented();
  store.getState().agree(T0);
  return store;
};

describe('location store: consent before any permission request (G0)', () => {
  it('shows no system prompt without consent, even after the explainer', async () => {
    const store = unconsented();
    const ask = jest.fn().mockResolvedValue(GRANTED);
    store.getState().setPermission(UNDETERMINED);
    store.getState().acceptExplainer();
    await store.getState().requestPermission(ask);
    expect(ask).not.toHaveBeenCalled();

    store.getState().agree(T0);
    await store.getState().requestPermission(ask);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('ignores fixes without consent, though Android allows location', () => {
    const store = unconsented();
    store.getState().setPermission(GRANTED);
    store.getState().setFix(FIX);
    expect(store.getState().fix).toBeNull();
    expect(selectLocationAllowed(store.getState())).toBe(false);
  });

  it('withdrawing drops the fix, refuses new ones and asks no more', async () => {
    const store = newStore();
    store.getState().setPermission(GRANTED);
    store.getState().setFix(FIX);
    expect(selectLocationAllowed(store.getState())).toBe(true);

    store.getState().withdraw(T0 + 1);
    expect(store.getState().fix).toBeNull();
    expect(selectLocationAllowed(store.getState())).toBe(false);
    store.getState().setFix(FIX);
    expect(store.getState().fix).toBeNull();

    const ask = jest.fn().mockResolvedValue(GRANTED);
    store.getState().acceptExplainer();
    await store.getState().requestPermission(ask);
    expect(ask).not.toHaveBeenCalled();
  });

  it('a manual pin still works after withdrawing (reduced mode)', () => {
    const store = newStore();
    store.getState().withdraw(T0 + 1);
    store.getState().setManualOrigin({ lat: 8.946096, lon: 125.533083 });
    expect(selectOrigin(store.getState())).toEqual({ lat: 8.946096, lon: 125.533083 });
  });
});

describe('location store: explainer before prompt', () => {
  it('does not show the system prompt until the explainer is accepted', async () => {
    const store = newStore();
    const ask = jest.fn().mockResolvedValue(GRANTED);
    store.getState().setPermission(UNDETERMINED);

    await store.getState().requestPermission(ask);
    expect(ask).not.toHaveBeenCalled();
    expect(store.getState().permission).toBe('undetermined');

    store.getState().acceptExplainer();
    await store.getState().requestPermission(ask);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(store.getState().permission).toBe('granted');
  });

  it('does not show the system prompt after "Not now"', async () => {
    const store = newStore();
    const ask = jest.fn().mockResolvedValue(GRANTED);
    store.getState().setPermission(UNDETERMINED);
    store.getState().dismissExplainer();

    await store.getState().requestPermission(ask);
    expect(ask).not.toHaveBeenCalled();
  });

  it('is not shown at app start, only after the first Locate me tap (merge decision 6)', () => {
    const store = newStore();
    store.getState().setPermission(UNDETERMINED);
    expect(store.getState().explainer).toBe('idle');
    expect(selectShowExplainer(store.getState())).toBe(false);

    store.getState().reopenExplainer();
    expect(selectShowExplainer(store.getState())).toBe(true);
  });

  it('shows the explainer only while location is not allowed and it is unanswered', () => {
    const store = newStore();
    expect(selectShowExplainer(store.getState())).toBe(false);

    store.getState().setPermission(UNDETERMINED);
    store.getState().reopenExplainer();
    expect(selectShowExplainer(store.getState())).toBe(true);

    store.getState().dismissExplainer();
    expect(selectShowExplainer(store.getState())).toBe(false);

    store.getState().reopenExplainer();
    expect(selectShowExplainer(store.getState())).toBe(true);

    store.getState().setPermission(GRANTED);
    expect(selectShowExplainer(store.getState())).toBe(false);
  });
});

describe('location store: denied enables manual pin', () => {
  it('uses the manual pin as the origin and keeps the fix empty', async () => {
    const store = newStore();
    store.getState().setPermission(UNDETERMINED);
    store.getState().acceptExplainer();
    await store.getState().requestPermission(jest.fn().mockResolvedValue(DENIED));
    expect(store.getState().permission).toBe('denied');

    store.getState().setManualOrigin({ lat: 8.946096, lon: 125.533083 });
    expect(selectOrigin(store.getState())).toEqual({ lat: 8.946096, lon: 125.533083 });
    expect(store.getState().fix).toBeNull();
  });

  it('ignores a fix that arrives while location is not allowed', () => {
    const store = newStore();
    store.getState().setPermission(DENIED);
    store.getState().setFix(FIX);
    expect(store.getState().fix).toBeNull();
  });

  it('has no origin when there is neither a fix nor a pin', () => {
    expect(selectOrigin(newStore().getState())).toBeNull();
  });
});

describe('location store: fix', () => {
  it('prefers the live fix over the manual pin', () => {
    const store = newStore();
    store.getState().setManualOrigin({ lat: 8.9, lon: 125.6 });
    store.getState().setPermission(GRANTED);
    store.getState().setFix(FIX);
    expect(selectOrigin(store.getState())).toEqual({ lat: FIX.lat, lon: FIX.lon });
  });

  it('drops the fix when permission is taken away', () => {
    const store = newStore();
    store.getState().setPermission(GRANTED);
    store.getState().setFix(FIX);
    store.getState().setPermission(DENIED);
    expect(store.getState().fix).toBeNull();
  });
});
