import type { AppealState, Strike, StrikeReason } from '@/shared/moderation/rules';

import { getSupabase, isSupabaseConfigured } from './supabase';

// MOD1 (PRD 11.2, 11.3): the rider's own moderation state (my_moderation), an appeal of their strike
// (appeal_strike), and the one-time notice that a Merit point absorbed a strike (ack_shield_notice).
export type Moderation = {
  trustLevel: number | null;
  reports: number;
  merit: number;
  suspendedUntilMs: number | null;
  shieldNotice: boolean;
  strikes: Strike[];
};

type StrikeRow = { id: number | string; reason: StrikeReason; created_at: string; expires_at: string; absorbed: boolean; lifted: boolean; appeal_state: AppealState };
type ModerationRow = {
  trust_level: number | null;
  reports: number;
  merit: number;
  suspended_until: string | null;
  shield_notice: boolean;
  strikes: StrikeRow[] | null;
};

export function moderationOf(row: ModerationRow): Moderation {
  return {
    trustLevel: row.trust_level === null ? null : Number(row.trust_level),
    reports: Number(row.reports ?? 0),
    merit: Number(row.merit ?? 0),
    suspendedUntilMs: row.suspended_until ? Date.parse(row.suspended_until) : null,
    shieldNotice: row.shield_notice === true,
    strikes: (row.strikes ?? []).map((strike) => ({
      id: String(strike.id),
      reason: strike.reason,
      createdMs: Date.parse(strike.created_at),
      expiresMs: Date.parse(strike.expires_at),
      absorbed: strike.absorbed,
      lifted: strike.lifted,
      appealState: strike.appeal_state,
    })),
  };
}

// null: signed out, no backend, or not reachable
export async function loadModeration(): Promise<Moderation | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await getSupabase().rpc('my_moderation');
    return error || !data ? null : moderationOf(data as ModerationRow);
  } catch {
    return null;
  }
}

// The reason the server gave, or null when it was taken
export async function appealStrike(strikeId: string, body: string): Promise<string | null> {
  try {
    const { error } = await getSupabase().rpc('appeal_strike', { strike: Number(strikeId), body });
    return error ? error.message : null;
  } catch (error) {
    return error instanceof Error ? error.message : 'error';
  }
}

export async function ackShieldNotice(): Promise<void> {
  try {
    await getSupabase().rpc('ack_shield_notice');
  } catch {
    // Best effort: the notice shows again next time
  }
}
