import { dispatchDecision, inOperatingHours, type DispatchState } from '../sms/dispatch';

// A time on 2026-10-12, Asia/Manila (UTC+8)
const manila = (hours: number, minutes = 0, seconds = 0, day = 12) => Date.UTC(2026, 9, day, hours - 8, minutes, seconds);
const MIN = 60_000;

const sent = (counts: Record<string, number>, sentAtMs: number): DispatchState => ({ counts, sentAtMs });

describe('SMS dispatch rule (PRD 9.6; DR2)', () => {
  it('sends only from 05:00 to before 21:00 Manila (Q6)', () => {
    expect(inOperatingHours(manila(4, 59, 59))).toBe(false);
    expect(inOperatingHours(manila(5))).toBe(true);
    expect(inOperatingHours(manila(20, 59, 59))).toBe(true);
    expect(inOperatingHours(manila(21))).toBe(false);
    expect(dispatchDecision(null, { SMB: 3 }, manila(4, 59))).toEqual({ send: false });
    expect(dispatchDecision(null, { SMB: 3 }, manila(21, 5))).toEqual({ send: false });
  });

  it('sends the first message of the day once anyone is waiting', () => {
    expect(dispatchDecision(null, { SMB: 0, ZAM: 0 }, manila(7))).toEqual({ send: false });
    expect(dispatchDecision(null, { SMB: 1 }, manila(7))).toEqual({ send: true, reason: 'first' });
    const yesterday = sent({ SMB: 4 }, manila(20, 50, 0, 11));
    expect(dispatchDecision(yesterday, { SMB: 4 }, manila(5, 1))).toEqual({ send: true, reason: 'first' });
    expect(dispatchDecision(yesterday, { SMB: 0 }, manila(5, 1))).toEqual({ send: false });
  });

  it('sends when a stop changes by 2 or more, not by 1', () => {
    const last = sent({ SMB: 3, ZAM: 1 }, manila(8));
    expect(dispatchDecision(last, { SMB: 4, ZAM: 1 }, manila(8, 1))).toEqual({ send: false });
    expect(dispatchDecision(last, { SMB: 5, ZAM: 1 }, manila(8, 1))).toEqual({ send: true, reason: 'change' });
    expect(dispatchDecision(last, { SMB: 3, ZAM: 1, CSU: 2 }, manila(8, 1))).toEqual({ send: true, reason: 'change' });
    // A stop that drops out of the counts went to zero
    expect(dispatchDecision(last, { ZAM: 1 }, manila(8, 1))).toEqual({ send: true, reason: 'change' });
  });

  // Owner, 2026-10-15 (backlog 113): a lone commuter at an empty stop is sent at once, not after up
  // to 5 minutes (the DR6 run saw 3.5 min)
  it('sends at once when a stop the driver last saw empty gets someone', () => {
    const afterCleared = sent({ SMB: 0, ZAM: 0 }, manila(8));
    expect(dispatchDecision(afterCleared, { SMB: 1, ZAM: 0 }, manila(8, 1))).toEqual({ send: true, reason: 'new_stop' });
    // A stop missing from the last counts was empty too
    expect(dispatchDecision(sent({ ZAM: 2 }, manila(8)), { ZAM: 2, CSU: 1 }, manila(8, 1))).toEqual({ send: true, reason: 'new_stop' });
    // The second commuter at a stop the driver already sees waits for a change of 2 or the interval
    const one = sent({ SMB: 1, ZAM: 0 }, manila(8, 1));
    expect(dispatchDecision(one, { SMB: 2, ZAM: 0 }, manila(8, 2))).toEqual({ send: false });
    // From 0 to 2 or more it is still a change
    expect(dispatchDecision(afterCleared, { SMB: 2, ZAM: 0 }, manila(8, 1))).toEqual({ send: true, reason: 'change' });
  });

  it('sends every 5 minutes while anyone is waiting', () => {
    const last = sent({ SMB: 3 }, manila(8));
    expect(dispatchDecision(last, { SMB: 3 }, manila(8) + 5 * MIN - 1)).toEqual({ send: false });
    expect(dispatchDecision(last, { SMB: 3 }, manila(8) + 5 * MIN)).toEqual({ send: true, reason: 'interval' });
  });

  it('sends one "cleared" message when everyone has gone, then nothing', () => {
    const last = sent({ SMB: 1, ZAM: 0 }, manila(8));
    expect(dispatchDecision(last, { SMB: 0, ZAM: 0 }, manila(8, 1))).toEqual({ send: true, reason: 'cleared' });
    expect(dispatchDecision(last, {}, manila(8, 1))).toEqual({ send: true, reason: 'cleared' });
    const afterCleared = sent({ SMB: 0, ZAM: 0 }, manila(8, 1));
    expect(dispatchDecision(afterCleared, { SMB: 0, ZAM: 0 }, manila(8, 30))).toEqual({ send: false });
  });
});
