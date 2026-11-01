// DRG4: the driver app's registration wiring (native modules, storage and the network mocked). The
// flow's rules are tested in src/shared/__tests__/registrationFlow.test.ts and the function's in
// registrationFunctions.test.ts; this checks the store, the calls to the function, the photo upload,
// and setting the phone up from a collected setup.

import type { DriverProvisioning } from '@/shared/driver/provisioning';

// jest.mock calls are hoisted above these imports

const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));

jest.mock('../../../modules/tunton-sms', () => ({
  isSmsAvailable: () => true,
  isInboxConfigured: () => true,
  configureInbox: async () => undefined,
}));

const mockBeacon = { bluetoothOn: true, provisioned: [] as unknown[][], advertising: 0 };
jest.mock('../../../modules/tunton-beacon', () => ({
  isBeaconAvailable: () => true,
  getSupport: () => ({ bluetooth: true, advertising: true, bluetoothOn: mockBeacon.bluetoothOn }),
  provision: async (...args: unknown[]) => {
    mockBeacon.provisioned.push(args);
  },
  startAdvertising: async () => {
    mockBeacon.advertising += 1;
  },
}));

const mockFile: { size: number | null; status: number; uploads: { url: string; options: unknown }[] } = { size: 1000, status: 200, uploads: [] };
jest.mock('expo-file-system', () => ({
  UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return mockFile.size;
    }
    async upload(url: string, options: unknown) {
      mockFile.uploads.push({ url, options });
      return { status: mockFile.status, body: '', headers: {} };
    }
  },
}));

type Modules = {
  api: typeof import('../features/registration/api');
  device: typeof import('../features/registration/device');
  store: typeof import('../state/registrationStore');
  setup: typeof import('../features/setup/applySetup');
  driver: typeof import('../state/driverStore');
};

