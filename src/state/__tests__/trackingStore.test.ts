// CA1.1: the Map tab's red dot follows the tracked multicab's nearness, and ends with tracking.

import { useTrackingStore } from '../trackingStore';

const SESSION = { vehicleId: 'v1', routeCode: 'R1', endsAtMs: 1, alertOn: false };

afterEach(() => {
  useTrackingStore.getState().stop();
});

describe('tracking store: near', () => {
  it('starts not near, and a new session clears it', () => {
    useTrackingStore.getState().start(SESSION);
    expect(useTrackingStore.getState().near).toBe(false);
    useTrackingStore.getState().setNear(true);
    useTrackingStore.getState().start({ ...SESSION, vehicleId: 'v2' });
    expect(useTrackingStore.getState().near).toBe(false);
  });

  it('stop clears it', () => {
    useTrackingStore.getState().start(SESSION);
    useTrackingStore.getState().setNear(true);
    useTrackingStore.getState().stop();
    expect(useTrackingStore.getState().near).toBe(false);
  });
});
