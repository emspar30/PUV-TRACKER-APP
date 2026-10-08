import { getSupabase } from './supabase';

export type AuthResult = { ok: true } | { ok: false; message: string };

// Open sign-up (2026-10-05): anyone creates an account with an email and a password. When the
// project asks for email confirmation, the account works after the link in that email is opened.
export async function signUpWithPassword(email: string, password: string): Promise<AuthResult & { confirm?: boolean }> {
  try {
    const { data, error } = await getSupabase().auth.signUp({ email: email.trim(), password });
    if (error) return { ok: false, message: error.message };
    return { ok: true, confirm: data.session === null };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

// Email and password, for any account (team accounts were created in the Supabase dashboard)
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    return error ? { ok: false, message: error.message } : { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

// ST2-A: emails a password reset link. The link's page and the email itself are set in the Supabase
// dashboard. Supabase answers the same whether or not the email has an account.
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim());
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

// PRD 15.1, D10: deletes the signed-in account and everything it holds on the server
// (delete_my_account), then drops the session on this phone only: the account no longer exists, so
// a global sign-out would fail. The caller then clears the phone (resetApp).
export async function deleteMyAccount(): Promise<AuthResult> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return { ok: false, message: error.message };
    await supabase.auth.signOut({ scope: 'local' });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
