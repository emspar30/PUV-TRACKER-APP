import { getSupabase, isSupabaseConfigured } from './supabase';

// DT1 (PRD 10.5): the detours an admin has made active (active_detours), by id. null when unknown
// (no backend, signed out, offline): the app keeps what it had.
export async function loadActiveDetours(): Promise<string[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await getSupabase().rpc('active_detours');
    if (error) return null;
    return ((data ?? []) as { alternative_id: string }[]).map((row) => row.alternative_id);
  } catch {
    return null;
  }
}
