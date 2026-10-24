// Demo check-ins and reports (C1, RP1; Demo data on): kept in memory on this phone and paid into
// the demo wallet by the same rules as the server, so the whole earn-and-spend loop can be shown
// without an account. Other people waiting are made up from the seed and the clock. Sends nothing.
// Pure: no React Native or Expo imports.

import { CHECKIN_LIFETIME_S, DEMO_CHECKIN_OTHERS_MAX, DEMO_CHECKIN_SLOT_MIN, RELAY_POST_GRACE_MIN, RELAY_POST_REVIVE_MIN } from '../../shared/config';
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
  // RL2a: when each of the user's posts lapses (moved on by keep, set to now by end), and the ended ones
  const expiresMs = new Map<string, number>();
  const ended = new Set<string>();

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
        // CA1.1: paid first, for each route pinged
        if (!energy.chargeCheckIn(routeCodes.length, requestKey)) return { ok: false, reason: 'not_enough_energy' };
        const expiresAtMs = now() + CHECKIN_LIFETIME_S * MS_PER_S;
        mine = { routeCodes, stationCode, expiresAtMs };
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
        // RL2a (D10): as the server, no relay without its multicab (picked by hand in the demo)
        if (!input.vehicleId) return { ok: false, reason: 'no_beacon' };
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
            liveMap: input.liveMap,
            postedMs,
            demo: true,
          },
          ...posts,
        ];
        expiresMs.set(requestKey, postedMs + RELAY_POST_GRACE_MIN * MS_PER_MIN);
        // Until RL2b: the live map earns as a relay with GPS did (once a Manila day), Crowdsource nothing
        energy.earn(input.liveMap ? 'gps_report' : 'no_gps_report', requestKey);
        return { ok: true, postId: requestKey };
      },

      // RL2a: the "still riding" signal, by the server's rule: an ended post, or one lapsed
      // RELAY_POST_REVIVE_MIN or more, stays down
      async keep(postId) {
        const atMs = now();
        const until = expiresMs.get(postId);
        if (until === undefined || ended.has(postId) || atMs - until >= RELAY_POST_REVIVE_MIN * MS_PER_MIN) return false;
        expiresMs.set(postId, atMs + RELAY_POST_GRACE_MIN * MS_PER_MIN);
        return true;
      },

      async end(postId) {
        if (!expiresMs.has(postId)) return;
        ended.add(postId);
        expiresMs.set(postId, now());
      },

      // The user's own demo posts still up; the screen adds the made-up feed
      async recent() {
        const atMs = now();
        // A post lapsed RELAY_POST_REVIVE_MIN ago cannot come back, so it is forgotten
        posts = posts.filter((post) => atMs - (expiresMs.get(post.id) ?? 0) < RELAY_POST_REVIVE_MIN * MS_PER_MIN);
        return posts.filter((post) => (expiresMs.get(post.id) ?? 0) > atMs);
      },

      // N1: nothing to send in demo; the screen hides the flagged post for this user
      async flag() {
        return { ok: true, hidden: false };
      },
    },
  };
}
