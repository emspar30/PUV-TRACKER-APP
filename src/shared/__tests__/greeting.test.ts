import { greetingPeriod, manilaHour, pickGreeting } from '../profile/greeting';

// Manila is UTC+8: 08:00 Manila is 00:00 UTC
const manila = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 9, day, hour - 8, minute));

const VARIANTS = {
  morning: ['m1', 'm2'],
  afternoon: ['a1', 'a2'],
  evening: ['e1', 'e2'],
  night: ['n1', 'n2'],
} as const;

describe('greetingPeriod follows the Asia/Manila clock', () => {
  it.each([
    [4, 59, 'night'],
    [5, 0, 'morning'],
    [10, 59, 'morning'],
    [11, 0, 'afternoon'],
    [16, 59, 'afternoon'],
    [17, 0, 'evening'],
    [20, 59, 'evening'],
    [21, 0, 'night'],
    [23, 59, 'night'],
    [0, 0, 'night'],
  ] as const)('%i:%i Manila is %s', (hour, minute, period) => {
    expect(greetingPeriod(manila(3, hour, minute))).toBe(period);
  });

  it('does not depend on the phone time zone: 23:30 UTC is 07:30 Manila, morning', () => {
    const date = new Date(Date.UTC(2026, 9, 3, 23, 30));
    expect(manilaHour(date)).toBe(7);
    expect(greetingPeriod(date)).toBe('morning');
  });
});

describe('pickGreeting', () => {
  it('returns a line of the right period', () => {
    expect(['m1', 'm2']).toContain(pickGreeting(VARIANTS, manila(3, 8)));
    expect(['n1', 'n2']).toContain(pickGreeting(VARIANTS, manila(3, 22)));
  });

  it('is the same all through one period of one day, and changes on the next day', () => {
    const first = pickGreeting(VARIANTS, manila(3, 6));
    expect(pickGreeting(VARIANTS, manila(3, 10, 59))).toBe(first);
    expect(pickGreeting(VARIANTS, manila(4, 6))).not.toBe(first);
  });

  it('returns an empty line when a period has no variants', () => {
    expect(pickGreeting({ ...VARIANTS, morning: [] }, manila(3, 8))).toBe('');
  });
});
