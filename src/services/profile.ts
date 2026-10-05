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
