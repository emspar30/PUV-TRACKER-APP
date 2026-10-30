// RL2c (D12): the queued relay. Released only with one beacon and RELAY_QUEUE_RELEASE_M along the
// line; the ends that post nothing. Positions are taken along the shipped R4 line.

import { getSeedRouteData } from '../../data/routeSource';
import { RELAY_QUEUE_BEACON_GONE_S, RELAY_QUEUE_MAX_MIN, RELAY_QUEUE_RELEASE_M, RELAY_SAME_VEHICLE_GAP_H } from '../config';
import { pointAtChainage, type LineCoordinates } from '../geo/line';
import { movedAlongM, queueStep, startQueue, type QueueBeacons, type QueueInput, type RelayQueue } from '../relay/queue';

const data = getSeedRouteData();
const LINES: LineCoordinates[] = data.lines.filter((line) => line.routeCode === 'R4').map((line) => line.coordinates);
const LINE = LINES[0];
const KM_START = 1;
const M_PER_KM = 1000;
const MS_PER_S = 1000;
const at = (metresOn: number) => pointAtChainage(LINE, KM_START + metresOn / M_PER_KM);
// About 100 m north of the line's point (0.0009 degree of latitude)
const OFF_LINE_DEG = 0.0009;

const T0 = 1_790_000_000_000;
const A = { routeCode: 'R4', vehicleId: 'R4-A', plate: 'TEST 001' };
const B = { routeCode: 'R4', vehicleId: 'R4-B', plate: 'TEST 002' };
const one = (vehicle = A): QueueBeacons => ({ kind: 'one', vehicle });
const NONE: QueueBeacons = { kind: 'none' };
const SEVERAL: QueueBeacons = { kind: 'several' };

const queue = (): RelayQueue => startQueue('R4', at(0), T0);
const input = (overrides: Partial<QueueInput>): QueueInput => ({ beacons: one(), position: at(0), lines: LINES, nowMs: T0 + MS_PER_S, recentRelays: [], ...overrides });

describe('RL2c queued relay', () => {
  it('measures the ride along the line, not off it', () => {
    expect(movedAlongM(LINES, at(0), at(60))).toBeCloseTo(60, 0);
    const off = { lat: at(60).lat + OFF_LINE_DEG, lon: at(60).lon };
    expect(movedAlongM(LINES, at(0), off)).toBe(0);
  });

  it('one beacon and 60 m along R4: released on that multicab', () => {
    expect(queueStep(queue(), input({ position: at(60) }))).toEqual({ kind: 'release', vehicle: A });
  });

  it('waits at the stop, and 100 m off the line with a beacon', () => {
    expect(queueStep(queue(), input({ position: at(RELAY_QUEUE_RELEASE_M - 10) })).kind).toBe('waiting');
    const off = { lat: at(100).lat + OFF_LINE_DEG, lon: at(100).lon };
    expect(queueStep(queue(), input({ position: off })).kind).toBe('waiting');
  });

  it('two beacons keep it waiting; it is released on the one still heard as the other fades', () => {
    expect(queueStep(queue(), input({ beacons: SEVERAL, position: at(80) })).kind).toBe('waiting');
    expect(queueStep(queue(), input({ beacons: one(B), position: at(80) }))).toEqual({ kind: 'release', vehicle: B });
  });

  it('parked 10 min, then moved to another multicab that leaves: that one is released', () => {
    let q = queue();
    const parked = queueStep(q, input({ beacons: one(A), nowMs: T0 + 10 * 60 * MS_PER_S }));
    if (parked.kind !== 'waiting') throw new Error(parked.kind);
    q = parked.queue;
    expect(queueStep(q, input({ beacons: one(B), position: at(70), nowMs: T0 + 11 * 60 * MS_PER_S }))).toEqual({ kind: 'release', vehicle: B });
  });

  it('a beacon lost for a moment keeps it; gone for 30 s ends it (walked away)', () => {
    expect(queueStep(queue(), input({ beacons: NONE, nowMs: T0 + (RELAY_QUEUE_BEACON_GONE_S - 1) * MS_PER_S })).kind).toBe('waiting');
    expect(queueStep(queue(), input({ beacons: NONE, nowMs: T0 + RELAY_QUEUE_BEACON_GONE_S * MS_PER_S }))).toEqual({ kind: 'ended', reason: 'walked_away' });
  });

  it('ends with location off, after 30 min, on another route, or the same multicab within 3 h', () => {
    expect(queueStep(queue(), input({ position: null }))).toEqual({ kind: 'ended', reason: 'location_off' });
    expect(queueStep(queue(), input({ nowMs: T0 + RELAY_QUEUE_MAX_MIN * 60 * MS_PER_S }))).toEqual({ kind: 'ended', reason: 'timed_out' });
    expect(queueStep(queue(), input({ beacons: one({ ...A, routeCode: 'R5' }), position: at(60) }))).toEqual({ kind: 'ended', reason: 'other_route' });
    const recent = [{ vehicleId: 'R4-A', atMs: T0 - (RELAY_SAME_VEHICLE_GAP_H * 3600 - 60) * MS_PER_S }];
    expect(queueStep(queue(), input({ position: at(60), recentRelays: recent }))).toEqual({ kind: 'ended', reason: 'same_vehicle' });
  });
});
