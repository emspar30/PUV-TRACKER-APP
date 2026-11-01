import type { BatonRole } from '@/shared/relay/baton';

import { getSupabase, isSupabaseConfigured } from './supabase';

// BT1 (PRD 8.3): a team rider's heartbeat while relaying a multicab on the live map, answered with
// their role, and their leaving when the relay ends. null when the server could not be reached (the
// rider keeps the role they had).
// changed: the rider picked another drop-off since joining (the drop-off itself stays on the phone)
export async function relayHeartbeat(vehicleId: string, leftM: number, eligible: boolean, changed: boolean): Promise<BatonRole | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await getSupabase().rpc('relay_heartbeat', { vehicle: vehicleId, left_m: Math.max(0, leftM), eligible, changed });
    if (error) return null;
    return data === 'primary' || data === 'secondary' ? data : null;
  } catch {
    return null;
  }
}

// Best effort: a rider who does not leave drops out after the liveness time
export async function relayLeave(vehicleId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await getSupabase().rpc('relay_leave', { vehicle: vehicleId });
  } catch {
    // Best effort
  }
}
