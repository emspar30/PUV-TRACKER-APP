// The Crowdsource feed kept on the phone (2026-11-03): saved when it loads, shown offline, never
// past the feed's lifetime.
import { FEED_LIFETIME_MIN } from '../config';
import type { FeedPost } from '../demo/feed';
import { feedToSave, isSavedPost, keptPosts } from '../feed/saved';

const NOW = Date.UTC(2026, 10, 3, 6, 0, 0);
const MIN = 60_000;

function post(id: string, minutesAgo: number, extra: Partial<FeedPost> = {}): FeedPost {
  return {
    id,
    routeCode: 'R4',
    phrase: 'few_seats',
    seatTier: 'amber',
    vehicleId: null,
    stopCode: 'SMB',
    trusted: false,
    username: 'rider_one',
    liveMap: false,
    postedMs: NOW - minutesAgo * MIN,
    demo: false,
    ...extra,
  };
}

describe('saved Crowdsource feed', () => {
  it('keeps only the posts inside the feed lifetime', () => {
    const kept = keptPosts([post('a', 5), post('b', FEED_LIFETIME_MIN - 1), post('c', FEED_LIFETIME_MIN), post('d', 90)], NOW);
    expect(kept.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('saves live posts with the time, never demo ones', () => {
    const saved = feedToSave([post('a', 5), post('demo', 2, { demo: true }), post('old', 61)], NOW);
    expect(saved).toEqual({ posts: [post('a', 5)], savedMs: NOW });
  });

  it('saving an empty feed keeps it empty, so old reports do not come back', () => {
    expect(feedToSave([], NOW)).toEqual({ posts: [], savedMs: NOW });
  });

  it('reads back only well-formed live posts', () => {
    expect(isSavedPost(post('a', 1))).toBe(true);
    expect(isSavedPost(post('a', 1, { verified: true, phrase: null, seatTier: null }))).toBe(true);
    expect(isSavedPost(post('a', 1, { ended: true }))).toBe(true);
    expect(isSavedPost({ ...post('a', 1), ended: 'yes' })).toBe(false);
    expect(isSavedPost(post('a', 1, { demo: true }))).toBe(false);
    expect(isSavedPost({ ...post('a', 1), phrase: 'party' })).toBe(false);
    expect(isSavedPost({ ...post('a', 1), postedMs: 'yesterday' })).toBe(false);
    expect(isSavedPost(null)).toBe(false);
    expect(isSavedPost('post')).toBe(false);
  });
});
