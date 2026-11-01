import { strings } from '@/strings';

import { describeUpdate } from '../features/heatmap/describe';

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
