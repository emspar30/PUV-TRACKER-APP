import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { sessionStorageKey, storedSessionOf, type StoredSession } from '@/shared/auth/gate';
import { readSupabaseEnv } from '@/shared/config/env';

let client: SupabaseClient | null = null;
let storageKey: string | null = null;

// False until the two keys are present in .env. The offline features never need the backend.
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

// Created on first use, so the offline features run even when no Supabase keys are set.
// Throws SUPABASE_ENV_ERROR if the keys are missing.
export function getSupabase(): SupabaseClient {
  if (!client) {
    // EXPO_PUBLIC_* variables must be referenced statically for Expo to inline them
    const { url, publishableKey } = readSupabaseEnv(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    // AU1: the library's own default key, named here so the saved session can be read offline
    storageKey = sessionStorageKey(url);
    client = createClient(url, publishableKey, {
      auth: {
        storage: localStorage,
        storageKey,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

// AU1: the session saved on the phone, read straight from storage with no network. Offline with an
// expired access token the library reports no session but keeps this one (PRD 7.1).
export function readStoredSession(): StoredSession | null {
  if (!isSupabaseConfigured()) return null;
  try {
    getSupabase();
    return storageKey ? storedSessionOf(localStorage.getItem(storageKey)) : null;
  } catch {
    return null;
  }
}

// Whether a cloud call may be tried: a live session, or a saved one while offline. A call made
// offline then fails as a network error, not as "sign in".
export async function hasSession(): Promise<boolean> {
  const { data } = await getSupabase().auth.getSession();
  return Boolean(data.session) || readStoredSession() !== null;
}
