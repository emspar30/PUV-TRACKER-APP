import { strings } from '@/strings';

import { describeRowLabel, describeUpdate } from '../features/heatmap/describe';

// The heatmap's age in words (DR5). Owner, 2026-10-18: an hour or more reads as hours and minutes.
describe('heatmap age in words', () => {
  const stale = (ageMin: number) => describeUpdate({ freshness: 'stale', ageMin });

  it('says minutes under an hour', () => {
    expect(stale(15)).toEqual({ tone: 'bad', label: 'No update for 15 min' });
    expect(stale(59)).toEqual({ tone: 'bad', label: 'No update for 59 min' });
  });

  it('says hours and minutes from an hour on', () => {
    expect(stale(66).label).toBe('No update for 1 hr 6 min');
    expect(stale(60).label).toBe('No update for 1 hr');
    expect(stale(125).label).toBe('No update for 2 hr 5 min');
    expect(stale(652).label).toBe('No update for 10 hr 52 min');
  });

  it('keeps the fresh and never-updated wording', () => {
    expect(describeUpdate({ freshness: 'fresh', ageMin: 0 })).toEqual({ tone: 'ok', label: strings.driver.heatmap.justNow });
    expect(describeUpdate({ freshness: 'fresh', ageMin: 3 })).toEqual({ tone: 'ok', label: strings.driver.heatmap.updated(3) });
    expect(describeUpdate({ freshness: 'never', ageMin: null })).toEqual({ tone: 'warn', label: strings.driver.heatmap.never });
  });
});

// Owner, 2026-10-31: a fill stop's sub-row names the real stop it sits under
describe('stop row labels for the screen reader', () => {
  const row = (name: string, display: Parameters<typeof describeRowLabel>[0]['display']) => ({ code: 'X', name, display });

  it('reads a stop with its count, its band at night, or no count yet', () => {
    expect(describeRowLabel(row('Antongalon', { kind: 'known', band: 1, exact: 2 }))).toBe('Antongalon: 2 waiting');
    expect(describeRowLabel(row('Antongalon', { kind: 'known', band: 2, exact: null }))).toBe('Antongalon: 5–9');
    expect(describeRowLabel(row('Antongalon', { kind: 'unknown' }))).toBe('Antongalon: No count yet');
  });

  it('reads a sub-row with the real stop it is under', () => {
    expect(describeRowLabel(row('Near Petron', { kind: 'known', band: 1, exact: 1 }), 'LTFRB')).toBe('Near Petron, near LTFRB: 1 waiting');
    expect(describeRowLabel(row('Near Petron', { kind: 'known', band: 1, exact: null }), 'LTFRB')).toBe('Near Petron, near LTFRB: 1–4');
  });
});
