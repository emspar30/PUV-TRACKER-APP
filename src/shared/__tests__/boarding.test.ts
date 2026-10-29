// CA1.1: "Did you board?" when a multicab of a pinged route stands at the check-in's stop.

import { boardingCandidate, boardingPlace, standingAtStop } from '../checkin/boarding';
import { parseStoredCheckIn, startCheckIn } from '../checkin/localCheckin';
import { CHECKIN_BOARD_DWELL_S, CHECKIN_BOARD_NEAR_M, COVERAGE_LIVE_MAX_AGE_S, DEMO_STOP_MIN_S, DEMO_TICK_MS, STATIONARY_SPEED_KMH } from '../config';
import type { VehicleSnapshot } from '../telemetry/vehicle';

const T0 = Date.UTC(2026, 9, 22, 2, 0, 0);
const STOP = { lat: 8.95, lon: 125.54 };
// About 111 km per degree of latitude
const north = (metres: number) => ({ lat: STOP.lat + metres / 111000, lon: STOP.lon });

const vehicle = (over: Partial<VehicleSnapshot> = {}): VehicleSnapshot => ({
  id: 'R4-01',
  label: 'DEMO 01',
  routeCode: 'R4',
  lineId: 'R4-out',
  ...north(10),
  headingDeg: 0,
  speedKmh: 0,
  seatsTaken: 3,
  lastPacketMs: T0,
  recentSpeeds: [],
  demo: true,
  ...over,
});

describe('standing at the stop', () => {
  it('a Live multicab of a pinged route, still and close, counts', () => {
    expect(standingAtStop([vehicle()], STOP, ['R4'], T0).map((v) => v.id)).toEqual(['R4-01']);
  });

  it('another route, moving, too far, stale or hidden does not', () => {
    const out = [
      vehicle({ id: 'a', routeCode: 'R5' }),
      vehicle({ id: 'b', speedKmh: STATIONARY_SPEED_KMH }),
      vehicle({ id: 'c', ...north(CHECKIN_BOARD_NEAR_M + 20) }),
      vehicle({ id: 'd', lastPacketMs: T0 - (COVERAGE_LIVE_MAX_AGE_S + 1) * 1000 }),
      vehicle({ id: 'e', hidden: true }),
    ];
    expect(standingAtStop(out, STOP, ['R4'], T0)).toEqual([]);
  });
});

describe('when to ask', () => {
  const dwellMs = CHECKIN_BOARD_DWELL_S * 1000;

  it('after the dwell, once per multicab', () => {
    const first = boardingCandidate([vehicle()], {}, [], T0);
    expect(first.ask).toBeNull();
    const later = boardingCandidate([vehicle()], first.since, [], T0 + dwellMs);
    expect(later.ask?.id).toBe('R4-01');
    expect(boardingCandidate([vehicle()], later.since, ['R4-01'], T0 + 2 * dwellMs).ask).toBeNull();
  });

  it('a multicab that leaves starts its dwell again', () => {
    const first = boardingCandidate([vehicle()], {}, [], T0);
    const gone = boardingCandidate([], first.since, [], T0 + dwellMs / 2);
    expect(gone.since).toEqual({});
    expect(boardingCandidate([vehicle()], gone.since, [], T0 + dwellMs).ask).toBeNull();
  });

  it('another multicab is asked about after one was answered Not yet', () => {
    const since = { 'R4-01': T0, 'R4-02': T0 };
    const ask = boardingCandidate([vehicle(), vehicle({ id: 'R4-02' })], since, ['R4-01'], T0 + dwellMs).ask;
    expect(ask?.id).toBe('R4-02');
  });

  // Emjay, 2026-10-29: a demo multicab's shortest stop at Tiniwisan was never asked about. The stand
  // is first seen on the tick after it starts, so the dwell plus one tick must fit in the shortest stop.
  it('every demo stop is long enough to be asked about', () => {
    expect(CHECKIN_BOARD_DWELL_S * 1000 + DEMO_TICK_MS).toBeLessThanOrEqual(DEMO_STOP_MIN_S * 1000);
  });
});

// CA2b: a commuter may check in up to 300 m from the stop, so the multicab is looked for where they stand
describe('boarding near the check-in point (CA2b)', () => {
  const T = T0;
  const point = north(250);

  it('looks where the commuter checked in, not at the stop 250 m away', () => {
    const checkIn = startCheckIn(['R4'], 'SMB', T, T + 900000, point);
    const atPoint = vehicle({ ...north(255) });
    const atStop = vehicle({ id: 'R4-02', ...north(5) });
    expect(standingAtStop([atPoint, atStop], boardingPlace(checkIn, STOP), ['R4'], T).map((v) => v.id)).toEqual(['R4-01']);
  });

  it('falls back to the stop for an older record without a point', () => {
    const old = parseStoredCheckIn({ routeCode: 'R4', stationCode: 'SMB', createdAtMs: T, expiresAtMs: T + 900000 });
    expect(old?.point).toBeUndefined();
    expect(boardingPlace(old as NonNullable<typeof old>, STOP)).toEqual(STOP);
  });

  it('keeps the point through storage', () => {
    const stored = JSON.parse(JSON.stringify(startCheckIn(['R4'], 'SMB', T, T + 900000, point)));
    expect(parseStoredCheckIn(stored)?.point).toEqual(point);
  });
});
