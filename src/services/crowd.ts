import type { CrowdPort, FeedRow } from '@/data/live/liveCrowd';
import { FEED_READ_LIMIT } from '@/shared/config';

import { getSupabase } from './supabase';

const failureOf = (error: { code?: string; message: string }) => ({ code: error.code ?? null, message: error.message });

// The Supabase side of check-ins and reports (C1, RP1). Every write goes through the SB1 functions;
// feed_posts is read through its policy (live, visible posts; never the author's user id).
export const supabaseCrowdPort: CrowdPort = {
  async signedIn() {
    const { data } = await getSupabase().auth.getSession();
    return Boolean(data.session);
  },

  async checkIn(routeCode, stationCode, requestKey) {
    const { data, error } = await getSupabase().rpc('check_in', { route: routeCode, station: stationCode, request_key: requestKey });
    if (error) return failureOf(error);
    return { expiresAt: data as string };
  },

  async checkinCounts(routeCode) {
    const { data, error } = await getSupabase().rpc('checkin_counts', { route: routeCode });
    if (error) throw new Error(error.message);
    return (data ?? []) as { station_code: string; waiting: number | string }[];
  },

  async endCheckIn() {
    const { error } = await getSupabase().rpc('end_check_in');
    return error ? failureOf(error) : null;
  },

  async postReport(input, requestKey) {
    const { error } = await getSupabase().rpc('post_report', {
      route: input.routeCode,
      phrase: input.phrase,
      seat_tier: input.seatTier,
      vehicle: input.vehicleId,
      with_gps: input.withGps,
      request_key: requestKey,
    });
    return error ? failureOf(error) : null;
  },

  async feed() {
    const { data, error } = await getSupabase()
      .from('feed_posts')
      .select('id, author_username, route_id, phrase, seat_tier, with_gps, created_at')
      .order('created_at', { ascending: false })
      .limit(FEED_READ_LIMIT);
    if (error) throw new Error(error.message);
    return (data ?? []) as FeedRow[];
  },
};
