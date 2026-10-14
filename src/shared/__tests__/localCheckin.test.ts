import { CHECKIN_LIFETIME_S, CHECKIN_REMINDER_MIN } from '../config';
import { boardingEndsCheckIn, formatCountdown, isActive, parseStoredCheckIn, reminderAtMs, remainingMs, startCheckIn } from '../checkin/localCheckin';
import { mergeWaiting } from '../checkin/waiting';
import { verifyCheckIn } from '../verification/verifyCheckIn';

// A fixed clock, not the real one
const T0 = Date.UTC(2026, 9, 3, 7, 0, 0);
const SECOND = 1000;
const MINUTE = 60 * SECOND;

describe('local check-in lifecycle', () => {
  const checkIn = startCheckIn('R4', 'RCA', T0);

  it('lasts 15 minutes from the moment of checking in', () => {
    expect(CHECKIN_LIFETIME_S).toBe(900);
    expect(checkIn).toEqual({ routeCode: 'R4', routeCodes: ['R4'], stationCode: 'RCA', createdAtMs: T0, expiresAtMs: T0 + 15 * MINUTE });
    expect(isActive(checkIn, T0)).toBe(true);
    expect(isActive(checkIn, T0 + 15 * MINUTE - 1)).toBe(true);
    expect(isActive(checkIn, T0 + 15 * MINUTE)).toBe(false);
  });

  it('counts down in mm:ss from the stored expiry time', () => {
    expect(formatCountdown(remainingMs(checkIn, T0))).toBe('15:00');
    expect(formatCountdown(remainingMs(checkIn, T0 + 1))).toBe('15:00');
    expect(formatCountdown(remainingMs(checkIn, T0 + SECOND))).toBe('14:59');
    expect(formatCountdown(remainingMs(checkIn, T0 + 10 * MINUTE + 30 * SECOND))).toBe('04:30');
    expect(formatCountdown(remainingMs(checkIn, T0 + 15 * MINUTE - 1))).toBe('00:01');
    expect(formatCountdown(remainingMs(checkIn, T0 + 15 * MINUTE))).toBe('00:00');
  });

  it('survives a restart: the same stored value gives the same countdown', () => {
    const stored = JSON.parse(JSON.stringify(checkIn)) as unknown;
    const restored = parseStoredCheckIn(stored);
    expect(restored).toEqual(checkIn);
    expect(formatCountdown(remainingMs(restored!, T0 + 6 * MINUTE))).toBe('09:00');
  });

  it('keeps every route pinged at a shared stop; a value stored before that has one route', () => {
    const shared = startCheckIn(['R4', 'R3'], 'RCA', T0);
    expect(shared).toMatchObject({ routeCode: 'R4', routeCodes: ['R4', 'R3'] });
    expect(parseStoredCheckIn(JSON.parse(JSON.stringify(shared)))).toEqual(shared);
    const { routeCodes: _dropped, ...older } = checkIn;
    expect(parseStoredCheckIn(older)?.routeCodes).toEqual(['R4']);
  });

  it('is expired after a long time away, and never shows a negative time', () => {
    const later = T0 + 3 * 60 * MINUTE;
    expect(isActive(checkIn, later)).toBe(false);
    expect(remainingMs(checkIn, later)).toBe(0);
    expect(formatCountdown(remainingMs(checkIn, later))).toBe('00:00');
  });

  it('cancel and "I boarded" both clear it: nothing is active', () => {
    expect(isActive(null, T0)).toBe(false);
  });

  it('ignores a stored value that is not a check-in', () => {
    expect(parseStoredCheckIn(null)).toBeNull();
    expect(parseStoredCheckIn({ routeCode: 'R4' })).toBeNull();
    expect(parseStoredCheckIn({ ...checkIn, expiresAtMs: 'soon' })).toBeNull();
    expect(parseStoredCheckIn({ ...checkIn, expiresAtMs: T0 - 1 })).toBeNull();
  });
});

describe('verifyCheckIn', () => {
  it('returns unverified with verification_disabled while verification is off', () => {
    expect(verifyCheckIn({ routeCode: 'R4', stationCode: 'RCA' })).toEqual({
      status: 'unverified',
      reasons: ['verification_disabled'],
    });
  });
});

describe('B3: reminder and merged waiting counts', () => {
  it('reminds 5 minutes in, and not when the check-in ends first', () => {
    const t0 = Date.UTC(2026, 9, 6, 2);
    const running = startCheckIn('R4', 'RCA', t0);
    expect(CHECKIN_REMINDER_MIN).toBe(5);
    expect(reminderAtMs(running, CHECKIN_REMINDER_MIN)).toBe(t0 + 5 * 60000);
    const short = startCheckIn('R4', 'RCA', t0, t0 + 4 * 60000);
    expect(reminderAtMs(short, CHECKIN_REMINDER_MIN)).toBeNull();
  });

  it('keeps the larger count per station, never the sum, and null when nothing is known', () => {
    const merged = mergeWaiting([new Map([['RCA', 2], ['JCA', 1]]), null, new Map([['RCA', 3]])]);
    expect(merged && [...merged.entries()].sort()).toEqual([['JCA', 1], ['RCA', 3]]);
    expect(mergeWaiting([null, null])).toBeNull();
  });
});

describe('DR8: a verified boarding ends the check-in (PRD 7.5 auto-cancel)', () => {
  const NOW = 1_700_000_000_000;
  const shared = startCheckIn(['R4', 'R6'], 'SMB', NOW);

  it('ends it on any of its routes', () => {
    expect(boardingEndsCheckIn(shared, 'R4', NOW + 1000)).toBe(true);
    expect(boardingEndsCheckIn(shared, 'R6', NOW + 1000)).toBe(true);
  });

  it('leaves it on another route, once expired, or with no check-in', () => {
    expect(boardingEndsCheckIn(shared, 'R1', NOW + 1000)).toBe(false);
    expect(boardingEndsCheckIn(shared, 'R4', shared.expiresAtMs)).toBe(false);
    expect(boardingEndsCheckIn(null, 'R4', NOW)).toBe(false);
  });
});