// Loads the modules afresh (a restart), with the project's address in the environment or not
function load(configured = true): Modules {
  if (configured) {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.example';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  } else {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
  let loaded: Modules | undefined;
  jest.isolateModules(() => {
    loaded = {
      api: jest.requireActual('../features/registration/api'),
      device: jest.requireActual('../features/registration/device'),
      store: jest.requireActual('../state/registrationStore'),
      setup: jest.requireActual('../features/setup/applySetup'),
      driver: jest.requireActual('../state/driverStore'),
    };
  });
  if (!loaded) throw new Error('modules not loaded');
  return loaded;
}

// Made-up test values only
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456';
const CHECK = '0f8fad5b-d9cb-469f-a165-70867728950e';
const SETUP: DriverProvisioning = {
  v: 1,
  kind: 'driver',
  exp: Math.floor(Date.now() / 1000) + 900,
  adminPinHash: 'a'.repeat(64),
  adminPinSalt: 'b'.repeat(32),
  deviceId: 'DRV-0011',
  vehicleId: 'R4-ABC1234',
  shortId: 7,
  routeCode: 'R4',
  plate: 'ABC 1234',
  beaconSecret: 'c'.repeat(64),
  smsKey: 'd'.repeat(64),
  gatewayNumbers: ['+639171234567'],
};

const fetchMock = jest.fn();
const answer = (status: number, body: unknown) => fetchMock.mockResolvedValueOnce({ status, json: async () => body });

beforeEach(() => {
  mockSaved.clear();
  mockBeacon.bluetoothOn = true;
  mockBeacon.provisioned = [];
  mockBeacon.advertising = 0;
  mockFile.size = 1000;
  mockFile.status = 200;
  mockFile.uploads = [];
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('calls to the registration function', () => {
  it('posts the action with the publishable key, and returns the answer', async () => {
    const { api } = load();
    const started = { ok: true, phone: '+639171234567', check: CHECK, uploads: { id: 'https://upload/id', vehicle: 'https://upload/vehicle' }, submitWithinS: 3600 };
    answer(200, started);
    expect(await api.startRegistration('+639171234567')).toEqual(started);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://project.example/functions/v1/driver-registration');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ apikey: 'sb_publishable_test', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ action: 'start', phone: '+639171234567' });
  });

  it('passes on the function\'s refusal, and says offline when nothing answers', async () => {
    const { api } = load();
    answer(429, { ok: false, error: 'number_limit' });
    expect(await api.startRegistration('+639171234567')).toEqual({ ok: false, error: 'number_limit' });
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    expect(await api.startRegistration('+639171234567')).toEqual({ ok: false, error: 'offline' });
    fetchMock.mockResolvedValueOnce({ status: 502, json: async () => Promise.reject(new SyntaxError('not JSON')) });
    expect(await api.registrationStatus(TOKEN)).toEqual({ ok: false, error: 'server_error' });
  });

  it('cannot register in a build without the project\'s address', async () => {
    const { api } = load(false);
    expect(await api.startRegistration('+639171234567')).toEqual({ ok: false, error: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('takes a collected setup only through the setup QR\'s parser', async () => {
    const { api } = load();
    answer(200, { ok: true, setup: SETUP });
    expect(await api.collectSetup(TOKEN)).toEqual({ ok: true, setup: SETUP });
    answer(200, { ok: true, setup: { ...SETUP, smsKey: 'not hex' } });
    expect(await api.collectSetup(TOKEN)).toEqual({ ok: false, error: 'server_error' });
    answer(200, { ok: true, setup: { ...SETUP, exp: 1 } });
    expect(await api.collectSetup(TOKEN)).toEqual({ ok: false, error: 'server_error' });
  });
});

describe('photo upload', () => {
  it('sends the JPEG as it is with PUT', async () => {
    const { device } = load();
    expect(await device.uploadPhoto('file:///photo.jpg', 'https://upload/id.jpg')).toBe('ok');
    expect(mockFile.uploads).toEqual([
      { url: 'https://upload/id.jpg', options: { httpMethod: 'PUT', uploadType: 0, headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' } } },
    ]);
  });

  it('refuses a photo over 1 MB before sending, and reports a refused upload', async () => {
    const { device } = load();
    mockFile.size = 1_000_001;
    expect(await device.uploadPhoto('file:///photo.jpg', 'https://upload/id.jpg')).toBe('too_big');
    expect(mockFile.uploads).toEqual([]);
    mockFile.size = 1000;
    mockFile.status = 400;
    expect(await device.uploadPhoto('file:///photo.jpg', 'https://upload/id.jpg')).toBe('failed');
  });
});

describe('the registration store', () => {
  it('remembers the progress and the token across a restart, never a photo or a secret', () => {
    const { store } = load();
    store.useRegistrationStore.getState().setChecked('+639171234567', CHECK, { id: 'https://upload/id', vehicle: 'https://upload/vehicle' }, 1000);
    store.useRegistrationStore.getState().setVehicle('ABC 1234', 'R4');
    store.useRegistrationStore.getState().setUploaded('id');
    store.useRegistrationStore.getState().setToken(TOKEN);
    const saved = [...mockSaved.values()].join('\n');
    expect(saved).not.toMatch(/file:\/\/|beaconSecret|smsKey/);

    const restarted = load().store.useRegistrationStore.getState();
    expect(restarted).toMatchObject({ phone: '+639171234567', check: CHECK, checkedAtMs: 1000, plate: 'ABC 1234', route: 'R4', uploaded: { id: true, vehicle: false }, token: TOKEN });
  });

  it('a new number starts the photos over and keeps the plate and route (an edit from "Check and send")', () => {
    const { store } = load();
    const state = store.useRegistrationStore.getState();
    state.setChecked('+639171234567', CHECK, { id: 'a', vehicle: 'b' }, 1000);
    state.setVehicle('ABC 1234', 'R4');
    state.setUploaded('vehicle');
    state.setChecked('+639189876543', CHECK, { id: 'c', vehicle: 'd' }, 2000);
    expect(store.useRegistrationStore.getState()).toMatchObject({
      phone: '+639189876543',
      plate: 'ABC 1234',
      route: 'R4',
      uploaded: { id: false, vehicle: false },
      uploads: { id: 'c', vehicle: 'd' },
    });
  });

  it('falls back to nothing done from a damaged saved value, and drops a malformed token', () => {
    const { store } = load();
    expect(store.validProgress('nonsense')).toMatchObject({ phone: null, token: null });
    expect(store.validProgress({ token: 'short', uploaded: { id: 'yes' } })).toMatchObject({ token: null, uploaded: { id: false, vehicle: false } });
  });
});

describe('setting the phone up from a collected setup', () => {
  it('refuses before collecting when Bluetooth is off, so the one-time setup is not lost', () => {
    const { setup } = load();
    mockBeacon.bluetoothOn = false;
    expect(setup.setupBlock()).toBe('bluetooth_off');
  });

  it('puts the secrets in the Keystore, saves the setup without them, and starts the beacon', async () => {
    const { setup, driver } = load();
    expect(await setup.applySetup(SETUP)).toBe('done');
    expect(mockBeacon.provisioned).toEqual([[7, SETUP.beaconSecret, SETUP.smsKey]]);
    expect(mockBeacon.advertising).toBe(1);
    const saved = driver.useDriverStore.getState();
    expect(saved.setup).toMatchObject({ deviceId: 'DRV-0011', plate: 'ABC 1234', routeCode: 'R4' });
    expect(saved.beaconEnabled).toBe(true);
    expect(JSON.stringify(saved.setup)).not.toContain(SETUP.smsKey);
  });
});
