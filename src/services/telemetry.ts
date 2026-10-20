import { FunctionsHttpError } from '@supabase/supabase-js';

import { encodeBatch, type TelemetryPacket } from '@/shared/telemetry/packet';

import { getSupabase } from './supabase';

const INGEST_FUNCTION = 'ingest';

// T1: sends a vehicle's buffered positions, oldest first, to the ingest Edge Function, the only
// writer of the live-map table. The Supabase client adds the publishable key (`apikey`) and the
// signed-in user's access token (`Authorization`); the server refuses accounts that are not on the
// team allowlist. Returns the HTTP status, or null when the server could not be reached.
export async function sendTelemetryBatch(vehicleId: string, points: readonly TelemetryPacket[]): Promise<number | null> {
  try {
    const { error, response } = await getSupabase().functions.invoke(INGEST_FUNCTION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: encodeBatch(vehicleId, points),
    });
    if (!error) return response?.status ?? 200;
    if (error instanceof FunctionsHttpError) return (error.context as Response).status;
    return null;
  } catch {
    return null;
  }
}
