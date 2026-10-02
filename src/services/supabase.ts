import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { readSupabaseEnv } from '@/shared/config/env';

let client: SupabaseClient | null = null;

// Created on first use, so the offline features run even when no Supabase keys are set.
// Throws SUPABASE_ENV_ERROR if the keys are missing.
export function getSupabase(): SupabaseClient {
  if (!client) {
    // EXPO_PUBLIC_* variables must be referenced statically for Expo to inline them
    const { url, publishableKey } = readSupabaseEnv(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    client = createClient(url, publishableKey, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
