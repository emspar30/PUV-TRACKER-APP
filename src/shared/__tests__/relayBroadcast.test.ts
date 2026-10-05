import { RELAY_BROADCAST_MAX_MIN, RELAY_DESTINATION_ARRIVED_M } from '../config';
import { broadcastEnd, destinationOptions, inRouteOrder, type RelayBroadcast } from '../relay/broadcast';

const T0 = Date.UTC(2026, 9, 6, 2, 0, 0);
const MIN = 60_000;
// About 111 m per 0.001 degree of latitude
const DEG_PER_M = 0.001 / 111;
const DEST = { code: 'MCA', name: 'Market', lat: 8.95, lon: 125.53 };
const SESSION: RelayBroadcast = { routeCode: 'R4', vehicleId: null, destination: DEST, startedMs: T0 };
const north = (m: number) => ({ lat: DEST.lat + m * DEG_PER_M, lon: DEST.lon });

describe('relay broadcast (B4)', () => {
  it('ends when the rider reaches the destination', () => {
    expect(broadcastEnd(SESSION, north(RELAY_DESTINATION_ARRIVED_M - 10), T0 + MIN)).toBe('arrived');
  });

  it('goes on while the rider is still away from it', () => {
    expect(broadcastEnd(SESSION, north(RELAY_DESTINATION_ARRIVED_M + 50), T0 + MIN)).toBeNull();
    expect(broadcastEnd(SESSION, null, T0 + MIN)).toBeNull();
  });

  it('ends after the time limit even without a position', () => {
    expect(broadcastEnd(SESSION, null, T0 + RELAY_BROADCAST_MAX_MIN * MIN)).toBe('expired');
  });

  it('leaves out the stop the rider is at from the destinations', () => {
    const near = { ...DEST, code: 'A', ...north(10) };
    const far = { ...DEST, code: 'B', ...north(1000) };
    expect(destinationOptions([near, far], DEST).map((stop) => stop.code)).toEqual(['B']);
    expect(destinationOptions([near, far], null).map((stop) => stop.code)).toEqual(['A', 'B']);
  });

  it('lists the stops in riding order along the longest line', () => {
    const line: [number, number][] = [
      [DEST.lon, DEST.lat],
      [DEST.lon, north(3000).lat],
    ];
    const short: [number, number][] = [
      [DEST.lon, north(3000).lat],
      [DEST.lon, north(2900).lat],
    ];
    const stops = [2000, 100, 1000].map((m) => ({ ...DEST, code: String(m), ...north(m) }));
    expect(inRouteOrder([short, line], stops).map((stop) => stop.code)).toEqual(['100', '1000', '2000']);
    expect(inRouteOrder([], stops)).toEqual(stops);
  });
});
