// RL1: the relay's watch starts with the session, "Keep sharing" restarts the 3-hour cap, and Stop clears it.

import { askedWatch } from '@/shared/relay/limits';

import { useRelayStore } from '../relayStore';

const T0 = Date.UTC(2026, 9, 22, 2, 0, 0);
const SESSION = {
  routeCode: 'R4',
  vehicleId: null,
  seatTier: 'green' as const,
  destination: { code: 'DST', name: 'Destination', lat: 8.99, lon: 125.6 },
  startedMs: T0,
  startPoint: null,
  terminals: [],
};

afterEach(() => {
  useRelayStore.getState().stop();
});

describe('relay store: watch (RL1)', () => {
  it('a new session starts a fresh watch from its start', () => {
    useRelayStore.getState().start(SESSION);
    expect(useRelayStore.getState().watch).toEqual({ arrivingSinceMs: null, idle: null, capFromMs: T0, askedMs: null });
  });

  it('Keep sharing restarts the cap and clears the question', () => {
    useRelayStore.getState().start(SESSION);
    useRelayStore.getState().setWatch(askedWatch(useRelayStore.getState().watch, T0 + 1));
    useRelayStore.getState().renew(T0 + 2);
    expect(useRelayStore.getState().watch).toMatchObject({ capFromMs: T0 + 2, askedMs: null });
  });

  it('Keep sharing after the relay ended does nothing', () => {
    const before = useRelayStore.getState().watch;
    useRelayStore.getState().renew(T0);
    expect(useRelayStore.getState().watch).toBe(before);
    expect(useRelayStore.getState().session).toBeNull();
  });
});
