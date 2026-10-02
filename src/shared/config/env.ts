// Pure readers for environment-provided settings. Callers pass the values in,
// because Expo only inlines EXPO_PUBLIC_* variables that are referenced statically.

export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

export const SUPABASE_ENV_ERROR =
  'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env (see .env.example).';

export function readSupabaseEnv(url: string | undefined, publishableKey: string | undefined): SupabaseEnv {
  if (!url || !publishableKey) {
    throw new Error(SUPABASE_ENV_ERROR);
  }
  return { url, publishableKey };
}

// The dev broadcast screen (PRD 0.7) is off unless the flag is exactly 'true'.
export function readDevBroadcastFlag(value: string | undefined): boolean {
  return value === 'true';
}
