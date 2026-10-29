// VS1: the status mark on a multicab marker. A recent relay about the multicab wins (newest first);
// otherwise its own speeds decide Stopped or Moving.

import { VEHICLE_STATUS_RELAY_MAX_MIN } from '../config';
import { demoVehicleIdOf } from '../demo/feed';
import { vehicleStatus, type StatusRelay } from '../telemetry/vehicleStatus';

const NOW = 1_000_000_000;
const MIN = 60_000;
const stoppedSpeeds = Array.from({ length: 11 }, (_v, index) => ({ atMs: NOW - (50 - index * 5) * 1000, speedKmh: 0 }));
const movingSpeeds = stoppedSpeeds.map((sample) => ({ ...sample, speedKmh: 20 }));
const moving = { id: 'v1', recentSpeeds: movingSpeeds, lastPacketMs: NOW };
const relay = (phrase: StatusRelay['phrase'], agoMin: number, vehicleId: string | null = 'v1'): StatusRelay => ({ vehicleId, phrase, postedMs: NOW - agoMin * MIN });

describe('vehicle status', () => {
  it('moving without a relay or a stop', () => {
    expect(vehicleStatus(moving, [], NOW)).toBe('moving');
  });

  it('stopped from its speeds, or a demo layover', () => {
    expect(vehicleStatus({ ...moving, recentSpeeds: stoppedSpeeds }, [], NOW)).toBe('stopped');
    expect(vehicleStatus({ ...moving, layover: true }, [], NOW)).toBe('stopped');
  });

  it('loading passengers and heavy traffic from a relay about it, Not moving as stopped', () => {
    expect(vehicleStatus(moving, [relay('loading', 1)], NOW)).toBe('loading');
    expect(vehicleStatus(moving, [relay('heavy_traffic', 1)], NOW)).toBe('traffic');
    expect(vehicleStatus(moving, [relay('not_moving', 1)], NOW)).toBe('stopped');
  });

  it('a relay status wins over the speeds', () => {
    expect(vehicleStatus({ ...moving, recentSpeeds: stoppedSpeeds }, [relay('loading', 1)], NOW)).toBe('loading');
  });

  it('ignores relays about seats only, about another multicab, or naming none', () => {
    expect(vehicleStatus(moving, [relay('full', 1), relay('few_seats', 1), relay(null, 1)], NOW)).toBe('moving');
    expect(vehicleStatus(moving, [relay('loading', 1, 'v2'), relay('loading', 1, null)], NOW)).toBe('moving');
  });

  it(`a relay older than ${VEHICLE_STATUS_RELAY_MAX_MIN} minutes no longer counts`, () => {
    expect(vehicleStatus(moving, [relay('loading', VEHICLE_STATUS_RELAY_MAX_MIN)], NOW)).toBe('loading');
    expect(vehicleStatus(moving, [relay('loading', VEHICLE_STATUS_RELAY_MAX_MIN + 1)], NOW)).toBe('moving');
  });

  it('a demo post names the demo multicab it is about', () => {
    expect(demoVehicleIdOf('R4-02')).toBe('demo-R4-2');
    expect(demoVehicleIdOf('R14-01')).toBe('demo-R14-1');
    expect(demoVehicleIdOf('a1b2-uuid')).toBe('a1b2-uuid');
  });

  it('the newest of two relays wins', () => {
    expect(vehicleStatus(moving, [relay('heavy_traffic', 5), relay('loading', 2)], NOW)).toBe('loading');
    expect(vehicleStatus(moving, [relay('heavy_traffic', 2), relay('loading', 5)], NOW)).toBe('traffic');
  });
});
