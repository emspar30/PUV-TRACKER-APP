// Demo check-ins and reports (C1, RP1; Demo data on): kept in memory on this phone and paid into
// the demo wallet by the same rules as the server, so the whole earn-and-spend loop can be shown
// without an account. Other people waiting are made up from the seed and the clock. Sends nothing.
// Pure: no React Native or Expo imports.

import { CHECKIN_LIFETIME_S, DEMO_CHECKIN_OTHERS_MAX, DEMO_CHECKIN_SLOT_MIN, FEED_LIFETIME_MIN } from '../../shared/config';
import type { FeedPost } from '../../shared/demo/feed';
import { childSeed, seededRandom } from '../../shared/util/random';
import type { CrowdRepositories } from '../repositories/select';
import type { DemoEnergy } from './demoEnergy';

const MS_PER_S = 1000;
const MS_PER_MIN = 60000;

type Mine = { routeCodes: readonly string[]; stationCode: string; expiresAtMs: number };

export function createDemoCrowd(
  energy: DemoEnergy,
  username: () => string | null,
  seed: number,
  now: () => number = Date.now,
): CrowdRepositories {
  let mine: Mine | null = null;
  let posts: FeedPost[] = [];

  return {
    checkins: {
      source: 'demo',

      async waitingCounts(routeCode, stationCodes) {
        const atMs = now();
        const slot = Math.floor(atMs / (DEMO_CHECKIN_SLOT_MIN * MS_PER_MIN));
        const counts = new Map<string, number>();
        for (const code of stationCodes) {
          const others = seededRandom(childSeed(seed, `checkins-${routeCode}-${code}-${slot}`)).int(0, DEMO_CHECKIN_OTHERS_MAX);
          const me = mine && mine.routeCodes.includes(routeCode) && mine.stationCode === code && mine.expiresAtMs > atMs ? 1 : 0;
          if (others + me > 0) counts.set(code, others + me);
        }
        return counts;
      },

      async checkIn(routeCodes, stationCode, requestKey) {
        const expiresAtMs = now() + CHECKIN_LIFETIME_S * MS_PER_S;
        mine = { routeCodes, stationCode, expiresAtMs };
        energy.earn('checkin', requestKey);
        return { ok: true, expiresAtMs };
      },

      async end() {
        mine = null;
      },
    },

    reports: {
      source: 'demo',

      async post(input, requestKey) {
        const name = username();
        if (!name) return { ok: false, reason: 'no_username' };
        const postedMs = now();
        posts = [
          {
            id: requestKey,
            routeCode: input.routeCode,
            phrase: input.phrase,
            seatTier: input.seatTier,
            vehicleId: input.vehicleId,
            stopCode: input.stopCode,
            trusted: false,
            username: name,
            withGps: input.withGps,
            postedMs,
            demo: true,
          },
          ...posts,
        ];
        energy.earn(input.withGps ? 'gps_report' : 'no_gps_report', requestKey);
        return { ok: true };
      },

      // The user's own demo posts younger than FEED_LIFETIME_MIN; the screen adds the made-up feed
      async recent() {
        const atMs = now();
        posts = posts.filter((post) => atMs - post.postedMs < FEED_LIFETIME_MIN * MS_PER_MIN);
        return posts;
      },

      // N1: nothing to send in demo; the screen hides the flagged post for this user
      async flag() {
        return { ok: true, hidden: false };
      },
    },
  };
}
