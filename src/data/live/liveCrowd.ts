// Live check-ins and reports (C1, RP1): check_in, checkin_counts, end_check_in and post_report own
// every rule (one live check-in, lifetimes, the Energy earned), so this side only calls them and
// maps their answers. Pure: the network sits behind CrowdPort.

import { isFeedPhrase, type FeedPhrase } from '../../shared/backend/rules';
import type { FeedPost } from '../../shared/demo/feed';
import type { SeatTier } from '../../shared/telemetry/occupancy';
import type { CrowdRepositories } from '../repositories/select';
import type { CloudFailure, ReportInput } from '../repositories/types';
import type { PortFailure } from './liveEnergy';

export type FeedRow = {
  id: number | string;
  author_username: string;
  route_id: string;
  phrase: string | null;
  seat_tier: string | null;
  vehicle_id: string | null;
  stop_code: string | null;
  author_trusted: boolean;
  with_gps: boolean;
  created_at: string;
};

export type CrowdPort = {
  signedIn(): Promise<boolean>;
  // check_in(route, ...) for one route, check_in_routes(routes, ...) for several: the expiry time
  checkIn(routeCodes: readonly string[], stationCode: string, requestKey: string): Promise<{ expiresAt: string } | PortFailure>;
  checkinCounts(routeCode: string): Promise<{ station_code: string; waiting: number | string }[]>;
  endCheckIn(): Promise<PortFailure | null>;
  // post_report: the new post's id, or the error
  postReport(input: ReportInput, requestKey: string): Promise<PortFailure | { postId: string }>;
  // Live, visible feed_posts, newest first
  feed(): Promise<FeedRow[]>;
  // flag_post(post): true once the post is hidden
  flagPost(postId: number): Promise<{ hidden: boolean } | PortFailure>;
};

const NOT_SIGNED_IN = '28000';
// post_report raises this when the account has no username yet
const NO_USERNAME = 'P0001';
// ...and check_in when the wallet cannot pay (CA1.1). P0001 is also the code of any raise without
// one, so the message is matched too.
const NOT_ENOUGH_ENERGY = 'P0001';
const NOT_ENOUGH_ENERGY_MESSAGE = 'not enough energy';

const failure = (result: PortFailure): CloudFailure =>
  result.code === NOT_SIGNED_IN ? { ok: false, reason: 'sign_in' } : { ok: false, reason: 'error', message: result.message };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const SEAT_TIERS: readonly string[] = ['green', 'amber', 'red'];

export function feedPostOf(row: FeedRow): FeedPost | null {
  if (row.phrase !== null && !isFeedPhrase(row.phrase)) return null;
  return {
    id: String(row.id),
    routeCode: row.route_id,
    phrase: row.phrase as FeedPhrase | null,
    seatTier: row.seat_tier !== null && SEAT_TIERS.includes(row.seat_tier) ? (row.seat_tier as SeatTier) : null,
    vehicleId: row.vehicle_id,
    stopCode: row.stop_code,
    trusted: row.author_trusted,
    username: row.author_username,
    withGps: row.with_gps,
    postedMs: Date.parse(row.created_at),
    demo: false,
  };
}

export function createLiveCrowd(port: CrowdPort): CrowdRepositories {
  return {
    checkins: {
      source: 'live',

      async waitingCounts(routeCode) {
        if (!(await port.signedIn())) return null;
        const rows = await port.checkinCounts(routeCode);
        return new Map(rows.map((row) => [row.station_code, Number(row.waiting)]));
      },

      async checkIn(routeCodes, stationCode, requestKey) {
        if (!(await port.signedIn())) return { ok: false, reason: 'sign_in' };
        try {
          const result = await port.checkIn(routeCodes, stationCode, requestKey);
          if ('expiresAt' in result) return { ok: true, expiresAtMs: Date.parse(result.expiresAt) };
          // CA1.1: check_in and check_in_routes raise this when the wallet cannot pay
          return result.code === NOT_ENOUGH_ENERGY && result.message.includes(NOT_ENOUGH_ENERGY_MESSAGE) ? { ok: false, reason: 'not_enough_energy' } : failure(result);
        } catch (error) {
          return { ok: false, reason: 'error', message: messageOf(error) };
        }
      },

      // Best effort: if it fails, the server count still drops when the check-in expires
      async end() {
        if (!(await port.signedIn())) return;
        await port.endCheckIn().catch(() => null);
      },
    },

    reports: {
      source: 'live',

      async post(input, requestKey) {
        if (!(await port.signedIn())) return { ok: false, reason: 'sign_in' };
        try {
          const result = await port.postReport(input, requestKey);
          if ('postId' in result) return { ok: true, postId: result.postId };
          if (result.code === NO_USERNAME) return { ok: false, reason: 'no_username' };
          return failure(result);
        } catch (error) {
          return { ok: false, reason: 'error', message: messageOf(error) };
        }
      },

      async recent() {
        if (!(await port.signedIn())) return null;
        return (await port.feed()).map(feedPostOf).filter((post): post is FeedPost => post !== null);
      },

      async flag(postId) {
        if (!(await port.signedIn())) return { ok: false, reason: 'sign_in' };
        const id = Number(postId);
        if (!Number.isSafeInteger(id)) return { ok: false, reason: 'error' };
        try {
          const result = await port.flagPost(id);
          return 'hidden' in result ? { ok: true, hidden: result.hidden } : failure(result);
        } catch (error) {
          return { ok: false, reason: 'error', message: messageOf(error) };
        }
      },
    },
  };
}
