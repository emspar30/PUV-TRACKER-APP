// The demo Crowdsource feed: fixed seed and clock, only posts younger than the feed lifetime.

import { FEED_LIFETIME_MIN, FEED_PHRASES } from '../config';
import { demoFeed } from '../demo/feed';

const NOW = Date.UTC(2026, 9, 5, 2, 0, 0);
const MS_PER_MIN = 60000;
const SEED = 7;

describe('demo feed', () => {
  const posts = demoFeed(['T1', 'T2'], NOW, SEED);

  it('holds only posts from the last hour, newest first, all labelled demo', () => {
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(NOW - post.postedMs).toBeGreaterThanOrEqual(0);
      expect(NOW - post.postedMs).toBeLessThan(FEED_LIFETIME_MIN * MS_PER_MIN);
      expect(post.demo).toBe(true);
      expect(FEED_PHRASES).toContain(post.phrase);
      expect(['T1', 'T2']).toContain(post.routeCode);
      expect(post.username.startsWith('demo_')).toBe(true);
    }
    expect(posts.map((post) => post.postedMs)).toEqual([...posts.map((post) => post.postedMs)].sort((a, b) => b - a));
  });

  it('shows the same posts for the same seed and time, and keeps a post until it expires', () => {
    expect(demoFeed(['T1', 'T2'], NOW, SEED)).toEqual(posts);
    const later = demoFeed(['T1', 'T2'], NOW + MS_PER_MIN, SEED);
    const kept = posts.filter((post) => NOW + MS_PER_MIN - post.postedMs < FEED_LIFETIME_MIN * MS_PER_MIN);
    expect(later.filter((post) => kept.some((k) => k.id === post.id))).toEqual(kept);
  });

  it('is empty with no routes', () => {
    expect(demoFeed([], NOW, SEED)).toEqual([]);
  });
});
