// The admin console's Moderation page (owner, 2026-11-23; migration 20261123000000_auto_moderation.sql):
// the rows the console_* functions return, and the evidence hint shown beside a flagged post. The
// admin decides; the hint only sums up the evidence. Pure: no React, React Native or Expo imports.

export type FlaggedPost = {
  post_id: number;
  author_id: string;
  author: string;
  route_id: string;
  phrase: string | null;
  stop_code: string | null;
  posted_at: string;
  live_map: boolean;
  hidden: boolean;
  verified: boolean;
  beacon_ok: boolean | null;
  with_gps: boolean;
  flags: number;
  weighted_flags: number;
  tags: string[];
  notes: string[];
  risk_events: number;
  struck: boolean;
  author_strikes: number;
  author_suspended_until: string | null;
  needs_review: boolean;
};

export type PendingAppeal = {
  appeal_id: number;
  account_id: string;
  account: string;
  body: string;
  appealed_at: string;
  strike_reason: string;
  struck_at: string;
  post_id: number | null;
  route_id: string | null;
  phrase: string | null;
  verified: boolean | null;
  beacon_ok: boolean | null;
  flags: number;
};

export type Suspension = {
  account_id: string;
  account: string;
  suspended_until: string;
  banned: boolean;
  by_rules: boolean;
  suspensions: number;
  strikes_now: number;
};

export type ModerationWaiting = { reviews: number; appeals: number };

// What the evidence says. likely_real: the ride passed its checks and the phone showed nothing wrong.
// likely_false: no ride check, phone evidence, or every flag weighted. Otherwise unclear.
export type EvidenceHint = 'likely_real' | 'likely_false' | 'unclear';

export function evidenceHint(post: Pick<FlaggedPost, 'verified' | 'beacon_ok' | 'risk_events' | 'flags' | 'weighted_flags'>): EvidenceHint {
  if (post.risk_events > 0) return 'likely_false';
  if (post.verified && post.beacon_ok === true) return 'likely_real';
  if (!post.verified && post.beacon_ok !== true && post.weighted_flags > 0 && post.weighted_flags === post.flags) return 'likely_false';
  return 'unclear';
}

// The tab's count: what needs the admin
export function waitingCount(waiting: ModerationWaiting | null): number {
  return waiting ? waiting.reviews + waiting.appeals : 0;
}
