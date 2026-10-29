import { driftSample, driftStatus } from '../driver/drift';
import { ageMinutes, applyMessage, displayCount, emptyHeatmap, freshness, heatmapBand } from '../driver/heatmap';
import { isSameNumber, normalizePhNumber } from '../driver/phone';
import type { HeatmapMessage } from '../sms/protocol';

const manila = (hours: number, minutes = 0) => Date.UTC(2026, 9, 12, hours - 8, minutes);
const MIN = 60_000;

const message = (seq: number, nodes: [string, number][], route = 'R4'): HeatmapMessage => ({
  route,
  seq,
  minuteOfDay: 0,
  nodes: nodes.map(([code, count]) => ({ code, count })),
});

describe('driver heatmap state (PRD 9.3, 9.4; DR2)', () => {
  const NOON = manila(12);

  it('knows nothing before the first message: every stop unknown, never "0"', () => {
    const state = emptyHeatmap('R4');
    expect(freshness(state, NOON)).toBe('never');
    expect(ageMinutes(state, NOON)).toBeNull();
    expect(displayCount(state, 'SMB', NOON)).toEqual({ kind: 'unknown' });
  });

  it('merges messages: listed stops update, the others keep their value', () => {
    let state = applyMessage(emptyHeatmap('R4'), message(1, [['SMB', 3], ['ZAM', 0]]), NOON);
    state = applyMessage(state, message(2, [['ZAM', 6], ['CSU', 1]]), NOON + MIN);
    expect(state.counts).toEqual({ SMB: 3, ZAM: 6, CSU: 1 });
    expect(state.lastSeq).toBe(2);
    expect(state.lastAcceptedMs).toBe(NOON + MIN);
    expect(displayCount(state, 'ZAM', NOON + MIN)).toEqual({ kind: 'known', band: 2, exact: 6, near: 0 });
    expect(displayCount(state, 'TAL', NOON + MIN)).toEqual({ kind: 'unknown' });
  });

  it('ignores a message for another route', () => {
    const state = emptyHeatmap('R4');
    expect(applyMessage(state, message(1, [['SMB', 3]], 'R2'), NOON)).toBe(state);
  });

  it('bands counts as 0, 1 to 4, 5 to 9, 10 or more', () => {
    expect([0, 1, 4, 5, 9, 10, 25].map(heatmapBand)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });

  it('goes stale 15 minutes after the last valid message (PRD 0.2 S9)', () => {
    const state = applyMessage(emptyHeatmap('R4'), message(1, [['SMB', 3]]), NOON);
    expect(freshness(state, NOON + 15 * MIN - 100)).toBe('fresh');
    expect(freshness(state, NOON + 15 * MIN)).toBe('stale');
    expect(ageMinutes(state, NOON + 17 * MIN + 30_000)).toBe(17);
  });

  it('shows exact numbers by day and only bands from 21:00 (Q5, Q11)', () => {
    const state = applyMessage(emptyHeatmap('R4'), message(1, [['SMB', 1]]), manila(20, 55));
    expect(displayCount(state, 'SMB', manila(20, 59))).toEqual({ kind: 'known', band: 1, exact: 1, near: 0 });
    expect(displayCount(state, 'SMB', manila(21))).toEqual({ kind: 'known', band: 1, exact: null, near: 0 });
    expect(displayCount(state, 'SMB', manila(4, 30))).toEqual({ kind: 'known', band: 1, exact: null, near: 0 });
  });
});

describe('driver clock check (PRD 8.2, 14; DR2)', () => {
  it('measures the phone against the carrier', () => {
    expect(driftSample(100_000, 5_000)).toBe(95);
    expect(driftSample(5_000, 100_000)).toBe(-95);
  });

  it('warns beyond 90 s, either way', () => {
    expect(driftStatus([95])).toEqual({ kind: 'warn', driftS: 95 });
    expect(driftStatus([90])).toEqual({ kind: 'ok', driftS: 90 });
    expect(driftStatus([85])).toEqual({ kind: 'ok', driftS: 85 });
    expect(driftStatus([-100])).toEqual({ kind: 'warn', driftS: -100 });
  });

  it('trusts the fastest message: a delayed one does not raise a false warning', () => {
    expect(driftStatus([85, 400])).toEqual({ kind: 'ok', driftS: 85 });
    expect(driftStatus([300, 95, 96])).toEqual({ kind: 'warn', driftS: 95 });
  });

  it('looks only at the last 5 samples, and knows nothing without one', () => {
    expect(driftStatus([10, 200, 200, 200, 200, 200])).toEqual({ kind: 'warn', driftS: 200 });
    expect(driftStatus([])).toEqual({ kind: 'unknown' });
  });
});

describe('Philippine mobile numbers (DR2)', () => {
  it('writes every form as E.164', () => {
    for (const raw of ['09171234567', '639171234567', '+639171234567', '+63 917-123-4567', '(0917) 123 4567']) {
      expect(normalizePhNumber(raw)).toBe('+639171234567');
    }
  });

  it('refuses what is not a Philippine mobile number', () => {
    for (const raw of ['0852251234', '1234', '+6591234567', '0917123456', '091712345678', 'TM-ALERT', '']) {
      expect(normalizePhNumber(raw)).toBeNull();
    }
  });

  it('compares numbers in any form', () => {
    expect(isSameNumber('09171234567', '+639171234567')).toBe(true);
    expect(isSameNumber('09171234567', '09171234568')).toBe(false);
    expect(isSameNumber('TM-ALERT', 'TM-ALERT')).toBe(false);
  });
});
