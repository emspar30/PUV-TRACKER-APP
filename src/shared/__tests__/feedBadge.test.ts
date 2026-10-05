// N1: the neutral author badge of a feed post (PRD 19 D2)

import { FEED_BADGE_COLOR_COUNT } from '../config';
import { feedBadge } from '../feed/badge';

describe('the neutral feed badge', () => {
  it('is the same for the same handle, whatever the case', () => {
    expect(feedBadge('Juan_D')).toEqual(feedBadge('juan_d'));
  });

  it('takes the first letter or digit, after the demo prefix', () => {
    expect(feedBadge('maria').initial).toBe('M');
    expect(feedBadge('demo_lola').initial).toBe('L');
    expect(feedBadge('_9lives').initial).toBe('9');
    expect(feedBadge('___').initial).toBe('?');
  });

  it('picks one of the theme colours, and spreads handles across them', () => {
    const handles = ['juan', 'maria', 'pedro', 'ana', 'jose', 'luz', 'ramon', 'nena', 'toto', 'inday', 'boy', 'lito'];
    const indexes = handles.map((handle) => feedBadge(handle).colorIndex);
    for (const index of indexes) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(FEED_BADGE_COLOR_COUNT);
    }
    expect(new Set(indexes).size).toBeGreaterThan(2);
    expect(feedBadge('juan', 0).colorIndex).toBe(0);
  });
});
