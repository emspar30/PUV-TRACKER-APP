import { getSupabase } from './supabase';

export type UsernameResult = { ok: true } | { ok: false; reason: 'taken' | 'invalid' | 'error'; message: string };

// Saves the signed-in user's username through set_username (SB1). The server checks the rule
// and that no one else has the name.
export async function saveUsername(username: string): Promise<UsernameResult> {
  try {
    const { error } = await getSupabase().rpc('set_username', { new_username: username });
    if (!error) return { ok: true };
    if (error.code === '23505') return { ok: false, reason: 'taken', message: error.message };
    if (error.code === '22023') return { ok: false, reason: 'invalid', message: error.message };
    return { ok: false, reason: 'error', message: error.message };
  } catch (error) {
    return { ok: false, reason: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

// The signed-in user's username on the server, or null when none is set (or on any error)
export async function loadUsername(): Promise<string | null> {
  try {
    const { data, error } = await getSupabase().from('profiles').select('username').maybeSingle();
    return error ? null : ((data?.username as string | null | undefined) ?? null);
  } catch {
    return null;
  }
}

// B7: the signed-in user's trust points (only the server changes them), or null when signed out
// or on any error
export async function loadTrustPoints(): Promise<number | null> {
  try {
    const { data, error } = await getSupabase().from('profiles').select('trust_points').maybeSingle();
    const points = data?.trust_points as number | null | undefined;
    return error || typeof points !== 'number' ? null : points;
  } catch {
    return null;
  }
}

// 2026-11-13: the number of the preset avatar the account uses (0 to 15), kept on the account's own
// profile row so every phone shows the same one; null when none is saved yet, or on any error
export async function loadAvatarId(): Promise<number | null> {
  try {
    const { data, error } = await getSupabase().from('profiles').select('avatar_id').maybeSingle();
    const id = data?.avatar_id as number | null | undefined;
    return error || typeof id !== 'number' ? null : id;
  } catch {
    return null;
  }
}

// Saves the account's avatar number through set_avatar; false on any error (sent again later)
export async function saveAvatarId(avatarId: number): Promise<boolean> {
  try {
    const { error } = await getSupabase().rpc('set_avatar', { avatar: avatarId });
    return !error;
  } catch {
    return false;
  }
}
