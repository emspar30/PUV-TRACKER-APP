// The Crowdsource feed kept on the phone (Emjay, 2026-11-03): the last live feed that loaded is saved,
// so the reports still show offline, after a failed load, or when the app is reopened without a
// connection. Only posts still inside FEED_LIFETIME_MIN are kept or shown, like on the server.
// Pure: no React Native or Expo imports.

import { FEED_LIFETIME_MIN, FEED_PHRASES } from '../config';
import type { FeedPost } from '../demo/feed';

const MS_PER_MIN = 60_000;
const SEAT_TIERS = ['green', 'amber', 'red'] as const;

export type SavedFeed = { posts: FeedPost[]; savedMs: number | null };

const isText = (value: unknown): value is string => typeof value === 'string';
const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';

// A saved post read back from storage: every field the card needs, of the right type
export function isSavedPost(value: unknown): value is FeedPost {
  if (typeof value !== 'object' || value === null) return false;
  const post = value as Record<string, unknown>;
  return (
    isText(post.id) &&
    isText(post.routeCode) &&
    (post.phrase === null || (FEED_PHRASES as readonly unknown[]).includes(post.phrase)) &&
    (post.seatTier === null || (SEAT_TIERS as readonly unknown[]).includes(post.seatTier)) &&
    isTextOrNull(post.vehicleId) &&
    isTextOrNull(post.stopCode) &&
    typeof post.trusted === 'boolean' &&
    isText(post.username) &&
    typeof post.liveMap === 'boolean' &&
    (post.verified === undefined || typeof post.verified === 'boolean') &&
    typeof post.postedMs === 'number' &&
    Number.isFinite(post.postedMs) &&
    post.demo === false
  );
}

// The posts still inside the feed's lifetime at nowMs
export function keptPosts(posts: readonly FeedPost[], nowMs: number): FeedPost[] {
  const oldest = nowMs - FEED_LIFETIME_MIN * MS_PER_MIN;
  return posts.filter((post) => post.postedMs > oldest);
}

// What to save from a feed that loaded: live posts only, inside the lifetime
export function feedToSave(posts: readonly FeedPost[], nowMs: number): SavedFeed {
  return { posts: keptPosts(posts.filter((post) => !post.demo), nowMs), savedMs: nowMs };
}
