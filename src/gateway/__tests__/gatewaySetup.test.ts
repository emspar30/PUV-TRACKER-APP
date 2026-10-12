// DR7: the gateway app's setup rules, status words and stored setup (plan DR7 tests:
// gatewaySetup.test). The URL rule (http:// refused outside development builds) and expired setup
// codes are tested with the shared code in src/shared/__tests__/provisioning.test.ts.

import {
  GATEWAY_BACKOFF_S,
  GATEWAY_EVENTS_MAX,
  GATEWAY_HEARTBEAT_S,
  GATEWAY_PULL_MAX,
  GATEWAY_PULL_S,
  GATEWAY_SEND_GAP_MS,
  GATEWAY_SENT_TIMEOUT_S,
} from '@/shared/config';
import type { GatewayProvisioning } from '@/shared/driver/provisioning';
import { strings } from '@/strings';

import { canStartGateway, describeGateway, gatewaySettings } from '../features/service';
import { GATEWAY_NOT_AVAILABLE, gatewayStatus, gatewayStart, type GatewayStatus } from '../../../modules/tunton-sms';

const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));

const NOW = Date.UTC(2026, 9, 13, 4, 0);
const MIN = 60_000;
const running: GatewayStatus = {
  ...GATEWAY_NOT_AVAILABLE,
  setUp: true,
  enabled: true,
  running: true,
  gatewayId: 'GW-01',
  workerUrl: 'https://worker.example.com',
  workerReachable: true,
  lastPullMs: NOW - 5000,
  lastError: null,
};
const text = strings.gateway.status;

describe('gateway status in words (DR7)', () => {
  it('says running while it reaches the worker', () => {
    expect(describeGateway(running, NOW)).toEqual({ tone: 'ok', label: text.running });
  });

  it.each([
    ['not set up', { setUp: false }, 'bad', text.notSetUp],
    ['stopped', { enabled: false }, 'warn', text.stopped],
    ['starting', { running: false }, 'warn', text.starting],
    ['refused by the worker', { lastError: 'unauthorized' }, 'bad', text.unauthorized],
    ['unreachable', { workerReachable: false, lastError: 'worker_unreachable' }, 'bad', text.unreachable],
    ['not connected yet', { workerReachable: null, lastPullMs: null }, 'warn', text.connecting],
  ] as const)('says %s', (_name, overrides, tone, label) => {
    expect(describeGateway({ ...running, ...overrides }, NOW)).toEqual({ tone, label });
  });

  it('says how long it has been quiet after 5 minutes without a pull', () => {
    expect(describeGateway({ ...running, lastPullMs: NOW - 6 * MIN }, NOW)).toEqual({ tone: 'bad', label: text.quiet(6) });
  });
});

describe('gateway service settings (DR7)', () => {
  it('starts the service with the values from shared/config', () => {
    expect(gatewaySettings()).toEqual({
      pullS: GATEWAY_PULL_S,
      heartbeatS: GATEWAY_HEARTBEAT_S,
      sendGapMs: GATEWAY_SEND_GAP_MS,
      sentTimeoutS: GATEWAY_SENT_TIMEOUT_S,
      pullMax: GATEWAY_PULL_MAX,
      backoffS: [...GATEWAY_BACKOFF_S],
      eventsMax: GATEWAY_EVENTS_MAX,
      notificationTitle: strings.gateway.notification.title,
      notificationText: strings.gateway.notification.text,
    });
  });

  it('may start only when set up and allowed to send SMS', () => {
    expect(canStartGateway({ setUp: true }, true)).toBe(true);
    expect(canStartGateway({ setUp: true }, false)).toBe(false);
    expect(canStartGateway({ setUp: false }, true)).toBe(false);
  });

  it('reports "not available" without the native module, and refuses to start', async () => {
    expect(gatewayStatus()).toEqual(GATEWAY_NOT_AVAILABLE);
    expect(() => gatewayStart(gatewaySettings())).toThrow(/not in this build/);
  });
});

describe('gateway stored setup (DR7)', () => {
  const PAYLOAD: GatewayProvisioning = {
    v: 1,
    kind: 'gateway',
    exp: 2_000_000_000,
    adminPinHash: 'a'.repeat(64),
    adminPinSalt: 'b'.repeat(32),
    gatewayId: 'GW-01',
    workerUrl: 'https://worker.example.com',
    // Made-up test value
    token: 'T'.repeat(43),
  };

  afterEach(() => mockSaved.clear());

  it('never stores the access token', () => {
    let store: typeof import('../state/gatewayStore') | undefined;
    jest.isolateModules(() => {
      store = jest.requireActual('../state/gatewayStore');
    });
    if (!store) throw new Error('store not loaded');
    store.useGatewayStore.getState().setSetup(store.gatewaySetupFrom({ ...PAYLOAD }, NOW));
    expect(store.useGatewayStore.getState().setup).toEqual({
      gatewayId: 'GW-01',
      workerUrl: 'https://worker.example.com',
      adminPinHash: PAYLOAD.adminPinHash,
      adminPinSalt: PAYLOAD.adminPinSalt,
      provisionedAtMs: NOW,
    });
    expect([...mockSaved.values()].join('')).not.toContain(PAYLOAD.token);
  });

  it('falls back to "not set up" for a damaged saved value', () => {
    mockSaved.set('gateway', JSON.stringify({ state: { setup: { gatewayId: 'GW-01' } }, version: 0 }));
    let store: typeof import('../state/gatewayStore') | undefined;
    jest.isolateModules(() => {
      store = jest.requireActual('../state/gatewayStore');
    });
    expect(store?.useGatewayStore.getState().setup).toBeNull();
  });
});
