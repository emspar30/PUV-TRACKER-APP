import { CONNECTION_PROBE_TIMEOUT_MS } from '@/shared/config';

import { isSupabaseConfigured } from './supabase';

// PRD 14: can the server be reached? Any HTTP answer, even an error status, means the network is
// up; only a failed or timed-out request counts as offline. Null when no backend is configured.
export async function serverReachable(timeoutMs = CONNECTION_PROBE_TIMEOUT_MS): Promise<boolean | null> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!isSupabaseConfigured() || !url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`${url}/auth/v1/health`, { method: 'GET', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
