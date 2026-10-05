// The demo Crowdsource feed (restyle): reports as the real feed will hold them (PRD 19 D2: a preset
// phrase, an optional seat tier, the author's handle, with or without GPS; gone after
// FEED_LIFETIME_MIN). Computed on the phone from the seed and the clock, so every phone shows the
// same posts at the same time. Always labelled "Demo". Pure: no React Native or Expo imports.

import { DEMO_FEED_SLOT_MAX, DEMO_FEED_SLOT_MIN, FEED_LIFETIME_MIN, FEED_PHRASES } from '../config';
import type { SeatTier } from '../telemetry/occupancy';
import { childSeed, seededRandom } from '../util/random';

export type FeedPhrase = (typeof FEED_PHRASES)[number];

export type FeedPost = {
  id: string;
  routeCode: string;
  phrase: FeedPhrase;
  seatTier: SeatTier | null;
  username: string;
  withGps: boolean;
  postedMs: number;
  demo: boolean;
};

// Made-up handles, clearly not real people
const DEMO_HANDLES = ['demo_rider', 'demo_juan', 'demo_maria', 'demo_student', 'demo_commuter', 'demo_lola'];
const SEAT_TIERS: readonly (SeatTier | null)[] = ['green', 'amber', 'red', null];
const MS_PER_MIN = 60000;
// Share of demo posts sent with GPS
const GPS_SHARE = 0.5;

// Posts younger than FEED_LIFETIME_MIN, newest first
export function demoFeed(routeCodes: readonly string[], nowMs: number, seed: number): FeedPost[] {
  if (routeCodes.length === 0) return [];
  const slotMs = DEMO_FEED_SLOT_MIN * MS_PER_MIN;
  const lifetimeMs = FEED_LIFETIME_MIN * MS_PER_MIN;
  const lastSlot = Math.floor(nowMs / slotMs);
  const firstSlot = Math.floor((nowMs - lifetimeMs) / slotMs);
  const posts: FeedPost[] = [];
  for (let slot = firstSlot; slot <= lastSlot; slot += 1) {
    const random = seededRandom(childSeed(seed, `feed-${slot}`));
    const count = random.int(0, DEMO_FEED_SLOT_MAX);
    for (let n = 0; n < count; n += 1) {
      const postedMs = slot * slotMs + Math.floor(random.next() * slotMs);
      const post: FeedPost = {
        id: `demo-${slot}-${n}`,
        routeCode: routeCodes[random.int(0, routeCodes.length - 1)],
        phrase: FEED_PHRASES[random.int(0, FEED_PHRASES.length - 1)],
        seatTier: SEAT_TIERS[random.int(0, SEAT_TIERS.length - 1)],
        username: DEMO_HANDLES[random.int(0, DEMO_HANDLES.length - 1)],
        withGps: random.next() < GPS_SHARE,
        postedMs,
        demo: true,
      };
      if (postedMs <= nowMs && nowMs - postedMs < lifetimeMs) posts.push(post);
    }
  }
  return posts.sort((a, b) => b.postedMs - a.postedMs);
}
