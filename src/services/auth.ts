import { getSupabase } from './supabase';

export type AuthResult = { ok: true } | { ok: false; message: string };

// Prototype v0 (PRD 7.1): team accounts sign in with the email and password created for them
// in the Supabase dashboard. There is no self sign-up in the app.
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    return error ? { ok: false, message: error.message } : { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.signOut();
    return error ? { ok: false, message: error.message } : { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
