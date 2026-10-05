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
  phrase: string;
  seat_tier: string | null;
  with_gps: boolean;
  created_at: string;
};

export type CrowdPort = {
  signedIn(): Promise<boolean>;
  // check_in(route, station, request_key): the expiry time
  checkIn(routeCode: string, stationCode: string, requestKey: string): Promise<{ expiresAt: string } | PortFailure>;
  checkinCounts(routeCode: string): Promise<{ station_code: string; waiting: number | string }[]>;
  endCheckIn(): Promise<PortFailure | null>;
  postReport(input: ReportInput, requestKey: string): Promise<PortFailure | null>;
  // Live, visible feed_posts, newest first
  feed(): Promise<FeedRow[]>;
};

const NOT_SIGNED_IN = '28000';
// post_report raises this when the account has no username yet
const NO_USERNAME = 'P0001';

const failure = (result: PortFailure): CloudFailure =>
  result.code === NOT_SIGNED_IN ? { ok: false, reason: 'sign_in' } : { ok: false, reason: 'error', message: result.message };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const SEAT_TIERS: readonly string[] = ['green', 'amber', 'red'];

export function feedPostOf(row: FeedRow): FeedPost | null {
  if (!isFeedPhrase(row.phrase)) return null;
  return {
    id: String(row.id),
    routeCode: row.route_id,
    phrase: row.phrase as FeedPhrase,
    seatTier: row.seat_tier !== null && SEAT_TIERS.includes(row.seat_tier) ? (row.seat_tier as SeatTier) : null,
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

      async checkIn(routeCode, stationCode, requestKey) {
        if (!(await port.signedIn())) return { ok: false, reason: 'sign_in' };
        try {
          const result = await port.checkIn(routeCode, stationCode, requestKey);
          return 'expiresAt' in result ? { ok: true, expiresAtMs: Date.parse(result.expiresAt) } : failure(result);
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
          if (result === null) return { ok: true };
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
    },
  };
}
