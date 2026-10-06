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
  // B4: null when the rider gave only the seats ("What's happening" is optional)
  phrase: FeedPhrase | null;
  seatTier: SeatTier | null;
  // B6: the multicab's ID when the rider picked it (or Bluetooth found it); null when not known
  vehicleId: string | null;
  // B6: the stop nearest to where the relay was sent; null when none was near
  stopCode: string | null;
  // B6: the author was Trusted when they sent it (TRUST_BADGE_POINTS)
  trusted: boolean;
  username: string;
  withGps: boolean;
  postedMs: number;
  demo: boolean;
};

// Made-up handles, clearly not real people
const DEMO_HANDLES = ['demo_rider', 'demo_juan', 'demo_maria', 'demo_student', 'demo_commuter', 'demo_lola'];
const SEAT_TIERS: readonly (SeatTier | null)[] = ['green', 'amber', 'red', null];
const MS_PER_MIN = 60000;
// Share of demo posts sent with GPS, from Trusted authors, and naming a multicab
const GPS_SHARE = 0.5;
const TRUSTED_SHARE = 0.4;
const VEHICLE_SHARE = 0.7;
const DEMO_VEHICLES_PER_ROUTE = 4;

// Posts younger than FEED_LIFETIME_MIN, newest first. stopsOf gives a route's stop codes, for "Near ..."
export function demoFeed(
  routeCodes: readonly string[],
  nowMs: number,
  seed: number,
  stopsOf: (routeCode: string) => readonly string[] = () => [],
): FeedPost[] {
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
      const routeCode = routeCodes[random.int(0, routeCodes.length - 1)];
      const phrase = FEED_PHRASES[random.int(0, FEED_PHRASES.length - 1)];
      const seatTier = SEAT_TIERS[random.int(0, SEAT_TIERS.length - 1)];
      const username = DEMO_HANDLES[random.int(0, DEMO_HANDLES.length - 1)];
      const withGps = random.next() < GPS_SHARE;
      const stops = stopsOf(routeCode);
      const stopCode = stops.length > 0 ? stops[random.int(0, stops.length - 1)] : null;
      const vehicleId = random.next() < VEHICLE_SHARE ? `${routeCode}-0${random.int(1, DEMO_VEHICLES_PER_ROUTE)}` : null;
      const trusted = random.next() < TRUSTED_SHARE;
      const post: FeedPost = { id: `demo-${slot}-${n}`, routeCode, phrase, seatTier, vehicleId, stopCode, trusted, username, withGps, postedMs, demo: true };
      if (postedMs <= nowMs && nowMs - postedMs < lifetimeMs) posts.push(post);
    }
  }
  return posts.sort((a, b) => b.postedMs - a.postedMs);
}
